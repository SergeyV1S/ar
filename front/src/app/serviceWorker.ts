export const registerServiceWorker = () => {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {});

  if (document.readyState === "complete") {
    void register();
    return;
  }
  window.addEventListener("load", register, { once: true });
};
