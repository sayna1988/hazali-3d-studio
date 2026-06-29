import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  BadgePercent,
  Bell,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  LoaderCircle,
  PackageOpen,
  Search,
  SlidersHorizontal,
  Store,
  Tag,
  X,
} from "lucide-react";
import Page from "../components/Page/Page";
import { useAuth } from "../auth/AuthProvider";
import {
  createDealTrackerRule,
  loadDealPriceHistory,
  loadDealtrackerOffers,
  loadDealtrackerRunInfo,
  type DealPriceHistoryPoint,
  type DealtrackerOffer,
} from "../services/DealtrackerService";
import "./Dealtracker.css";

type Sortering = "prijs-kg" | "totaalprijs" | "korting" | "nieuwste" | "controle";

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const compactEuro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const STALE_AFTER_MS = 8 * 60 * 60 * 1000;
const PAGE_SIZE = 12;

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "nl"));
}

function kgLabel(grams: number) {
  if (!grams) return "Onbekend";
  return `${(grams / 1000).toLocaleString("nl-NL", { maximumFractionDigits: 2 })} kg`;
}

function checkedLabel(value: string | null) {
  if (!value) return "Nog niet gecontroleerd";
  return dateTime.format(new Date(value));
}

function stockLabel(status: DealtrackerOffer["stockStatus"]) {
  if (status === "in_stock") return "Op voorraad";
  if (status === "out_of_stock") return "Uitverkocht";
  if (status === "backorder") return "Nabestelling";
  if (status === "preorder") return "Pre-order";
  return "Voorraad onbekend";
}

function discountPercent(offer: DealtrackerOffer) {
  if (!offer.normalPrice || offer.normalPrice <= offer.productPrice) return 0;
  return Math.round(((offer.normalPrice - offer.productPrice) / offer.normalPrice) * 100);
}

function isStale(value: string | null, nowMs: number) {
  if (!value) return true;
  return nowMs - new Date(value).getTime() > STALE_AFTER_MS;
}

