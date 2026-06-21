import "./Dashboard.css";
import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import type { Print } from "../types/Print";
import type { Filament } from "../types/Filament";
import { loadFilaments } from "../services/FilamentService";
import { loadPrintSummaries } from "../services/PrintService";
import { rolGegevens, totaalGewicht } from "../utils/filamentInventory";

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
  const [data, setData] = useState<DashboardData>({ prints: [], filamenten: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const [prints, filamenten] = await Promise.all([
        loadPrintSummaries(),
        loadFilaments(),
      ]);
      prints.sort((a, b) => b.aangemaaktOp.localeCompare(a.aangemaaktOp));
      setData({ prints, filamenten });
      setLoading(false);
    }

    loadDashboard();
  }, []);

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
  const datum = new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

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
        <div className="dashboard-hero__signal" aria-label="Studio status">
          <span className="dashboard-live-dot" />
          <div>
            <span>Studio status</span>
            <strong>{loading ? "Gegevens laden…" : "Klaar voor de volgende print"}</strong>
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
            <button onClick={() => navigate("/inventaris") }><Boxes size={19} /><span><strong>Inventaris</strong><small>Producten & voorraad</small></span><ChevronRight size={17} /></button>
            <button onClick={() => navigate("/prints") }><CircleDollarSign size={19} /><span><strong>Printresultaten</strong><small>Omzet & winst</small></span><ChevronRight size={17} /></button>
          </div>
        </aside>
      </section>
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
