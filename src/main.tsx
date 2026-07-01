import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";

registerSW({
  immediate:true
});

import "./styles/index.css";
import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { AuthGate } from "./auth/AuthGate";
import { applyStoredAppIconVariant } from "./utils/appIcon";

applyStoredAppIconVariant();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AuthGate><App /></AuthGate>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
