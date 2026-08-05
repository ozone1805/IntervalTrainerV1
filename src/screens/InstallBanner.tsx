import { useEffect, useState } from "react";
import { isIOS, isStandalone, markDismissed, wasDismissed } from "../pwa/platform";

const DISMISS_KEY = "install-banner-dismissed";

/**
 * Chrome fires this so a site can offer installation at its own moment rather
 * than through the browser's banner. Not in lib.dom yet.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * iOS share glyph, drawn inline rather than referenced as an SF Symbol so it
 * renders in every browser and inherits the surrounding text colour and size.
 */
function ShareIcon() {
  return (
    <svg className="inline-icon" viewBox="0 0 24 24" fill="none" aria-label="Share" role="img">
      <path
        d="M12 3v12M12 3l-3.5 3.5M12 3l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 10H5.5A1.5 1.5 0 0 0 4 11.5v8A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 18.5 10H17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Invites the user to install the app. Two very different jobs behind one
 * banner: on Chrome/Android there is a real install API to call, while iOS
 * offers no programmatic install at all, so the only thing that works is
 * telling the user which buttons to tap.
 */
export function InstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => wasDismissed(DISMISS_KEY));
  const [installed, setInstalled] = useState(() => isStandalone());

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      // Suppress Chrome's own mini-infobar so the offer appears in one place.
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const ios = isIOS();
  // Nothing to say once it is installed, and nothing useful to say on a desktop
  // browser that never offered us an install prompt.
  if (installed || dismissed || (!prompt && !ios)) return null;

  const close = () => {
    setDismissed(true);
    markDismissed(DISMISS_KEY);
  };

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    // Single-use: the event cannot be re-fired, so drop it either way.
    setPrompt(null);
    close();
  };

  return (
    <aside className="install-banner">
      <div className="install-banner-text">
        <strong>Add to your home screen</strong>
        {ios ? (
          <p>
            Tap the Share button <ShareIcon /> at the bottom of Safari, then choose{" "}
            <strong>Add to Home Screen</strong>. It opens fullscreen and works offline.
          </p>
        ) : (
          <p>Install it for a fullscreen app that works offline.</p>
        )}
      </div>
      <div className="install-banner-actions">
        {prompt && (
          <button className="btn btn-primary" onClick={install}>
            Install
          </button>
        )}
        <button className="btn" onClick={close}>
          {prompt ? "Not now" : "Got it"}
        </button>
      </div>
    </aside>
  );
}
