import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.js";
import { injectGoogleFonts } from "./lib/fonts.js";
import "./lib/i18n.js";
import "./index.css";

injectGoogleFonts();

document.addEventListener(
  "wheel",
  (event) => {
    if (event.target instanceof Element && event.target.closest(".settings-panel-scroll")) {
      return;
    }
    event.preventDefault();
  },
  { passive: false },
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
