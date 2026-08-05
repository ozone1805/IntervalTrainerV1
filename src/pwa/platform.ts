/**
 * Platform facts the UI needs in order to explain installation and audio, both
 * of which behave differently on iOS than everywhere else.
 */

/** True for iPhone/iPad, including iPadOS, which reports itself as a Mac. */
export function isIOS(): boolean {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ claims to be a desktop Mac and only the touch points give it
  // away. Matching on the UA string rather than the deprecated
  // `navigator.platform`, which still reads "MacIntel" under device emulation
  // and would light up iPhone-only advice on a touchscreen Mac.
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

/** True when launched from the home screen rather than a browser tab. */
export function isStandalone(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS never implemented the display-mode media query for home screen apps
  // and exposes this non-standard flag instead.
  return (navigator as { standalone?: boolean }).standalone === true;
}

/**
 * One-shot UI flags (banner dismissals). Deliberately localStorage rather than
 * the IndexedDB engine state: these are per-device chrome preferences, not
 * learning progress, and must not travel through state migration or be wiped by
 * "Reset progress".
 */
export function wasDismissed(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false; // Private browsing can throw; showing the hint again is harmless.
  }
}

export function markDismissed(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Ignore — worst case the hint reappears next launch.
  }
}
