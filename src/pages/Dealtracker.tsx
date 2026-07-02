import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  BadgePercent,
  Bell,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Edit3,
  ExternalLink,
  LoaderCircle,
  PackageOpen,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Store,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import Page from "../components/Page/Page";
import { useAuth } from "../auth/AuthProvider";
import {
  createDealTrackerRule,
  createDealRetailer,
  deleteDealTrackerRule,
  loadDealPriceHistory,
  loadDealRetailers,
  loadDealTrackerRules,
  loadDealtrackerOffers,
  loadDealtrackerRunInfo,
  updateDealRetailerActive,
  updateDealTrackerRule,
  type DealPriceHistoryPoint,
  type DealRetailerView,
  type DealTrackerRuleView,
  type DealtrackerOffer,
} from "../services/DealtrackerService";
import "./Dealtracker.css";

type Sortering = "prijs-kg" | "totaalprijs" | "korting" | "nieuwste" | "controle";
type AlertEditorState = { mode: "create"; offer: DealtrackerOffer } | { mode: "edit"; rule: DealTrackerRuleView } | null;
type ActiveAlertEditor = Exclude<AlertEditorState, null>;

type AlertFormState = {
  label: string;
  productId: string | null;
  material: string;
  brand: string;
  retailerId: string | null;
  maxPricePerKg: string;
  minTotalWeightGrams: number;
  inStockOnly: boolean;
  requireKnownShipping: boolean;
  active: boolean;
};