export default function Dealtracker() {
  const { session } = useAuth();
  const [offers, setOffers] = useState<DealtrackerOffer[]>([]);
  const [lastSuccessfulCheckAt, setLastSuccessfulCheckAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [zoekterm, setZoekterm] = useState("");
  const [materiaal, setMateriaal] = useState("Alle");
  const [merk, setMerk] = useState("Alle");
  const [winkel, setWinkel] = useState("Alle");
  const [kleur, setKleur] = useState("Alle");
  const [diameter, setDiameter] = useState("Alle");
  const [minRolgewicht, setMinRolgewicht] = useState(750);
  const [maxPrijsKg, setMaxPrijsKg] = useState("");
  const [alleenOpVoorraad, setAlleenOpVoorraad] = useState(true);
  const [alleenBekendeVerzending, setAlleenBekendeVerzending] = useState(false);
  const [sortering, setSortering] = useState<Sortering>("prijs-kg");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedOffer, setSelectedOffer] = useState<DealtrackerOffer | null>(null);
  const [nowMs] = useState(() => Date.now());

  async function laden() {
    setLoading(true);
    setError("");
    try {
      const [offerData, runInfo] = await Promise.all([loadDealtrackerOffers(), loadDealtrackerRunInfo()]);
      setOffers(offerData);
      setLastSuccessfulCheckAt(runInfo.lastSuccessfulCheckAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dealtracker laden is mislukt.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void laden(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisibleCount(PAGE_SIZE), 0);
    return () => window.clearTimeout(timer);
  }, [zoekterm, materiaal, merk, winkel, kleur, diameter, minRolgewicht, maxPrijsKg, alleenOpVoorraad, alleenBekendeVerzending, sortering]);

  const filterOptions = useMemo(() => ({
    materialen: ["Alle", ...unique(offers.map((offer) => offer.material))],
    merken: ["Alle", ...unique(offers.map((offer) => offer.brand))],
    winkels: ["Alle", ...unique(offers.map((offer) => offer.retailerName))],
    kleuren: ["Alle", ...unique(offers.map((offer) => offer.color))],
    diameters: ["Alle", ...unique(offers.map((offer) => offer.diameterMm ? `${offer.diameterMm} mm` : null))],
  }), [offers]);

  const filtered = useMemo(() => {
    const query = zoekterm.trim().toLowerCase();
    const max = Number(maxPrijsKg.replace(",", "."));
    return offers
      .filter((offer) => materiaal === "Alle" || offer.material === materiaal)
      .filter((offer) => merk === "Alle" || offer.brand === merk)
      .filter((offer) => winkel === "Alle" || offer.retailerName === winkel)
      .filter((offer) => kleur === "Alle" || offer.color === kleur)
      .filter((offer) => diameter === "Alle" || `${offer.diameterMm} mm` === diameter)
      .filter((offer) => offer.spoolWeightGrams >= minRolgewicht)
      .filter((offer) => !Number.isFinite(max) || max <= 0 || offer.pricePerKg <= max)
      .filter((offer) => !alleenOpVoorraad || offer.stockStatus === "in_stock")
      .filter((offer) => !alleenBekendeVerzending || offer.shippingCostKnown)
      .filter((offer) => !query || [offer.productName, offer.brand, offer.material, offer.color, offer.retailerName].some((value) => String(value).toLowerCase().includes(query)))
      .sort((a, b) => {
        if (sortering === "totaalprijs") return a.totalPrice - b.totalPrice;
        if (sortering === "korting") return discountPercent(b) - discountPercent(a);
        if (sortering === "nieuwste") return b.id.localeCompare(a.id);
        if (sortering === "controle") return new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime();
        return a.pricePerKg - b.pricePerKg;
      });
  }, [offers, materiaal, merk, winkel, kleur, diameter, minRolgewicht, maxPrijsKg, alleenOpVoorraad, alleenBekendeVerzending, zoekterm, sortering]);

  const knownShippingOffers = offers.filter((offer) => offer.shippingCostKnown && offer.stockStatus === "in_stock");
  const cheapest = knownShippingOffers.toSorted((a, b) => a.pricePerKg - b.pricePerKg)[0];
  const averagePrice = knownShippingOffers.length
    ? knownShippingOffers.reduce((sum, offer) => sum + offer.pricePerKg, 0) / knownShippingOffers.length
    : 0;
  const activeDeals = offers.length;
  const topDeals = offers.filter((offer) => offer.shippingCostKnown && offer.stockStatus === "in_stock" && offer.pricePerKg <= 15).length;
  const stale = isStale(lastSuccessfulCheckAt, nowMs);
  const visibleOffers = filtered.slice(0, visibleCount);

  return (
    <Page title="Dealtracker" subtitle="Volg filamentaanbiedingen met werkelijke prijs per kilogram, inclusief bekende verzendkosten.">
      <section className="dealtracker-stats" aria-label="Dealtracker overzicht">
        <article className="deal-stat deal-stat--primary">
          <span className="deal-stat__icon"><CircleDollarSign size={21} /></span>
          <div><span>Goedkoopste all-in deal</span><strong>{cheapest ? euro.format(cheapest.pricePerKg) : "Geen bekende all-in deal"}</strong></div>
          <small>{cheapest ? `${cheapest.brand} · ${cheapest.color} · ${cheapest.retailerName}` : "Onbekende verzendkosten tellen niet mee als all-in goedkoopste."}</small>
        </article>
        <article className="deal-stat">
          <span className="deal-stat__icon deal-stat__icon--green"><BadgePercent size={21} /></span>
          <div><span>Gemiddeld per kg</span><strong>{knownShippingOffers.length ? euro.format(averagePrice) : "Onbekend"}</strong></div>
          <small>Alleen aanbiedingen met bekende verzendkosten</small>
        </article>
        <article className="deal-stat">
          <span className="deal-stat__icon deal-stat__icon--orange"><Tag size={21} /></span>
          <div><span>Actieve aanbiedingen</span><strong>{activeDeals}</strong></div>
          <small>{topDeals} topdeals onder €15/kg</small>
        </article>
        <article className={`deal-stat ${stale ? "is-stale" : ""}`}>
          <span className="deal-stat__icon deal-stat__icon--warning"><Clock3 size={21} /></span>
          <div><span>Laatste controle</span><strong>{checkedLabel(lastSuccessfulCheckAt)}</strong></div>
          <small>{stale ? "Gegevens zijn ouder dan verwacht." : "Controle is recent."}</small>
        </article>
      </section>

      {stale && (
        <div className="dealtracker-warning" role="status">
          <AlertTriangle size={18} />
          <span>De dealtrackergegevens zijn mogelijk verouderd. Controleer de prijs altijd bij de webwinkel voordat je bestelt.</span>
        </div>
      )}

      <section className="deal-filter-panel" aria-label="Dealtracker filters">
        <div className="deal-filter-search">
          <Search size={18} />
          <input value={zoekterm} onChange={(event) => setZoekterm(event.target.value)} placeholder="Zoek op product, merk, kleur of winkel..." />
          {zoekterm && <button type="button" onClick={() => setZoekterm("")} aria-label="Zoekopdracht wissen"><X size={16} /></button>}
        </div>
        <div className="deal-filter-grid">
          <SelectFilter label="Materiaal" value={materiaal} onChange={setMateriaal} options={filterOptions.materialen} />
          <SelectFilter label="Merk" value={merk} onChange={setMerk} options={filterOptions.merken} />
          <SelectFilter label="Webwinkel" value={winkel} onChange={setWinkel} options={filterOptions.winkels} />
          <SelectFilter label="Kleur" value={kleur} onChange={setKleur} options={filterOptions.kleuren} />
          <SelectFilter label="Diameter" value={diameter} onChange={setDiameter} options={filterOptions.diameters} />
          <label className="deal-filter-field"><span>Min. rolgewicht</span><input type="number" min="0" step="50" value={minRolgewicht} onChange={(event) => setMinRolgewicht(Number(event.target.value))} /></label>
          <label className="deal-filter-field"><span>Max €/kg</span><input inputMode="decimal" value={maxPrijsKg} onChange={(event) => setMaxPrijsKg(event.target.value)} placeholder="Bijv. 15" /></label>
          <label className="deal-filter-field deal-filter-field--sort"><span><ArrowUpDown size={14} /> Sortering</span><select value={sortering} onChange={(event) => setSortering(event.target.value as Sortering)}><option value="prijs-kg">Laagste prijs/kg</option><option value="totaalprijs">Laagste totaalprijs</option><option value="korting">Grootste korting</option><option value="nieuwste">Nieuwste aanbieding</option><option value="controle">Recent gecontroleerd</option></select></label>
        </div>
        <div className="deal-filter-toggles">
          <label><input type="checkbox" checked={alleenOpVoorraad} onChange={(event) => setAlleenOpVoorraad(event.target.checked)} /> Alleen op voorraad</label>
          <label><input type="checkbox" checked={alleenBekendeVerzending} onChange={(event) => setAlleenBekendeVerzending(event.target.checked)} /> Alleen bekende verzendkosten</label>
          <button type="button" onClick={() => { setMateriaal("Alle"); setMerk("Alle"); setWinkel("Alle"); setKleur("Alle"); setDiameter("Alle"); setMinRolgewicht(750); setMaxPrijsKg(""); setAlleenOpVoorraad(true); setAlleenBekendeVerzending(false); setZoekterm(""); }}><SlidersHorizontal size={16} /> Filters wissen</button>
        </div>
      </section>

      {loading ? (
        <div className="deal-state"><LoaderCircle className="deal-spin" size={28} /><h2>Aanbiedingen laden</h2><p>Hazali haalt de laatst opgeslagen dealtrackergegevens op.</p></div>
      ) : error ? (
        <div className="deal-state deal-state--error"><AlertTriangle size={30} /><h2>Dealtracker kon niet laden</h2><p>{error}</p><button type="button" onClick={() => void laden()}>Opnieuw proberen</button></div>
      ) : visibleOffers.length ? (
        <>
          <div className="deal-results-head"><span>{filtered.length} aanbiedingen gevonden</span><span>{filtered.filter((offer) => !offer.shippingCostKnown).length} met onbekende verzendkosten</span></div>
          <section className="deal-grid" aria-label="Filamentaanbiedingen">
            {visibleOffers.map((offer) => <DealCard key={offer.id} offer={offer} onDetails={setSelectedOffer} />)}
          </section>
          {visibleCount < filtered.length && <button className="deal-load-more" type="button" onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}>Meer aanbiedingen laden</button>}
        </>
      ) : (
        <div className="deal-state"><PackageOpen size={30} /><h2>Geen aanbiedingen gevonden</h2><p>Pas je filters aan of wacht tot de volgende achtergrondcontrole is voltooid.</p></div>
      )}

      {selectedOffer && <DealDetailModal offer={selectedOffer} userId={session?.user.id} onClose={() => setSelectedOffer(null)} />}
    </Page>
  );
}

