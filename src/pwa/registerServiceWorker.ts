/**
 * Register the offline shell. Production only: in dev the service worker would
 * serve stale precached bundles over Vite's HMR output, which looks exactly
 * like edits silently not applying.
 *
 * No `skipWaiting` — a new build takes over once every tab is closed rather
 * than swapping the bundle out from under someone mid-question.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch((err) => {
        // Offline support is a bonus; the app works without it, so a failure
        // here should never surface to the user.
        console.warn("Service worker registration failed:", err);
      });
  });
}
