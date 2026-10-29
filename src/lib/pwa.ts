export function registerServiceWorker(): void {
  if (window.location.protocol === "file:") return;
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error: unknown) => {
      console.error("Service worker registration failed", error);
    });
  });
}