function SelectFilter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="deal-filter-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select>
      <ChevronDown size={14} />
    </label>
  );
}

function DealCard({ offer, onDetails }: { offer: DealtrackerOffer; onDetails: (offer: DealtrackerOffer) => void }) {
  const discount = discountPercent(offer);
  return (
    <article className="deal-card">
      <div className="deal-card__image">{offer.imageUrl ? <img src={offer.imageUrl} alt="" loading="lazy" /> : <PackageOpen size={28} />}{discount > 0 && <span>-{discount}%</span>}</div>
      <div className="deal-card__body">
        <div className="deal-card__meta"><span>{offer.retailerName}</span><span className={`stock stock--${offer.stockStatus}`}>{stockLabel(offer.stockStatus)}</span></div>
        <h2>{offer.productName}</h2>
        <div className="deal-tags"><span>{offer.brand}</span><span>{offer.material}</span><span>{offer.color}</span>{offer.diameterMm && <span>{offer.diameterMm} mm</span>}</div>
        <dl className="deal-price-grid">
          <div><dt>Prijs/kg</dt><dd>{euro.format(offer.pricePerKg)}</dd></div>
          <div><dt>Totaalprijs</dt><dd>{euro.format(offer.totalPrice)}</dd></div>
          <div><dt>Productprijs</dt><dd>{euro.format(offer.productPrice)}</dd></div>
          <div><dt>Verzending</dt><dd>{offer.shippingCostKnown ? euro.format(offer.shippingCost) : "Onbekend"}</dd></div>
        </dl>
        <div className="deal-card__small">
          <span>{offer.spoolCount} × {kgLabel(offer.spoolWeightGrams)} · {kgLabel(offer.totalWeightGrams)} totaal</span>
          {offer.normalPrice && <span>Normaal {euro.format(offer.normalPrice)}</span>}
          <span>Laatst gecontroleerd {checkedLabel(offer.checkedAt)}</span>
        </div>
      </div>
      <div className="deal-card__actions">
        <button type="button" onClick={() => onDetails(offer)}>Details</button>
        <a href={offer.productUrl} target="_blank" rel="noopener noreferrer">Bekijk aanbieding <ExternalLink size={15} /></a>
      </div>
    </article>
  );
}

