/**
 * PWA plumbing: offline shell + "new version available" detection.
 *
 * Two update signals are combined:
 *  1. Build-ID check — every build stamps a unique ID; if the last-seen ID in
 *     localStorage differs from the current one, a new deploy was cached and
 *     the user is offered a refresh (persistent across visits).
 *  2. Classic SW signals (waiting worker / updatefound) as a fallback.
 *
 * Production builds only — dev must never be cached or nagged.
 */
const BUILD_ID_KEY = "wordigo:buildId";

/** True when the stored build ID differs from this build's ID. */
function isNewDeploy(): boolean {
  try {
    const last = localStorage.getItem(BUILD_ID_KEY);
    if (last && last !== __APP_BUILD_ID__) {
      localStorage.setItem(BUILD_ID_KEY, __APP_BUILD_ID__);
      return true;
    }
    localStorage.setItem(BUILD_ID_KEY, __APP_BUILD_ID__);
  } catch {
    // Private mode etc. — skip the check, SW fallback still works.
  }
  return false;
}

export function registerServiceWorker(onUpdateAvailable?: () => void): void {
  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator)) return;

  if (isNewDeploy()) {
    // Fire async so the toast mounts after first render.
    setTimeout(() => onUpdateAvailable?.(), 800);
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        navigator.serviceWorker.addEventListener("message", (event) => {
          if (event.data?.type === "update-available") onUpdateAvailable?.();
        });
        if (reg.waiting) onUpdateAvailable?.();
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          sw?.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              onUpdateAvailable?.();
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[pwa] service worker registration failed:", err);
      });
  });
}

/** Called when the user accepts the update toast — swaps in the new SW. */
export function applyUpdate(): void {
  navigator.serviceWorker.controller?.postMessage("apply-update");
  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), {
    once: true,
  });
}
