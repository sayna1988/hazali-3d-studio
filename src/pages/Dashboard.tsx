import "./Dashboard.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Boxes,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Euro,
  Layers3,
  Package,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Trash2,
  Link2,
  Check,
  LoaderCircle,
  GripVertical,
} from "lucide-react";
import type { Print } from "../types/Print";
import type { Filament } from "../types/Filament";
import { loadFilaments } from "../services/FilamentService";
import { loadPrintSummaries } from "../services/PrintService";
import { rolGegevens, totaalGewicht } from "../utils/filamentInventory";
import { loadMakerWorldMetadata } from "../services/MakerWorldImportService";
import { loadPrintQueue, savePrintQueue, type PrintQueueItem } from "../services/PrintQueueService";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";

type DashboardData = {
  prints: Print[];
  filamenten: Filament[];
};

const euro = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

export default function Dashboard() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [data, setData] = useState<DashboardData>({ prints: [], filamenten: [] });
  const [queueInput, setQueueInput] = useState("");
  const [queueItems, setQueueItems] = useState<PrintQueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const draggedQueueId = useRef<string | null>(null);
  const queueReady = useRef(false);
  const savedQueueFingerprint = useRef("");

  useEffect(() => {
    let actief = true;
    async function loadDashboard() {
      const [prints, filamenten] = await Promise.all([
        loadPrintSummaries(),
        loadFilaments(),
      ]);
      prints.sort((a, b) => b.aangemaaktOp.localeCompare(a.aangemaaktOp));
      if (actief) {
        setData({ prints, filamenten });
      }
    }

    void loadDashboard();
    const verversNaSync = () => { void loadDashboard(); };
    window.addEventListener("hazali:data-synced", verversNaSync);
    return () => {
      actief = false;
      window.removeEventListener("hazali:data-synced", verversNaSync);
    };
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || !supabase) {
      setQueueLoading(false);
      return;
    }
    const client = supabase;

    let active = true;
    async function applyRemoteQueue() {
      try {
        const remoteItems = await loadPrintQueue(userId!);
        if (!active) return;
        const normalized = remoteItems.map((item) => ({ ...item, completed: Boolean(item.completed) }));
        savedQueueFingerprint.current = JSON.stringify(normalized);
        queueReady.current = true;
        setQueueItems(normalized);
        setQueueLoading(false);
      } catch (error) {
        if (!active) return;
        setQueueMessage(error instanceof Error ? error.message : "Printqueue laden is mislukt.");
        setQueueLoading(false);
      }
    }

    void applyRemoteQueue();
    const channel = client
      .channel(`print-queue-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "print_queue", filter: `user_id=eq.${userId}` }, () => {
        void applyRemoteQueue();
      })
      .subscribe();

    return () => {
      active = false;
      queueReady.current = false;
      void client.removeChannel(channel);
    };
  }, [session?.user.id]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || !queueReady.current) return;
    const fingerprint = JSON.stringify(queueItems);
    if (fingerprint === savedQueueFingerprint.current) return;
    savedQueueFingerprint.current = fingerprint;
    void savePrintQueue(userId, queueItems).catch((error) => {
      savedQueueFingerprint.current = "";
      setQueueMessage(error instanceof Error ? error.message : "Printqueue opslaan is mislukt.");
    });
  }, [queueItems, session?.user.id]);

  const stats = useMemo(() => {
    const omzet = data.prints.reduce((sum, print) => sum + Number(print.verkoopprijs || 0), 0);
    const winst = data.prints.reduce((sum, print) => sum + Number(print.winst || 0), 0);
    const printMinuten = data.prints.reduce(
      (sum, print) => sum + Number(print.uren || 0) * 60 + Number(print.minuten || 0),
      0,
    );
    const marge = omzet > 0 ? (winst / omzet) * 100 : 0;

    return { omzet, winst, marge, printMinuten };
  }, [data.prints]);

  const voorraadGram = data.filamenten.reduce(
    (sum, filament) => sum + totaalGewicht(filament),
    0,
  );
  const aantalRollen = data.filamenten.reduce((sum, filament) => sum + rolGegevens(filament).aantal, 0);
  const lageVoorraad = data.filamenten.filter((filament) => rolGegevens(filament).aantal <= 1);
  const recentePrints = data.prints.slice(0, 4);
  const queueOpenCount = queueItems.filter((item) => !item.completed).length;
  const queueDoneCount = queueItems.filter((item) => item.completed).length;
  const queueErrorCount = queueItems.filter((item) => item.status === "error").length;
  const datum = new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  function parseMakerWorldQueue(value: string) {
    const seen = new Set<string>();
    const urls: string[] = [];
    let overgeslagen = 0;

    value
      .split(/[\s,;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => {
        const candidate = /^https?:\/\//i.test(item) ? item : `https://${item}`;

        try {
          const parsed = new URL(candidate);
          const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
          if (host !== "makerworld.com" && !host.endsWith(".makerworld.com")) {
            overgeslagen += 1;
            return;
          }

          const normalized = parsed.href;
          if (seen.has(normalized)) return;
          seen.add(normalized);
          urls.push(normalized);
        } catch {
          overgeslagen += 1;
        }
      });

    return { urls, overgeslagen };
  }

  async function hydrateQueueItem(item: PrintQueueItem) {
    try {
      const metadata = await loadMakerWorldMetadata(item.url);
      setQueueItems((current) => current.map((queueItem) => queueItem.id === item.id ? {
        ...queueItem,
        status: "ready",
        title: metadata.title,
        image: metadata.images[0],
        printTimeSeconds: metadata.printTimeSeconds,
        error: undefined,
      } : queueItem));
    } catch (error) {
      const message = error instanceof Error ? error.message : "MakerWorld-gegevens ophalen is mislukt.";
      setQueueItems((current) => current.map((queueItem) => queueItem.id === item.id ? {
        ...queueItem,
        status: "error",
        error: message,
      } : queueItem));
    }
  }

  function voegQueueItemsToe(value = queueInput) {
    const { urls, overgeslagen } = parseMakerWorldQueue(value);

    if (!urls.length) {
      setQueueMessage("Voer ten minste een geldige MakerWorld URL in.");
      return;
    }

    const bestaande = new Set(queueItems.map((item) => item.url));
    const nieuweItems = urls
      .filter((url) => !bestaande.has(url))
      .map<PrintQueueItem>((url, index) => ({
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        url,
        status: "loading",
        completed: false,
      }));

    if (!nieuweItems.length) {
      setQueueMessage("Alle URLs staan al in de queue.");
      setQueueInput("");
      return;
    }

    setQueueItems((current) => [...current, ...nieuweItems]);
    nieuweItems.forEach((item) => { void hydrateQueueItem(item); });
    setQueueInput("");
    setQueueMessage(
      `${nieuweItems.length} ${nieuweItems.length === 1 ? "URL is" : "URLs zijn"} toegevoegd aan de queue${overgeslagen ? ` · ${overgeslagen} ongeldig ${overgeslagen === 1 ? "item" : "items"} overgeslagen` : ""}.`,
    );
  }

  function removeQueueItem(id: string) {
    setQueueItems((current) => current.filter((item) => item.id !== id));
  }

  function moveQueueItem(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    setQueueItems((current) => {
      const sourceIndex = current.findIndex((item) => item.id === sourceId);
      const targetIndex = current.findIndex((item) => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [source] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, source);
      return next;
    });
  }

  function toggleQueueItem(id: string) {
    setQueueItems((current) => current.map((item) => item.id === id ? { ...item, completed: !item.completed } : item));
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-hero">
        <div className="dashboard-hero__glow" />
        <div className="dashboard-hero__content">
          <div className="dashboard-eyebrow">
            <Sparkles size={15} />
            Studio-overzicht · {datum}
          </div>
          <h1>Goed om je weer te zien.</h1>
          <p>
            Alles wat er in je 3D-printstudio gebeurt, helder op één plek.
          </p>
          <div className="dashboard-hero__actions">
            <button className="dashboard-btn dashboard-btn--ghost" onClick={() => navigate("/prints") }>
              Bekijk alle prints <ArrowRight size={17} />
            </button>
          </div>
        </div>
        <div className="dashboard-hero__queue" aria-labelledby="dashboard-queue-title">
          <div className="dashboard-hero__queue-header">
            <div><span className="dashboard-section-label">Print queue</span><h2 id="dashboard-queue-title">Volgende prints</h2></div>
            <span>{queueItems.length}</span>
          </div>
          <form className="dashboard-queue__input" onSubmit={(event) => { event.preventDefault(); voegQueueItemsToe(); }}>
            <input
              id="makerworld-queue-input"
              aria-label="MakerWorld-link"
              value={queueInput}
              onChange={(event) => setQueueInput(event.target.value)}
              onPaste={(event) => {
                const pasted = event.clipboardData.getData("text").trim();
                if (!pasted) return;
                event.preventDefault();
                voegQueueItemsToe(pasted);
              }}
              placeholder="Plak een MakerWorld-link"
              disabled={queueLoading}
            />
            <button type="submit" aria-label="Toevoegen" disabled={queueLoading || !queueInput.trim()}><Link2 size={18} /></button>
          </form>
          <div className="dashboard-queue__list" aria-live="polite">
            {queueItems.length === 0 ? (
              <div className="dashboard-queue__empty"><Link2 size={22} /><p>Plak een link om je eerste print toe te voegen.</p></div>
            ) : queueItems.map((item, index) => (
              <QueueItem
                key={item.id}
                item={item}
                index={index}
                disabled={queueLoading}
                onRemove={removeQueueItem}
                onToggle={toggleQueueItem}
                onDragStart={(id) => { draggedQueueId.current = id; }}
                onDragOver={(targetId) => { if (draggedQueueId.current) moveQueueItem(draggedQueueId.current, targetId); }}
                onDragEnd={() => { draggedQueueId.current = null; }}
              />
            ))}
          </div>
          <div className="dashboard-queue__footer">
            <span>{queueMessage || (queueLoading ? "Checklist synchroniseren…" : `${queueOpenCount} open · ${queueDoneCount} afgevinkt${queueErrorCount ? ` · ${queueErrorCount} met fout` : ""}`)}</span>
            {!queueLoading && <span className="dashboard-queue__synced"><Check size={13} /> Online opgeslagen</span>}
          </div>
        </div>
      </header>

      <section className="dashboard-kpis" aria-label="Kerncijfers">
        <Kpi icon={<Package />} label="Prints" value={String(data.prints.length)} note="Opgeslagen projecten" />
        <Kpi icon={<Euro />} label="Omzet" value={euro.format(stats.omzet)} note="Totale verkoopwaarde" tone="blue" />
        <Kpi icon={<TrendingUp />} label="Winst" value={euro.format(stats.winst)} note={`${stats.marge.toFixed(0)}% gemiddelde marge`} tone="green" />
        <Kpi
          icon={<Clock3 />}
          label="Printtijd"
          value={`${Math.floor(stats.printMinuten / 60)}u ${stats.printMinuten % 60}m`}
          note="Geproduceerde tijd"
          tone="violet"
        />
      </section>

      <section className="dashboard-layout">
        <div className="dashboard-panel dashboard-recent">
          <div className="dashboard-panel__header">
            <div>
              <span className="dashboard-section-label">Activiteit</span>
              <h2>Recente prints</h2>
            </div>
            <button className="dashboard-text-btn" onClick={() => navigate("/prints") }>
              Alles bekijken <ArrowRight size={16} />
            </button>
          </div>

          {recentePrints.length === 0 ? (
            <div className="dashboard-empty">
              <div className="dashboard-empty__icon"><Layers3 size={28} /></div>
              <h3>Nog geen prints opgeslagen</h3>
              <p>Je opgeslagen prints verschijnen hier zodra ze beschikbaar zijn.</p>
            </div>
          ) : (
            <div className="dashboard-print-list">
              {recentePrints.map((print) => (
                <button className="dashboard-print-row" key={print.id} onClick={() => navigate(`/prints/${print.id}`)}>
                  <div className="dashboard-print-thumb">
                    {print.foto ? <img src={print.foto} alt="" /> : <Package size={22} />}
                  </div>
                  <div className="dashboard-print-main">
                    <strong>{print.naam}</strong>
                    <span>{print.filamentNaam || "Geen filament gekoppeld"}</span>
                  </div>
                  <span className="dashboard-print-time">{print.uren}u {print.minuten}m</span>
                  <strong className="dashboard-print-price">{euro.format(print.verkoopprijs)}</strong>
                  <ChevronRight size={18} className="dashboard-print-arrow" />
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="dashboard-side">
          <div className="dashboard-panel dashboard-stock">
            <div className="dashboard-panel__header">
              <div>
                <span className="dashboard-section-label">Materiaal</span>
                <h2>Filamentvoorraad</h2>
              </div>
              <Boxes size={22} />
            </div>
            <div className="dashboard-stock__total">
              <strong>{(voorraadGram / 1000).toLocaleString("nl-NL", { maximumFractionDigits: 1 })} kg</strong>
              <span>verdeeld over {aantalRollen} rollen</span>
            </div>
            <div className="dashboard-stock__bar"><span style={{ width: `${aantalRollen > 0 ? 100 : 0}%` }} /></div>
            {lageVoorraad.length > 0 ? (
              <div className="dashboard-warning"><TriangleAlert size={17} /> {lageVoorraad.length} {lageVoorraad.length === 1 ? "filamentsoort heeft" : "filamentsoorten hebben"} maximaal één rol</div>
            ) : (
              <div className="dashboard-stock__healthy"><span /> Voorraad ziet er goed uit</div>
            )}
            <button className="dashboard-link-row" onClick={() => navigate("/filamenten") }>
              Voorraad beheren <ChevronRight size={17} />
            </button>
          </div>

          <div className="dashboard-panel dashboard-shortcuts">
            <span className="dashboard-section-label">Snel naar</span>
            <button onClick={() => navigate("/prints") }><CircleDollarSign size={19} /><span><strong>Printresultaten</strong><small>Omzet & winst</small></span><ChevronRight size={17} /></button>
          </div>
        </aside>
      </section>
    </div>
  );
}

function formatPrintTime(seconds?: number) {
  if (!seconds) return "Printtijd onbekend";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.max(1, Math.round((seconds % 3600) / 60));
  return hours ? `${hours}u ${minutes}m` : `${minutes} min`;
}

function QueueItem({
  item,
  index,
  disabled,
  onRemove,
  onToggle,
  onDragStart,
  onDragOver,
  onDragEnd,
}: {
  item: PrintQueueItem;
  index: number;
  disabled: boolean;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDragEnd: () => void;
}) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const touchDragging = useRef(false);

  function finishSwipe() {
    if (swipeOffset < -78) onRemove(item.id);
    setSwipeOffset(0);
    swipeStart.current = null;
  }

  return (
    <div className="dashboard-queue__item-shell" data-queue-id={item.id}>
      <div className="dashboard-queue__delete"><Trash2 size={19} /><span>Verwijder</span></div>
      <article
        className={`dashboard-queue__item dashboard-queue__item--${item.status}${item.completed ? " dashboard-queue__item--completed" : ""}`}
        style={{ transform: `translateX(${swipeOffset}px)` }}
        draggable={!disabled}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          onDragStart(item.id);
        }}
        onDragOver={(event) => { event.preventDefault(); onDragOver(item.id); }}
        onDragEnd={onDragEnd}
        onPointerDown={(event) => {
          if (disabled || (event.target as HTMLElement).closest(".dashboard-queue__handle, .dashboard-queue__check")) return;
          swipeStart.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!swipeStart.current) return;
          const deltaX = event.clientX - swipeStart.current.x;
          const deltaY = event.clientY - swipeStart.current.y;
          if (Math.abs(deltaY) > Math.abs(deltaX)) return;
          setSwipeOffset(Math.max(-110, Math.min(0, deltaX)));
        }}
        onPointerUp={finishSwipe}
        onPointerCancel={finishSwipe}
      >
        <button
          type="button"
          className="dashboard-queue__handle"
          aria-label={`Verplaats ${item.title || `item ${index + 1}`}`}
          disabled={disabled}
          onPointerDown={(event) => {
            if (event.pointerType === "mouse") return;
            touchDragging.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            onDragStart(item.id);
          }}
          onPointerMove={(event) => {
            if (!touchDragging.current) return;
            const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-queue-id]");
            if (target?.dataset.queueId) onDragOver(target.dataset.queueId);
          }}
          onPointerUp={() => { touchDragging.current = false; onDragEnd(); }}
          onPointerCancel={() => { touchDragging.current = false; onDragEnd(); }}
        >
          <GripVertical size={18} />
        </button>
        <div className="dashboard-queue__thumb">
          {item.image ? <img src={item.image} alt="" /> : item.status === "loading" ? <LoaderCircle size={19} className="dashboard-spin" /> : <Package size={19} />}
          <span>{index + 1}</span>
        </div>
        <div className="dashboard-queue__body">
          <strong>{item.title || (item.status === "loading" ? "MakerWorld ophalen…" : "MakerWorld print")}</strong>
          <small><Clock3 size={13} /> {item.status === "loading" ? "Printprofiel laden" : formatPrintTime(item.printTimeSeconds)}</small>
          {item.error && <span className="dashboard-queue__error">{item.error}</span>}
        </div>
        <button
          type="button"
          className="dashboard-queue__check"
          aria-label={item.completed ? `${item.title || "Print"} als open markeren` : `${item.title || "Print"} afvinken`}
          aria-pressed={item.completed}
          onClick={() => onToggle(item.id)}
        >
          {item.completed && <Check size={15} />}
        </button>
      </article>
    </div>
  );
}

function Kpi({ icon, label, value, note, tone = "cyan" }: { icon: React.ReactNode; label: string; value: string; note: string; tone?: string }) {
  return (
    <article className={`dashboard-kpi dashboard-kpi--${tone}`}>
      <div className="dashboard-kpi__top"><span>{icon}</span><small>{label}</small></div>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}
