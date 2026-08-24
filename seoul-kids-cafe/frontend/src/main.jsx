import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "@astryxdesign/theme-neutral/theme.css";
import "./app.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

const imageCacheHosts = new Set([
  "onessa.app",
  "www.onessa.app",
  "localhost",
  "127.0.0.1"
]);

if ("serviceWorker" in navigator && imageCacheHosts.has(location.hostname)) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/seoul-kids-cafe/image-cache-sw.js", {
      scope: "/seoul-kids-cafe/",
      updateViaCache: "none"
    }).catch(() => {
      // 이미지 캐시를 사용할 수 없어도 사이트와 검색 기능은 그대로 동작한다.
    });
  });
}
