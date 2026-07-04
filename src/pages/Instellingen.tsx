import "./Instellingen.css";
import { useEffect, useState } from "react";
import type { SyntheticEvent } from "react";
import { Check, Euro, Image, Palette, Save, Sparkles } from "lucide-react";
import { db } from "../database/db";
import { saveSettings as saveAppSettings } from "../services/SettingsSyncService";
import type { SettingsModel } from "../types/Settings";
import {
  announceAppIconVariant,
  APP_ICON_VARIANTS,
  type AppIconVariant,
  getAppIconPath,
  getStoredAppIconVariant,
  normalizeAppIconVariant,
  setFavicon,
  storeAppIconVariant,
} from "../utils/appIcon";
import {
  announceAppThemeVariant,
  applyAppThemeVariant,
  APP_THEME_VARIANTS,
  type AppThemeVariant,
  getStoredAppThemeVariant,
  normalizeAppThemeVariant,
  storeAppThemeVariant,
} from "../utils/appTheme";

type KostenInstellingen = Pick<SettingsModel, "stroomPrijs" | "onderhoud" | "verpakking" | "werkKosten">;

const DEFAULT_KOSTEN: KostenInstellingen = {
  stroomPrijs: 0.23,
  onderhoud: 0.1,
  verpakking: 0.3,
  werkKosten: 0,
};

