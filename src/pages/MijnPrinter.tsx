import "./MijnPrinter.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Camera,
  Check,
  Clock3,
  Cloud,
  Cog,
  Gauge,
  HardDrive,
  Layers3,
  RefreshCw,
  Save,
  Thermometer,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { db } from "../database/db";
import { saveSettings as saveCloudSettings } from "../services/SettingsSyncService";

type PrinterStatus = {
  state?: string;
  job?: { name?: string; progress?: number; elapsedSeconds?: number; remainingSeconds?: number };
  temperatures?: { nozzle?: number; nozzleTarget?: number; bed?: number; bedTarget?: number; chamber?: number };
  speed?: { percentage?: number; profile?: string };
  filament?: { type?: string; color?: string; remainingPercent?: number };
  device?: { model?: string; serial?: string; firmware?: string; wifiSignal?: number; ip?: string };
  updatedAt?: string;
};

const DEFAULT_IP = "192.168.68.73";

function normaliseUrl(value: string) {
  return value.trim().replace(/\/$/, "");
}

function duration(seconds?: number) {
  if (seconds === undefined) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}u ${minutes}m`;
}

export default function MijnPrinter() {
  const [printerNaam, setPrinterNaam] = useState("Bambu Lab P2S");
  const [printerIp, setPrinterIp] = useState(DEFAULT_IP);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [cameraUrl, setCameraUrl] = useState("");
  const [status, setStatus] = useState<PrinterStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);

  const activeBridge = useMemo(() => {
    if (remoteUrl) return normaliseUrl(remoteUrl);
    return `http://${printerIp}`;
  }, [printerIp, remoteUrl]);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${activeBridge}/api/printer/status`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setStatus(await response.json() as PrinterStatus);
    } catch {
      setStatus(null);
      setError("Printerbridge niet bereikbaar");
    } finally {
      setLoading(false);
    }
  }, [activeBridge]);

  useEffect(() => {
    async function initialise() {
      const settings = await db.settings.get(1);
      if (settings) {
        setPrinterNaam(settings.printerNaam || "Bambu Lab P2S");
        setPrinterIp(settings.printerIp || DEFAULT_IP);
        setRemoteUrl(settings.printerRemoteUrl || "");
        setCameraUrl(settings.printerCameraUrl || "");
      }
    }
    initialise();
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(loadStatus, 0);
    const interval = window.setInterval(loadStatus, 15_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadStatus]);

  async function saveSettings() {
    const current = await db.settings.get(1);
    await saveCloudSettings({
      id: 1,
      printerNaam,
      stroomPrijs: current?.stroomPrijs ?? 0.23,
      printerVermogen: current?.printerVermogen ?? 180,
      btw: current?.btw ?? 21,
      verpakking: current?.verpakking ?? 0.3,
      onderhoud: current?.onderhoud ?? 0.1,
      platform: current?.platform ?? "Etsy",
      platformKosten: current?.platformKosten ?? 6.5,
      printerIp,
      printerRemoteUrl: remoteUrl,
      printerCameraUrl: cameraUrl,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
    setSettingsOpen(false);
    loadStatus();
  }

  const connected = Boolean(status);
  const progress = Math.max(0, Math.min(100, status?.job?.progress ?? 0));
  const streamUrl = cameraUrl || (remoteUrl ? `${activeBridge}/api/printer/camera` : "");

  return (
    <div className="printer-page">
      <header className="printer-header">
        <div>
          <div className="printer-eyebrow"><Activity size={14} /> Printerbeheer</div>
          <h1>Mijn Printer</h1>
          <p>Live inzicht in je printer, huidige opdracht en temperaturen.</p>
        </div>
        <div className="printer-header__actions">
          <button className="printer-icon-button" onClick={() => { loadStatus(); setCameraKey((key) => key + 1); }} aria-label="Vernieuwen">
            <RefreshCw size={18} className={loading ? "is-spinning" : ""} />
          </button>
          <button className="printer-settings-button" onClick={() => setSettingsOpen((open) => !open)}>
            <Cog size={18} /> Verbinding
          </button>
        </div>
      </header>

      {settingsOpen && (
        <section className="printer-connection-panel">
          <div className="printer-section-heading">
            <div><span>Configuratie</span><h2>Printerverbinding</h2></div>
            <small>Gebruik extern altijd een beveiligde HTTPS-bridge.</small>
          </div>
          <div className="printer-form-grid">
            <label>Printer naam<input value={printerNaam} onChange={(event) => setPrinterNaam(event.target.value)} /></label>
            <label>Lokaal IP-adres<input value={printerIp} onChange={(event) => setPrinterIp(event.target.value)} inputMode="decimal" /></label>
            <label>Externe bridge URL <em>optioneel</em><input type="url" placeholder="https://printer.jouwdomein.nl" value={remoteUrl} onChange={(event) => setRemoteUrl(event.target.value)} /></label>
            <label>Camera stream URL <em>optioneel</em><input type="url" placeholder="https://…/camera/stream.mjpg" value={cameraUrl} onChange={(event) => setCameraUrl(event.target.value)} /></label>
          </div>
          <div className="printer-connection-note"><Cloud size={17} /><span>De bridge moet <code>/api/printer/status</code> en optioneel <code>/api/printer/camera</code> aanbieden. Publiceer poort 8883 of de printercamera nooit rechtstreeks.</span></div>
          <button className="printer-save-button" onClick={saveSettings}>{saved ? <Check size={18} /> : <Save size={18} />}{saved ? "Opgeslagen" : "Verbinding opslaan"}</button>
        </section>
      )}

      <section className="printer-overview">
        <div className="printer-main-column">
          <section className="printer-stats">
            <Stat icon={<Thermometer />} label="Nozzle" value={status?.temperatures?.nozzle} suffix="°C" note={status?.temperatures?.nozzleTarget !== undefined ? `Doel ${status.temperatures.nozzleTarget}°C` : "Geen meting"} tone="orange" />
            <Stat icon={<Thermometer />} label="Printbed" value={status?.temperatures?.bed} suffix="°C" note={status?.temperatures?.bedTarget !== undefined ? `Doel ${status.temperatures.bedTarget}°C` : "Geen meting"} tone="violet" />
            <Stat icon={<Zap />} label="Snelheid" value={status?.speed?.percentage} suffix="%" note={status?.speed?.profile || "Geen meting"} tone="cyan" />
            <Stat icon={<HardDrive />} label="Filament" value={status?.filament?.remainingPercent} suffix="%" note={status?.filament?.type || "Niet gedetecteerd"} tone="green" />
          </section>

          <section className="printer-details-card">
            <div className="printer-section-heading"><div><span>Apparaatinformatie</span><h2>{printerNaam}</h2></div><span className="printer-last-seen">{error || (status?.updatedAt ? `Bijgewerkt ${new Date(status.updatedAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}` : "Wacht op verbinding")}</span></div>
            <dl className="printer-details-grid">
              <Detail label="Status" value={status?.state || "Niet verbonden"} />
              <Detail label="Model" value={status?.device?.model || "—"} />
              <Detail label="Serienummer" value={status?.device?.serial || "—"} />
              <Detail label="Firmware" value={status?.device?.firmware || "—"} />
              <Detail label="IP-adres" value={status?.device?.ip || printerIp} />
              <Detail label="Wifi-signaal" value={status?.device?.wifiSignal !== undefined ? `${status.device.wifiSignal} dBm` : "—"} />
            </dl>
          </section>
        </div>

        <article className="printer-job-card">
          <div className="printer-card-heading"><div><span>Huidige opdracht</span><h2>{status?.job?.name || "Geen printgegevens"}</h2></div><Layers3 size={22} /></div>
          <div className="printer-progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{Math.round(progress)}%</strong><span>voltooid</span></div>
          </div>
          <div className="printer-progress-track"><span style={{ width: `${progress}%` }} /></div>
          <div className="printer-job-times">
            <div><Clock3 size={17} /><span>Verstreken<strong>{duration(status?.job?.elapsedSeconds)}</strong></span></div>
            <div><Gauge size={17} /><span>Resterend<strong>{duration(status?.job?.remainingSeconds)}</strong></span></div>
          </div>
          <div className="printer-compact-live">
            <div className="printer-compact-live__top">
              <div><Camera size={15} /><span>Live view</span></div>
              <span className={`printer-connection-pill ${connected ? "is-online" : "is-offline"}`}>
                {connected ? <Wifi size={12} /> : <WifiOff size={12} />}{connected ? "Online" : "Offline"}
              </span>
            </div>
            <div className="printer-camera">
              {streamUrl ? (
                <img key={cameraKey} src={`${streamUrl}${streamUrl.includes("?") ? "&" : "?"}t=${cameraKey}`} alt={`Livebeeld van ${printerNaam}`} onError={(event) => { event.currentTarget.style.display = "none"; }} />
              ) : null}
              <div className="printer-camera__empty"><Camera size={26} /><strong>Geen livebeeld</strong><span>Stel de camera in via Verbinding.</span></div>
              <div className="printer-camera__label"><span /> LIVE</div>
            </div>
            <div className="printer-compact-live__footer"><span>{printerNaam}</span><small>{status?.device?.ip || printerIp}</small></div>
          </div>
        </article>
      </section>
    </div>
  );
}

function Stat({ icon, label, value, suffix, note, tone }: { icon: React.ReactNode; label: string; value?: number; suffix: string; note: string; tone: string }) {
  return <article className={`printer-stat printer-stat--${tone}`}><div>{icon}<span>{label}</span></div><strong>{value === undefined ? "—" : `${Math.round(value)}${suffix}`}</strong><small>{note}</small></article>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}