type RetailerFormState = {
  name: string;
  domain: string;
  feedUrl: string;
  active: boolean;
};

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
  const userId = session?.user.id;
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
  const [retailers, setRetailers] = useState<DealRetailerView[]>([]);
  const [retailersLoading, setRetailersLoading] = useState(false);
  const [retailerError, setRetailerError] = useState("");
  const [rules, setRules] = useState<DealTrackerRuleView[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [ruleError, setRuleError] = useState("");
  const [alertEditor, setAlertEditor] = useState<AlertEditorState>(null);
  const [nowMs] = useState(() => Date.now());

  const laden = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const offerData = await loadDealtrackerOffers();
      const [runInfo, ruleData, retailerData] = await Promise.all([
        loadDealtrackerRunInfo().catch(() => ({ lastSuccessfulCheckAt: null })),
        userId ? loadDealTrackerRules().catch(() => []) : Promise.resolve([]),
        userId ? loadDealRetailers().catch(() => []) : Promise.resolve([]),
      ]);
      setOffers(offerData);
      setLastSuccessfulCheckAt(runInfo.lastSuccessfulCheckAt);
      setRules(ruleData);
      setRetailers(retailerData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dealtracker laden is mislukt.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  async function reloadRules() {
    if (!userId) return setRules([]);
    setRulesLoading(true);
    setRuleError("");
    try {
      setRules(await loadDealTrackerRules());
    } catch (err) {
      setRuleError(err instanceof Error ? err.message : "Prijsalerts laden is mislukt.");
    } finally {
      setRulesLoading(false);
    }
  }

  async function reloadRetailers() {
    if (!userId) return setRetailers([]);
    setRetailersLoading(true);
    setRetailerError("");
    try {
      setRetailers(await loadDealRetailers());
    } catch (err) {
      setRetailerError(err instanceof Error ? err.message : "Retailers laden is mislukt.");
    } finally {
      setRetailersLoading(false);
    }
  }

  async function toggleRetailer(retailer: DealRetailerView) {
    if (!session?.access_token) return setRetailerError("Log opnieuw in om retailers te beheren.");
    setRetailerError("");
    try {
      await updateDealRetailerActive(retailer.id, !retailer.active, session.access_token);
      await reloadRetailers();
    } catch (err) {
      setRetailerError(err instanceof Error ? err.message : "Retailer aanpassen is mislukt.");
    }
  }

  async function saveRetailer(input: RetailerFormState) {
    if (!session?.access_token) return setRetailerError("Log opnieuw in om retailers te beheren.");
    setRetailerError("");
    try {
      await createDealRetailer({
        name: input.name,
        domain: input.domain,
        adapterKey: "joybuy-nl",
        adapterType: "affiliate_feed",
        feedUrl: input.feedUrl,
        active: input.active,
      }, session.access_token);
      await reloadRetailers();
    } catch (err) {
      setRetailerError(err instanceof Error ? err.message : "Retailer opslaan is mislukt.");
      throw err;
    }
  }

  async function toggleRule(rule: DealTrackerRuleView) {
    setRuleError("");
    try {
      await updateDealTrackerRule(rule.id, { active: !rule.active });
      await reloadRules();
    } catch (err) {
      setRuleError(err instanceof Error ? err.message : "Prijsalert aanpassen is mislukt.");
    }
  }

  async function removeRule(rule: DealTrackerRuleView) {
    if (!window.confirm("Prijsalert verwijderen?")) return;
    setRuleError("");
    try {
      await deleteDealTrackerRule(rule.id);
      await reloadRules();
    } catch (err) {
      setRuleError(err instanceof Error ? err.message : "Prijsalert verwijderen is mislukt.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void laden(), 0);
    return () => window.clearTimeout(timer);
  }, [laden]);

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

      <RetailerManagerPanel
        retailers={retailers}
        loading={retailersLoading}
        error={retailerError}
        isAuthenticated={Boolean(userId)}
        onReload={() => void reloadRetailers()}
        onToggle={(retailer) => void toggleRetailer(retailer)}
        onSave={(input) => saveRetailer(input)}
      />

      <PriceAlertsPanel
        rules={rules}
        offers={offers}
        loading={rulesLoading}
        error={ruleError}
        isAuthenticated={Boolean(userId)}
        onCreateFromCheapest={cheapest ? () => setAlertEditor({ mode: "create", offer: cheapest }) : undefined}
        onEdit={(rule) => setAlertEditor({ mode: "edit", rule })}
        onToggle={(rule) => void toggleRule(rule)}
        onDelete={(rule) => void removeRule(rule)}
      />

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

      {selectedOffer && (
        <DealDetailModal
          offer={selectedOffer}
          onCreateAlert={(offer) => setAlertEditor({ mode: "create", offer })}
          onClose={() => setSelectedOffer(null)}
        />
      )}
      {alertEditor && (
        <PriceAlertModal
          key={alertEditor.mode === "edit" ? alertEditor.rule.id : alertEditor.offer.id}
          editor={alertEditor}
          offers={offers}
          userId={userId}
          onClose={() => setAlertEditor(null)}
          onSaved={() => {
            setAlertEditor(null);
            void reloadRules();
          }}
        />
      )}
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

function DealDetailModal({ offer, onCreateAlert, onClose }: { offer: DealtrackerOffer; onCreateAlert: (offer: DealtrackerOffer) => void; onClose: () => void }) {
  const [history, setHistory] = useState<DealPriceHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        <footer className="deal-modal__footer">
          <button type="button" onClick={() => onCreateAlert(offer)}><Bell size={16} /> Prijsalarm instellen</button>
          <a href={offer.productUrl} target="_blank" rel="noopener noreferrer">Bekijk aanbieding <ExternalLink size={15} /></a>
        </footer>
      </section>
    </div>
  );
}

function RetailerManagerPanel({
  retailers,
  loading,
  error,
  isAuthenticated,
  onReload,
  onToggle,
  onSave,
}: {
  retailers: DealRetailerView[];
  loading: boolean;
  error: string;
  isAuthenticated: boolean;
  onReload: () => void;
  onToggle: (retailer: DealRetailerView) => void;
  onSave: (input: RetailerFormState) => Promise<void>;
}) {
  const [form, setForm] = useState<RetailerFormState>({
    name: "Joybuy",
    domain: "www.joybuy.nl",
    feedUrl: "",
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");
  const canSave = form.name.trim().length > 0 && form.domain.trim().length > 0 && /^https?:\/\//i.test(form.feedUrl.trim());

  async function submit() {
    setLocalError("");
    if (!canSave) {
      setLocalError("Vul naam, domein en een geldige feed-URL in.");
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
      setForm((current) => ({ ...current, feedUrl: "" }));
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Retailer opslaan is mislukt.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="deal-retailers-panel" aria-label="Retailerbronnen">
      <div className="deal-retailers-panel__head">
        <div>
          <span><Store size={15} /> Retailerbronnen</span>
          <h2>Webwinkels die door de dealtracker worden gecontroleerd</h2>
        </div>
        <button type="button" onClick={onReload} disabled={!isAuthenticated || loading}><RefreshCw size={16} /> Vernieuwen</button>
      </div>

      {!isAuthenticated ? (
        <p className="deal-retailers-panel__note">Log in om retailers toe te voegen of te activeren.</p>
      ) : (
        <>
          <form className="deal-retailer-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            <label>
              <span>Adapter</span>
              <select value="joybuy-nl" disabled aria-label="Adapter">
                <option value="joybuy-nl">Joybuy NL feed</option>
              </select>
            </label>
            <label>
              <span>Naam</span>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Joybuy" />
            </label>
            <label>
              <span>Domein</span>
              <input value={form.domain} onChange={(event) => setForm({ ...form, domain: event.target.value })} placeholder="www.joybuy.nl" />
            </label>
            <label className="deal-retailer-form__wide">
              <span>Officiele feed-URL</span>
              <input value={form.feedUrl} onChange={(event) => setForm({ ...form, feedUrl: event.target.value })} placeholder="https://..." />
            </label>
            <label className="deal-retailer-form__check">
              <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
              Actief
            </label>
            <button type="submit" disabled={saving || !canSave}><Plus size={16} /> {saving ? "Opslaan..." : "Retailer opslaan"}</button>
          </form>
          {(localError || error) && <p className="deal-retailers-panel__note is-error">{localError || error}</p>}
          <div className="deal-retailer-list">
            {loading ? (
              <p className="deal-retailers-panel__note"><LoaderCircle className="deal-spin" size={17} /> Retailers laden...</p>
            ) : retailers.length ? (
              retailers.map((retailer) => (
                <article className="deal-retailer-row" key={retailer.id}>
                  <label>
                    <input type="checkbox" checked={retailer.active} onChange={() => onToggle(retailer)} />
                    <span>{retailer.active ? "Actief" : "Inactief"}</span>
                  </label>
                  <div>
                    <strong>{retailer.name}</strong>
                    <p>{retailer.domain} · {retailer.adapterKey} · {retailer.feedUrl ? "feed ingesteld" : "geen feed"}</p>
                    <small>Laatst succesvol gecontroleerd: {checkedLabel(retailer.lastSuccessfulCheckAt)}</small>
                  </div>
                </article>
              ))
            ) : (
              <p className="deal-retailers-panel__note">Nog geen retailers. Voeg eerst een officiele feedbron toe.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function PriceAlertsPanel({
  rules,
  offers,
  loading,
  error,
  isAuthenticated,
  onCreateFromCheapest,
  onEdit,
  onToggle,
  onDelete,
}: {
  rules: DealTrackerRuleView[];
  offers: DealtrackerOffer[];
  loading: boolean;
  error: string;
  isAuthenticated: boolean;
  onCreateFromCheapest?: () => void;
  onEdit: (rule: DealTrackerRuleView) => void;
  onToggle: (rule: DealTrackerRuleView) => void;
  onDelete: (rule: DealTrackerRuleView) => void;
}) {
  return (
    <section className="deal-alerts-panel" aria-label="Mijn prijsalerts">
      <div className="deal-alerts-panel__head">
        <div>
          <span><Bell size={15} /> Mijn prijsalerts</span>
          <h2>Waarschuw mij bij goede filamentdeals</h2>
        </div>
        {onCreateFromCheapest && <button type="button" onClick={onCreateFromCheapest}><Bell size={16} /> Nieuwe alert</button>}
      </div>

      {!isAuthenticated ? (
        <p className="deal-alerts-panel__note">Log in om persoonlijke prijsalerts te beheren.</p>
      ) : loading ? (
        <p className="deal-alerts-panel__note"><LoaderCircle className="deal-spin" size={17} /> Prijsalerts laden...</p>
      ) : error ? (
        <p className="deal-alerts-panel__note is-error">{error}</p>
      ) : rules.length ? (
        <div className="deal-alerts-list">
          {rules.map((rule) => {
            const offer = offers.find((item) => item.productId === rule.productId);
            return (
              <article className="deal-alert-rule" key={rule.id}>
                <div>
                  <div className="deal-alert-rule__title">
                    <strong>{rule.label || offer?.productName || `${rule.material}${rule.brand ? ` - ${rule.brand}` : ""}`}</strong>
                    <span className={rule.active ? "is-active" : "is-paused"}>{rule.active ? "Actief" : "Gepauzeerd"}</span>
                  </div>
                  <p>
                    Max {euro.format(rule.maxPricePerKg)}/kg, minimaal {kgLabel(rule.minTotalWeightGrams)} totaal
                    {rule.retailerName ? ` bij ${rule.retailerName}` : ""}
                    {rule.requireKnownShipping ? ", alleen bekende all-in prijs" : ""}
                    {rule.inStockOnly ? ", alleen op voorraad" : ""}
                  </p>
                  <small>Laatst geactiveerd: {rule.lastTriggeredAt ? checkedLabel(rule.lastTriggeredAt) : "Nog nooit"}</small>
                </div>
                <div className="deal-alert-rule__actions">
                  <button type="button" onClick={() => onEdit(rule)} aria-label="Prijsalert bewerken"><Edit3 size={15} /></button>
                  <button type="button" onClick={() => onToggle(rule)} aria-label={rule.active ? "Prijsalert pauzeren" : "Prijsalert hervatten"}>
                    {rule.active ? <Pause size={15} /> : <Play size={15} />}
                  </button>
                  <button type="button" onClick={() => onDelete(rule)} aria-label="Prijsalert verwijderen"><Trash2 size={15} /></button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="deal-alerts-panel__note">Nog geen prijsalerts. Open een aanbieding en stel je eerste prijsalarm in.</p>
      )}
    </section>
  );
}

function PriceAlertModal({
  editor,
  offers,
  userId,
  onClose,
  onSaved,
}: {
  editor: ActiveAlertEditor;
  offers: DealtrackerOffer[];
  userId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const sourceOffer = editor.mode === "create" ? editor.offer : offers.find((offer) => offer.productId === editor.rule.productId);
  const retailerOptions = useMemo(() => {
    const map = new Map<string, string>();
    offers.forEach((offer) => map.set(offer.retailerId, offer.retailerName));
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "nl"));
  }, [offers]);
  const [form, setForm] = useState<AlertFormState>(() => {
    if (editor.mode === "edit") {
      return {
        label: editor.rule.label ?? "",
        productId: editor.rule.productId,
        material: editor.rule.material,
        brand: editor.rule.brand ?? "",
        retailerId: editor.rule.retailerId,
        maxPricePerKg: String(editor.rule.maxPricePerKg),
        minTotalWeightGrams: editor.rule.minTotalWeightGrams,
        inStockOnly: editor.rule.inStockOnly,
        requireKnownShipping: editor.rule.requireKnownShipping,
        active: editor.rule.active,
      };
    }
    return {
      label: editor.offer.productName,
      productId: editor.offer.productId,
      material: String(editor.offer.material),
      brand: editor.offer.brand,
      retailerId: editor.offer.retailerId,
      maxPricePerKg: String(Math.max(1, Math.floor(editor.offer.pricePerKg))),
      minTotalWeightGrams: editor.offer.totalWeightGrams || editor.offer.spoolWeightGrams,
      inStockOnly: true,
      requireKnownShipping: true,
      active: true,
    };
  });

  const maxPrice = Number(form.maxPricePerKg.replace(",", "."));
  const canSave = Boolean(userId) && Number.isFinite(maxPrice) && maxPrice > 0 && form.minTotalWeightGrams >= 0 && form.material.trim().length > 0;

  async function save() {
    if (!userId) return setError("Log opnieuw in om een prijsalert op te slaan.");
    if (!canSave) return setError("Controleer materiaal, maximale prijs en minimaal totaalgewicht.");
    setSaving(true);
    setError("");
    try {
      const payload = {
        userId,
        productId: form.productId,
        material: form.material.trim(),
        brand: form.brand.trim() || null,
        retailerId: form.retailerId,
        maxPricePerKg: maxPrice,
        minTotalWeightGrams: form.minTotalWeightGrams,
        inStockOnly: form.inStockOnly,
        requireKnownShipping: form.requireKnownShipping,
        label: form.label.trim() || null,
      };
      if (editor.mode === "edit") await updateDealTrackerRule(editor.rule.id, { ...payload, active: form.active });
      else await createDealTrackerRule(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prijsalert opslaan is mislukt.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="deal-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="deal-alert-title" onMouseDown={onClose}>
      <section className="deal-modal deal-alert-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header className="deal-modal__header">
          <div>
            <span><Bell size={15} /> Prijsalarm</span>
            <h2 id="deal-alert-title">{editor.mode === "edit" ? "Prijsalert bewerken" : "Prijsalarm instellen"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Prijsalarm sluiten"><X size={20} /></button>
        </header>
        <form className="deal-alert-editor" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          {sourceOffer && (
            <div className="deal-alert-source">
              <strong>{sourceOffer.productName}</strong>
              <span>{sourceOffer.retailerName} - {sourceOffer.brand} - {sourceOffer.color} - {euro.format(sourceOffer.pricePerKg)}/kg</span>
            </div>
          )}
          {error && <div className="deal-alert-editor__error">{error}</div>}
          <label className="deal-alert-editor__field">
            <span>Naam</span>
            <input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="Bijv. PLA onder 15 euro/kg" />
          </label>
          <label className="deal-alert-editor__check">
            <input type="checkbox" checked={Boolean(form.productId)} onChange={(event) => setForm({ ...form, productId: event.target.checked ? sourceOffer?.productId ?? form.productId : null })} disabled={!sourceOffer} />
            Alleen dit product
          </label>
          <div className="deal-alert-editor__grid">
            <label className="deal-alert-editor__field">
              <span>Materiaal</span>
              <input value={form.material} onChange={(event) => setForm({ ...form, material: event.target.value })} />
            </label>
            <label className="deal-alert-editor__field">
              <span>Merk optioneel</span>
              <input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} placeholder="Alle merken" />
            </label>
            <label className="deal-alert-editor__field">
              <span>Webwinkel optioneel</span>
              <select value={form.retailerId ?? ""} onChange={(event) => setForm({ ...form, retailerId: event.target.value || null })}>
                <option value="">Alle webwinkels</option>
                {retailerOptions.map((retailer) => <option key={retailer.id} value={retailer.id}>{retailer.name}</option>)}
              </select>
            </label>
            <label className="deal-alert-editor__field">
              <span>Max bedrag per kg</span>
              <input inputMode="decimal" value={form.maxPricePerKg} onChange={(event) => setForm({ ...form, maxPricePerKg: event.target.value })} />
            </label>
            <label className="deal-alert-editor__field">
              <span>Minimaal totaalgewicht gram</span>
              <input type="number" min="0" step="50" value={form.minTotalWeightGrams} onChange={(event) => setForm({ ...form, minTotalWeightGrams: Number(event.target.value) })} />
            </label>
          </div>
          <div className="deal-alert-editor__checks">
            <label><input type="checkbox" checked={form.inStockOnly} onChange={(event) => setForm({ ...form, inStockOnly: event.target.checked })} /> Alleen op voorraad</label>
            <label><input type="checkbox" checked={form.requireKnownShipping} onChange={(event) => setForm({ ...form, requireKnownShipping: event.target.checked })} /> Alleen bekende all-in prijs</label>
            {editor.mode === "edit" && <label><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Alert actief</label>}
          </div>
          <footer className="deal-modal__footer">
            <button type="button" onClick={onClose}>Annuleren</button>
            <button type="submit" disabled={saving || !canSave}>{saving ? "Opslaan..." : "Opslaan"}</button>
          </footer>
        </form>
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