export default function Instellingen() {
  const [appIconVariant, setAppIconVariant] = useState<AppIconVariant>(() => getStoredAppIconVariant());
  const [appIconSaving, setAppIconSaving] = useState(false);
  const [appIconMessage, setAppIconMessage] = useState("Optie 03 is actief.");
  const [appThemeVariant, setAppThemeVariant] = useState<AppThemeVariant>(() => getStoredAppThemeVariant());
  const [appThemeSaving, setAppThemeSaving] = useState(false);
  const [appThemeMessage, setAppThemeMessage] = useState("Hazali is actief.");
  const [kosten, setKosten] = useState<KostenInstellingen>(DEFAULT_KOSTEN);
  const [kostenSaving, setKostenSaving] = useState(false);
  const [kostenMessage, setKostenMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      const settings = await db.settings.get(1);
      if (!active) return;

      setKosten(kostenFromSettings(settings));

      const iconVariant = normalizeAppIconVariant(settings?.appIconVariant ?? getStoredAppIconVariant());
      setAppIconVariant(iconVariant);
      setAppIconMessage(`Optie ${iconVariant} is actief.`);
      storeAppIconVariant(iconVariant);
      setFavicon(getAppIconPath(iconVariant));
      announceAppIconVariant(iconVariant);

      const themeVariant = normalizeAppThemeVariant(settings?.appThemeVariant ?? getStoredAppThemeVariant());
      const theme = APP_THEME_VARIANTS.find((item) => item.id === themeVariant) ?? APP_THEME_VARIANTS[0];
      setAppThemeVariant(themeVariant);
      setAppThemeMessage(`${theme.label} is actief.`);
      storeAppThemeVariant(themeVariant);
      applyAppThemeVariant(themeVariant);
      announceAppThemeVariant(themeVariant);
    }

    void loadSettings();
    const handleSettingsSynced = () => { void loadSettings(); };
    window.addEventListener("hazali:settings-synced", handleSettingsSynced);
    return () => {
      active = false;
      window.removeEventListener("hazali:settings-synced", handleSettingsSynced);
    };
  }, []);

  async function selectAppIcon(variant: AppIconVariant) {
    if (variant === appIconVariant || appIconSaving) return;

    const previousVariant = appIconVariant;
    setAppIconVariant(variant);
    setAppIconSaving(true);
    setAppIconMessage(`Optie ${variant} opslaan...`);
    storeAppIconVariant(variant);
    setFavicon(getAppIconPath(variant));
    announceAppIconVariant(variant);

    try {
      const currentSettings = await db.settings.get(1);
      await saveAppSettings(settingsWithChanges(currentSettings, { appIconVariant: variant }));
      setAppIconMessage(`Optie ${variant} is actief.`);
    } catch (error) {
      setAppIconVariant(previousVariant);
      storeAppIconVariant(previousVariant);
      setFavicon(getAppIconPath(previousVariant));
      announceAppIconVariant(previousVariant);
      setAppIconMessage(error instanceof Error ? error.message : "App-icoon opslaan is mislukt.");
    } finally {
      setAppIconSaving(false);
    }
  }

  async function selectAppTheme(variant: AppThemeVariant) {
    if (variant === appThemeVariant || appThemeSaving) return;

    const previousVariant = appThemeVariant;
    const theme = APP_THEME_VARIANTS.find((item) => item.id === variant) ?? APP_THEME_VARIANTS[0];
    const previousTheme = APP_THEME_VARIANTS.find((item) => item.id === previousVariant) ?? APP_THEME_VARIANTS[0];
    setAppThemeVariant(variant);
    setAppThemeSaving(true);
    setAppThemeMessage(`${theme.label} opslaan...`);
    storeAppThemeVariant(variant);
    applyAppThemeVariant(variant);
    announceAppThemeVariant(variant);

    try {
      const currentSettings = await db.settings.get(1);
      await saveAppSettings(settingsWithChanges(currentSettings, { appThemeVariant: variant }));
      setAppThemeMessage(`${theme.label} is actief.`);
    } catch (error) {
      setAppThemeVariant(previousVariant);
      storeAppThemeVariant(previousVariant);
      applyAppThemeVariant(previousVariant);
      announceAppThemeVariant(previousVariant);
      setAppThemeMessage(error instanceof Error ? error.message : `${previousTheme.label} is actief.`);
    } finally {
      setAppThemeSaving(false);
    }
  }

  function updateKosten(key: keyof KostenInstellingen, value: number) {
    setKosten((current) => ({
      ...current,
      [key]: Number.isFinite(value) ? Math.max(0, value) : 0,
    }));
    setKostenMessage("");
  }

  async function saveKostenSettings() {
    if (kostenSaving) return;

    setKostenSaving(true);
    setKostenMessage("Kosten opslaan...");
    try {
      const currentSettings = await db.settings.get(1);
      await saveAppSettings(settingsWithChanges(currentSettings, kosten));
      setKostenMessage("Kosten opgeslagen.");
    } catch (error) {
      setKostenMessage(error instanceof Error ? error.message : "Kosten opslaan is mislukt.");
    } finally {
      setKostenSaving(false);
    }
  }

  function toonStandaardIcoon(event: SyntheticEvent<HTMLImageElement>) {
    if (event.currentTarget.src.endsWith("/logo.png")) return;
    event.currentTarget.src = "/logo.png";
  }

  return (
    <div className="settings-page">
      <header className="settings-header">
        <div>
          <span className="settings-eyebrow"><Sparkles size={15} /> Studio voorkeuren</span>
          <h1>Instellingen</h1>
          <p>Beheer kostprijzen, thema en app-icoon op dit apparaat en synchroniseer je keuze met je account.</p>
        </div>
      </header>

      <section className="settings-panel settings-cost-settings" aria-labelledby="settings-cost-title">
        <div className="settings-panel__header">
          <div>
            <span className="settings-section-label">Kostprijs</span>
            <h2 id="settings-cost-title">Kosten</h2>
          </div>
          <Euro size={22} className="settings-panel__symbol" />
          {kostenMessage && <div className="settings-cost-message" aria-live="polite">{kostenMessage}</div>}
        </div>
        <div className="settings-cost-grid">
          <label>
            <span>Stroom</span>
            <div className="settings-money-input">
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={kosten.stroomPrijs}
                onChange={(event) => updateKosten("stroomPrijs", Number(event.target.value))}
              />
              <small>EUR/kWh</small>
            </div>
          </label>
          <label>
            <span>Onderhoud</span>
            <div className="settings-money-input">
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={kosten.onderhoud}
                onChange={(event) => updateKosten("onderhoud", Number(event.target.value))}
              />
              <small>EUR</small>
            </div>
          </label>
          <label>
            <span>Verpakking</span>
            <div className="settings-money-input">
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={kosten.verpakking}
                onChange={(event) => updateKosten("verpakking", Number(event.target.value))}
              />
              <small>EUR</small>
            </div>
          </label>
          <label>
            <span>Werk kosten</span>
            <div className="settings-money-input">
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={kosten.werkKosten}
                onChange={(event) => updateKosten("werkKosten", Number(event.target.value))}
              />
              <small>EUR</small>
            </div>
          </label>
        </div>
        <button type="button" className="settings-save-button" disabled={kostenSaving} onClick={() => void saveKostenSettings()}>
          {kostenSaving ? <Check size={17} /> : <Save size={17} />}
          {kostenSaving ? "Opslaan..." : "Kosten opslaan"}
        </button>
      </section>

      <section className="settings-panel settings-icon-settings" aria-labelledby="settings-app-icon-title">
        <div className="settings-panel__header">
          <div>
            <span className="settings-section-label">App-icoon</span>
            <h2 id="settings-app-icon-title">App-icoon</h2>
          </div>
          <Image size={22} className="settings-panel__symbol" />
          <div className="settings-current" aria-live="polite">
            <img src={getAppIconPath(appIconVariant, 192)} alt="" onError={toonStandaardIcoon} />
            <span>{appIconMessage}</span>
          </div>
        </div>
        <p className="settings-note">
          Het gekozen icoon wordt direct toegepast in de webapp en browser. Voor het homescreen-icoon moet je de app mogelijk opnieuw installeren.
        </p>
        <div className="settings-icon-grid">
          {APP_ICON_VARIANTS.map((variant) => {
            const selected = appIconVariant === variant;
            return (
              <button
                key={variant}
                type="button"
                className={`settings-icon-option${selected ? " settings-icon-option--selected" : ""}`}
                aria-label={`Kies app-icoon optie ${variant}`}
                aria-pressed={selected}
                disabled={appIconSaving}
                onClick={() => { void selectAppIcon(variant); }}
              >
                <span className="settings-icon-option__preview">
                  <img src={getAppIconPath(variant, 192)} alt="" loading="lazy" onError={toonStandaardIcoon} />
                  {selected && <span className="settings-option-check"><Check size={14} /></span>}
                </span>
                <span>Optie {variant}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="settings-panel settings-theme-settings" aria-labelledby="settings-theme-title">
        <div className="settings-panel__header">
          <div>
            <span className="settings-section-label">Thema</span>
            <h2 id="settings-theme-title">Hazali thema</h2>
          </div>
          <Palette size={22} className="settings-panel__symbol" />
          <div className="settings-theme-current" aria-live="polite">{appThemeMessage}</div>
        </div>
        <p className="settings-note">
          Thema's worden direct toegepast op de interface en opgeslagen in dezelfde instellingen als je app-icoon.
        </p>
        <div className="settings-theme-grid">
          {APP_THEME_VARIANTS.map((theme) => {
            const selected = appThemeVariant === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                className={`settings-theme-option settings-theme-option--${theme.id}${selected ? " settings-theme-option--selected" : ""}`}
                aria-pressed={selected}
                disabled={appThemeSaving}
                onClick={() => { void selectAppTheme(theme.id); }}
              >
                <span className="settings-theme-option__preview" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="settings-theme-option__body">
                  <strong>{theme.label}</strong>
                  <small>{theme.description}</small>
                </span>
                {selected && <span className="settings-option-check"><Check size={14} /></span>}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function kostenFromSettings(current: SettingsModel | undefined): KostenInstellingen {
  return {
    stroomPrijs: current?.stroomPrijs ?? DEFAULT_KOSTEN.stroomPrijs,
    onderhoud: current?.onderhoud ?? DEFAULT_KOSTEN.onderhoud,
    verpakking: current?.verpakking ?? DEFAULT_KOSTEN.verpakking,
    werkKosten: current?.werkKosten ?? DEFAULT_KOSTEN.werkKosten,
  };
}

type SettingsChanges = Partial<
  Pick<
    SettingsModel,
    "appIconVariant" | "appThemeVariant" | "stroomPrijs" | "onderhoud" | "verpakking" | "werkKosten"
  >
>;

function settingsWithChanges(
  current: SettingsModel | undefined,
  changes: SettingsChanges,
): SettingsModel {
  return {
    id: 1,
    printerNaam: current?.printerNaam ?? "Bambu Lab P2S",
    stroomPrijs: changes.stroomPrijs ?? current?.stroomPrijs ?? DEFAULT_KOSTEN.stroomPrijs,
    printerVermogen: current?.printerVermogen ?? 180,
    btw: current?.btw ?? 21,
    verpakking: changes.verpakking ?? current?.verpakking ?? DEFAULT_KOSTEN.verpakking,
    onderhoud: changes.onderhoud ?? current?.onderhoud ?? DEFAULT_KOSTEN.onderhoud,
    werkKosten: changes.werkKosten ?? current?.werkKosten ?? DEFAULT_KOSTEN.werkKosten,
    platform: current?.platform ?? "Etsy",
    platformKosten: current?.platformKosten ?? 6.5,
    printerIp: current?.printerIp,
    printerRemoteUrl: current?.printerRemoteUrl,
    printerCameraUrl: current?.printerCameraUrl,
    printerDeviceToken: current?.printerDeviceToken,
    appIconVariant: changes.appIconVariant ?? current?.appIconVariant,
    appThemeVariant: changes.appThemeVariant ?? current?.appThemeVariant,
  };
}