function DealDetailModal({ offer, userId, onClose }: { offer: DealtrackerOffer; userId?: string; onClose: () => void }) {
  const [history, setHistory] = useState<DealPriceHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [alertOpen, setAlertOpen] = useState(false);
  const [maxPrice, setMaxPrice] = useState(String(Math.max(1, Math.floor(offer.pricePerKg))));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      loadDealPriceHistory(offer.id)
        .then((data) => { if (active) setHistory(data); })
        .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Prijshistorie laden is mislukt."); })
        .finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [offer.id]);

  const points = history.length ? history : [{
    id: offer.id,
    offerId: offer.id,
    productPrice: offer.productPrice,
    normalPrice: offer.normalPrice,
    directDiscount: offer.directDiscount,
    shippingCostKnown: offer.shippingCostKnown,
    shippingCost: offer.shippingCost,
    totalPrice: offer.totalPrice,
    pricePerKg: offer.pricePerKg,
    stockStatus: offer.stockStatus,
    checkedAt: offer.checkedAt,
  }];
  const lowest = Math.min(...points.map((point) => point.pricePerKg));
  const highest = Math.max(...points.map((point) => point.pricePerKg));
  const [detailNowMs] = useState(() => Date.now());
  const thirtyDaysAgo = detailNowMs - 30 * 24 * 60 * 60 * 1000;
  const recent = points.filter((point) => new Date(point.checkedAt).getTime() >= thirtyDaysAgo);
  const average30 = (recent.length ? recent : points).reduce((sum, point) => sum + point.pricePerKg, 0) / (recent.length || points.length);

  async function saveAlert() {
    if (!userId) return setError("Log opnieuw in om een prijsalarm op te slaan.");
    setSaving(true);
    setError("");
    try {
      await createDealTrackerRule({
        userId,
        material: offer.material,
        brand: offer.brand,
        retailerId: offer.retailerId,
        maxPricePerKg: Number(maxPrice.replace(",", ".")),
        minSpoolWeightGrams: offer.spoolWeightGrams,
        inStockOnly: true,
      });
      setSaved(true);
      setAlertOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prijsalarm opslaan is mislukt.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="deal-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="deal-detail-title" onMouseDown={onClose}>
      <section className="deal-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header className="deal-modal__header">
          <div><span><Store size={15} /> {offer.retailerName}</span><h2 id="deal-detail-title">{offer.productName}</h2></div>
          <button type="button" onClick={onClose} aria-label="Details sluiten"><X size={20} /></button>
        </header>
        <div className="deal-modal__stats">
          <Metric label="Laagste prijs" value={euro.format(lowest)} />
          <Metric label="Gemiddeld 30 dagen" value={euro.format(average30)} />
          <Metric label="Huidig" value={euro.format(offer.pricePerKg)} />
          <Metric label="Hoogste prijs" value={euro.format(highest)} />
        </div>
        {loading ? <div className="deal-history-state"><LoaderCircle className="deal-spin" size={24} /> Prijshistorie laden</div> : error ? <div className="deal-history-state error">{error}</div> : <HistoryChart points={points} />}
        <div className="deal-modal__checks">
          <h3>Laatste controles</h3>
          {points.toSorted((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()).slice(0, 6).map((point) => (
            <div key={point.id}><span>{checkedLabel(point.checkedAt)}</span><strong>{euro.format(point.pricePerKg)}</strong><small>{stockLabel(point.stockStatus)}</small></div>
          ))}
        </div>
        {saved && <div className="deal-alert-saved"><Check size={16} /> Prijsalarm opgeslagen.</div>}
        {alertOpen && (
          <form className="deal-alert-form" onSubmit={(event) => { event.preventDefault(); void saveAlert(); }}>
            <label><span>Waarschuw onder €/kg</span><input inputMode="decimal" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} /></label>
            <button type="submit" disabled={saving}>{saving ? "Opslaan..." : "Prijsalarm opslaan"}</button>
          </form>
        )}
        <footer className="deal-modal__footer">
          <button type="button" onClick={() => setAlertOpen((open) => !open)}><Bell size={16} /> Prijsalarm instellen</button>
          <a href={offer.productUrl} target="_blank" rel="noopener noreferrer">Bekijk aanbieding <ExternalLink size={15} /></a>
        </footer>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function HistoryChart({ points }: { points: DealPriceHistoryPoint[] }) {
  const min = Math.min(...points.map((point) => point.pricePerKg));
  const max = Math.max(...points.map((point) => point.pricePerKg));
  const range = Math.max(0.01, max - min);
  return (
    <div className="deal-history-chart" aria-label="Prijshistorie">
      {points.slice(-18).map((point) => {
        const height = 18 + ((point.pricePerKg - min) / range) * 72;
        return <span key={point.id} style={{ height: `${height}%` }} title={`${checkedLabel(point.checkedAt)} · ${compactEuro.format(point.pricePerKg)}`} />;
      })}
    </div>
  );
}
