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
import SplashScreen from "./components/SplashScreen/SplashScreen";
import { applyStoredAppIconVariant } from "./utils/appIcon";
import { applyStoredAppThemeVariant } from "./utils/appTheme";

applyStoredAppIconVariant();
applyStoredAppThemeVariant();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SplashScreen />
        <AuthGate><App /></AuthGate>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
