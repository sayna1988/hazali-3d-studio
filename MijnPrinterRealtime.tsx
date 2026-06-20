import "./src/pages/MijnPrinter.css";
import "./MijnPrinterRealtime.css";
import { useCallback, useEffect, useState } from "react";
import { Activity, Camera, Check, Clipboard, Clock3, Cloud, Cog, Gauge, HardDrive, Layers3, Radio, RefreshCw, Save, Thermometer, Wifi, WifiOff, Zap } from "lucide-react";
import { db } from "./src/database/db";
import { useAuth } from "./src/auth/AuthProvider";
import { supabase } from "./src/lib/supabase";
import { getPrinterStatus, type CloudPrinterStatus, type PrinterStatus } from "./src/services/PrinterStatusService";

type CloudDevice = { name: string; local_ip: string | null; remote_url: string | null; camera_url: string | null; ingest_token: string };
const DEFAULT_IP = "192.168.68.73";

function duration(seconds?: number) {
  if (seconds === undefined) return "—";
  return `${Math.floor(seconds / 3600)}u ${Math.floor((seconds % 3600) / 60)}m`;
}

export default function MijnPrinterRealtime() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const [printerNaam, setPrinterNaam] = useState("Bambu Lab P2S");
  const [printerIp, setPrinterIp] = useState(DEFAULT_IP);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [cameraUrl, setCameraUrl] = useState("");
  const [deviceToken, setDeviceToken] = useState("");
  const [status, setStatus] = useState<PrinterStatus | null>(null);
  const [receivedAt, setReceivedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [now, setNow] = useState<number | null>(null);
  const ingestUrl = `${window.location.origin}/api/printer-status`;
  const bridgeUrl = remoteUrl.trim().replace(/\/$/, "") || `http://${printerIp}`;
  const sourceUrl = `${bridgeUrl}/api/printer/status`;

  const applyStatus = useCallback((row: CloudPrinterStatus | null) => {
    setStatus(row?.data ?? null);
    setReceivedAt(row?.received_at ?? null);
  }, []);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try { applyStatus(await getPrinterStatus(userId)); setError(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Status ophalen mislukt"); }
    finally { setLoading(false); }
  }, [applyStatus, userId]);

  useEffect(() => {
    let active = true;
    async function initialise() {
      const [local, cloudResult] = await Promise.all([
        db.settings.get(1),
        supabase!.from("printer_devices").select("name,local_ip,remote_url,camera_url,ingest_token").eq("user_id", userId).maybeSingle(),
      ]);
      if (!active) return;
      let cloud = cloudResult.data as CloudDevice | null;
      if (!cloud && !cloudResult.error) {
        const created = await supabase!.from("printer_devices").insert({
          user_id: userId, name: local?.printerNaam || "Bambu Lab P2S", local_ip: local?.printerIp || DEFAULT_IP,
          remote_url: local?.printerRemoteUrl || null, camera_url: local?.printerCameraUrl || null, ingest_token: crypto.randomUUID(),
        }).select("name,local_ip,remote_url,camera_url,ingest_token").single();
        cloud = created.data as CloudDevice | null;
        if (created.error) setError(created.error.message);
      } else if (cloudResult.error) setError(cloudResult.error.message);
      if (cloud) {
        setPrinterNaam(cloud.name); setPrinterIp(cloud.local_ip || DEFAULT_IP); setRemoteUrl(cloud.remote_url || "");
        setCameraUrl(cloud.camera_url || ""); setDeviceToken(cloud.ingest_token);
      }
      await loadStatus();
    }
    void initialise();
    return () => { active = false; };
  }, [loadStatus, userId]);

  useEffect(() => {
    const channel = supabase!.channel(`printer-status-${userId}`).on(
      "postgres_changes", { event: "*", schema: "public", table: "printer_status", filter: `user_id=eq.${userId}` },
      (payload) => { applyStatus(payload.new as CloudPrinterStatus); setError(""); setLoading(false); },
    ).subscribe((state) => { if (state === "CHANNEL_ERROR") setError("Realtime verbinding onderbroken"); });
    return () => { void supabase!.removeChannel(channel); };
  }, [applyStatus, userId]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const onOnline = () => void loadStatus();
    window.addEventListener("online", onOnline);
    return () => { window.clearInterval(clock); window.removeEventListener("online", onOnline); };
  }, [loadStatus]);

  async function saveSettings() {
    const current = await db.settings.get(1);
    await db.settings.put({
      id: 1, printerNaam, stroomPrijs: current?.stroomPrijs ?? 0.23, printerVermogen: current?.printerVermogen ?? 180,
      btw: current?.btw ?? 21, verpakking: current?.verpakking ?? 0.3, onderhoud: current?.onderhoud ?? 0.1,
      platform: current?.platform ?? "Etsy", platformKosten: current?.platformKosten ?? 6.5,
      printerIp, printerRemoteUrl: remoteUrl, printerCameraUrl: cameraUrl, printerDeviceToken: deviceToken,
    });
    const result = await supabase!.from("printer_devices").upsert({
      user_id: userId, name: printerNaam, local_ip: printerIp || null, remote_url: remoteUrl || null,
      camera_url: cameraUrl || null, ingest_token: deviceToken || crypto.randomUUID(), updated_at: new Date().toISOString(),
    }).select("ingest_token").single();
    if (result.error) { setError(result.error.message); return; }
    setDeviceToken(result.data.ingest_token);
    setSaved(true); window.setTimeout(() => setSaved(false), 1800); setSettingsOpen(false);
  }

  async function copyRelayConfig() {
    await navigator.clipboard.writeText(`HAZALI_PRINTER_API_URL=${ingestUrl}\nHAZALI_PRINTER_TOKEN=${deviceToken}\nPRINTER_STATUS_URL=${sourceUrl}`);
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }

  const age = receivedAt && now !== null ? Math.max(0, Math.floor((now - new Date(receivedAt).getTime()) / 1000)) : Infinity;
  const connected = age < 15;
  const progress = Math.max(0, Math.min(100, status?.job?.progress ?? 0));
  const streamUrl = cameraUrl || (remoteUrl ? `${bridgeUrl}/api/printer/camera` : "");
  const lastSeen = receivedAt ? (connected ? `${age}s geleden` : new Date(receivedAt).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "medium" })) : "Nog geen data ontvangen";

  return (
    <div className="printer-page">
      <header className="printer-header">
        <div><div className="printer-eyebrow"><Activity size={14} /> Printerbeheer</div><h1>Mijn Printer</h1><p>Realtime inzicht in je printer, thuis en onderweg.</p></div>
        <div className="printer-header__actions"><button className="printer-icon-button" onClick={() => { void loadStatus(); setCameraKey((key) => key + 1); }} aria-label="Vernieuwen"><RefreshCw size={18} className={loading ? "is-spinning" : ""} /></button><button className="printer-settings-button" onClick={() => setSettingsOpen((open) => !open)}><Cog size={18} /> Verbinding</button></div>
      </header>

      {settingsOpen && <section className="printer-connection-panel">
        <div className="printer-section-heading"><div><span>Configuratie</span><h2>Printerverbinding</h2></div><small>De relay stuurt iedere 2 seconden status naar de cloud.</small></div>
        <div className="printer-form-grid"><label>Printernaam<input value={printerNaam} onChange={(e) => setPrinterNaam(e.target.value)} /></label><label>Lokaal IP-adres<input value={printerIp} onChange={(e) => setPrinterIp(e.target.value)} /></label><label>Externe bridge URL <em>optioneel</em><input type="url" placeholder="https://printer.jouwdomein.nl" value={remoteUrl} onChange={(e) => setRemoteUrl(e.target.value)} /></label><label>Camera stream URL <em>optioneel</em><input type="url" placeholder="https://…/camera/stream.mjpg" value={cameraUrl} onChange={(e) => setCameraUrl(e.target.value)} /></label></div>
        <div className="printer-relay-config"><div><Radio size={17} /><span><strong>Relayconfiguratie</strong><small>Gebruik dit op het apparaat dat de printerbridge draait.</small></span></div><code>HAZALI_PRINTER_API_URL={ingestUrl}<br />HAZALI_PRINTER_TOKEN={deviceToken || "wordt aangemaakt"}<br />PRINTER_STATUS_URL={sourceUrl}</code><button type="button" onClick={() => void copyRelayConfig()} disabled={!deviceToken}><Clipboard size={15} /> {copied ? "Gekopieerd" : "Kopieer"}</button></div>
        <div className="printer-connection-note"><Cloud size={17} /><span>Start daarna <code>npm run printer:relay</code> op een computer of server in hetzelfde netwerk. Publiceer de printer zelf nooit rechtstreeks.</span></div>
        <button className="printer-save-button" onClick={() => void saveSettings()}>{saved ? <Check size={18} /> : <Save size={18} />}{saved ? "Opgeslagen" : "Verbinding opslaan"}</button>
      </section>}

      {error && <div className="printer-error" role="alert">{error}</div>}
      <section className="printer-overview">
        <div className="printer-main-column">
          <section className="printer-stats">
            <Stat icon={<Thermometer />} label="Nozzle" value={status?.temperatures?.nozzle} suffix="°C" note={status?.temperatures?.nozzleTarget !== undefined ? `Doel ${status.temperatures.nozzleTarget}°C` : "Geen meting"} tone="orange" />
            <Stat icon={<Thermometer />} label="Printbed" value={status?.temperatures?.bed} suffix="°C" note={status?.temperatures?.bedTarget !== undefined ? `Doel ${status.temperatures.bedTarget}°C` : "Geen meting"} tone="violet" />
            <Stat icon={<Zap />} label="Snelheid" value={status?.speed?.percentage} suffix="%" note={status?.speed?.profile || "Geen meting"} tone="cyan" />
            <Stat icon={<HardDrive />} label="Filament" value={status?.filament?.remainingPercent} suffix="%" note={status?.filament?.type || "Niet gedetecteerd"} tone="green" />
          </section>
          <section className="printer-details-card"><div className="printer-section-heading"><div><span>Apparaatinformatie</span><h2>{printerNaam}</h2></div><span className="printer-last-seen">{lastSeen}</span></div><dl className="printer-details-grid"><Detail label="Status" value={status?.state || "Niet verbonden"} /><Detail label="Model" value={status?.device?.model || "—"} /><Detail label="Serienummer" value={status?.device?.serial || "—"} /><Detail label="Firmware" value={status?.device?.firmware || "—"} /><Detail label="IP-adres" value={status?.device?.ip || printerIp} /><Detail label="Wifi-signaal" value={status?.device?.wifiSignal !== undefined ? `${status.device.wifiSignal} dBm` : "—"} /></dl></section>
        </div>
        <article className="printer-job-card">
          <div className="printer-card-heading"><div><span>Huidige opdracht</span><h2>{status?.job?.name || "Geen printgegevens"}</h2></div><Layers3 size={22} /></div>
          <div className="printer-progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><div><strong>{Math.round(progress)}%</strong><span>voltooid</span></div></div>
          <div className="printer-progress-track"><span style={{ width: `${progress}%` }} /></div>
          <div className="printer-job-times"><div><Clock3 size={17} /><span>Verstreken<strong>{duration(status?.job?.elapsedSeconds)}</strong></span></div><div><Gauge size={17} /><span>Resterend<strong>{duration(status?.job?.remainingSeconds)}</strong></span></div></div>
          <div className="printer-compact-live"><div className="printer-compact-live__top"><div><Camera size={15} /><span>Live view</span></div><span className={`printer-connection-pill ${connected ? "is-online" : "is-offline"}`}>{connected ? <Wifi size={12} /> : <WifiOff size={12} />}{connected ? "Live" : "Offline"}</span></div><div className="printer-camera">{streamUrl && <img key={cameraKey} src={`${streamUrl}${streamUrl.includes("?") ? "&" : "?"}t=${cameraKey}`} alt={`Livebeeld van ${printerNaam}`} onError={(e) => { e.currentTarget.style.display = "none"; }} />}<div className="printer-camera__empty"><Camera size={26} /><strong>Geen livebeeld</strong><span>Stel de camera in via Verbinding.</span></div>{connected && <div className="printer-camera__label"><span /> LIVE</div>}</div><div className="printer-compact-live__footer"><span>{printerNaam}</span><small>{status?.device?.ip || printerIp}</small></div></div>
        </article>
      </section>
    </div>
  );
}

function Stat({ icon, label, value, suffix, note, tone }: { icon: React.ReactNode; label: string; value?: number; suffix: string; note: string; tone: string }) { return <article className={`printer-stat printer-stat--${tone}`}><div>{icon}<span>{label}</span></div><strong>{value === undefined ? "—" : `${Math.round(value)}${suffix}`}</strong><small>{note}</small></article>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
