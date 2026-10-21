import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./ui/tokens.css";
import "./ui/ui.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

/** vite-plugin-pwa 없이 일반 SW 등록. 캐시는 sw.js에서 사용하지 않음. */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignore */
    });
  });
}
