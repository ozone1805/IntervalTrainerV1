import { openDB, type IDBPDatabase } from "idb";
import { migrateState } from "../learning/migration";
import type { EngineState } from "../learning/types";

const DB_NAME = "interval-trainer";
const DB_VERSION = 1;
const STORE = "engine-state";
const STATE_KEY = "current";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
}

/**
 * The whole engine state is persisted as a single serializable record. It's
 * small (a handful of skills, a confusion map, capped review history) and
 * this keeps the persistence layer trivial and independent of the engine's
 * internal shape — swap this for per-record stores later if it ever grows
 * large enough to matter.
 */
export async function loadState(): Promise<EngineState | null> {
  const db = await getDb();
  const raw = await db.get(STORE, STATE_KEY);
  const state = migrateState(raw);
  // migrateState hands back the same object when nothing changed, so this
  // writes exactly once per upgrade rather than on every load.
  if (state && state !== raw) await db.put(STORE, state, STATE_KEY);
  return state;
}

export async function saveState(state: EngineState): Promise<void> {
  const db = await getDb();
  await db.put(STORE, state, STATE_KEY);
}

export async function clearState(): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, STATE_KEY);
}
