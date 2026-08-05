/**
 * Publish dist/ to the gh-pages branch, which GitHub Pages serves.
 *
 * A detached git worktree rather than `git subtree`, because dist/ is
 * gitignored on the source branch and so has no history to split off. The
 * branch is a single rolling commit — it is build output, not source, and its
 * history has no value.
 *
 * Run via `npm run deploy` (which builds first).
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = join(ROOT, "dist");
const WORKTREE = join(ROOT, ".gh-pages-tmp");
const BRANCH = "gh-pages";

const git = (args, cwd = ROOT) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();

if (!existsSync(join(DIST, "index.html"))) {
  throw new Error("deploy: dist/index.html missing — run `npm run build` first");
}

// A worktree left behind by an interrupted run would block `worktree add`.
rmSync(WORKTREE, { recursive: true, force: true });
try {
  git(["worktree", "prune"]);
} catch {
  // Nothing to prune.
}

const remoteHasBranch = git(["ls-remote", "--heads", "origin", BRANCH]).length > 0;
if (remoteHasBranch) {
  git(["fetch", "origin", BRANCH]);
  git(["worktree", "add", "-B", BRANCH, WORKTREE, `origin/${BRANCH}`]);
} else {
  git(["worktree", "add", "--detach", WORKTREE]);
  git(["checkout", "--orphan", BRANCH], WORKTREE);
}

try {
  // Clear whatever the branch held, then lay down this build. `git rm` rather
  // than deleting by hand so removals are staged too.
  try {
    git(["rm", "-rf", "--quiet", "."], WORKTREE);
  } catch {
    // Orphan branch with nothing tracked yet.
  }

  cpSync(DIST, WORKTREE, { recursive: true });
  // Without this GitHub runs the output through Jekyll, which drops files and
  // directories whose names begin with an underscore.
  writeFileSync(join(WORKTREE, ".nojekyll"), "");

  git(["add", "--all"], WORKTREE);
  const dirty = git(["status", "--porcelain"], WORKTREE).length > 0;
  if (!dirty) {
    console.log("deploy: build is identical to what is already published — nothing to do");
  } else {
    const sha = git(["rev-parse", "--short", "HEAD"]);
    git(["commit", "--quiet", "-m", `Deploy ${sha}`], WORKTREE);
    git(["push", "--force", "origin", BRANCH], WORKTREE);
    console.log(`deploy: pushed ${BRANCH} from source ${sha}`);
  }
} finally {
  rmSync(WORKTREE, { recursive: true, force: true });
  git(["worktree", "prune"]);
}
