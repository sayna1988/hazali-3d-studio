import { useEffect, useState } from "react";
import "./SplashScreen.css";
import { getAppIconPath, getStoredAppIconVariant } from "../../utils/appIcon";

const SPLASH_VISIBLE_MS = 720;
const SPLASH_FADE_MS = 260;

type SplashState = "visible" | "leaving" | "hidden";

export default function SplashScreen() {
  const [splashState, setSplashState] = useState<SplashState>("visible");
  const logoSrc = getAppIconPath(getStoredAppIconVariant(), 192);

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => {
      setSplashState("leaving");
    }, SPLASH_VISIBLE_MS);

    const hideTimer = window.setTimeout(() => {
      setSplashState("hidden");
    }, SPLASH_VISIBLE_MS + SPLASH_FADE_MS);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (splashState === "hidden") return null;

  return (
    <div
      className={`hazali-splash${splashState === "leaving" ? " hazali-splash--leaving" : ""}`}
      role="status"
      aria-label="Hazali 3D Studio wordt geladen"
    >
      <div className="hazali-splash__content">
        <img src={logoSrc} alt="Hazali 3D Studio" className="hazali-splash__logo" />
        <span className="hazali-splash__loader" aria-hidden="true" />
      </div>
    </div>
  );
}
