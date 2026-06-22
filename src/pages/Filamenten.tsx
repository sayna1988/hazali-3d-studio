import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Barcode,
  Camera,
  Check,
  ChevronDown,
  CircleDollarSign,
  CloudUpload,
  ExternalLink,
  FileText,
  Layers3,
  LoaderCircle,
  Minus,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { db } from "../database/db";
import { scrapeEanCandidate, searchEan, type EanCandidate, type EanProduct } from "../services/EanLookupService";
import { createFilament, deleteFilament, loadFilaments, updateFilament } from "../services/FilamentService";
import { extractInvoice, type InvoiceExtraction, type InvoiceFilament } from "../services/InvoiceImportService";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { rolGegevens, totaalGewicht } from "../utils/filamentInventory";
import { colorName, safeColor } from "../utils/colorNames";
import type { Filament } from "../types/Filament";
import Page from "../components/Page/Page";
import "./Filamenten.css";

const MATERIAAL_TYPES = ["PLA", "PETG", "ABS", "TPU", "ASA", "PA", "PC"];
const KLEUREN: Record<string, string> = {
  zwart: "#191b20",
  wit: "#f4f5f7",
  rood: "#ef4444",
  blauw: "#3b82f6",
  groen: "#22c55e",
  geel: "#facc15",
  oranje: "#f97316",
  paars: "#a855f7",
  grijs: "#8b95a5",
  roze: "#ec4899",
  naturel: "#e7dcc5",
  beige: "#d8c39a",
  bruin: "#7a4b2a",
  goud: "#ffd700",
  oudgoud: "#d4af37",
  champagne: "#d6bd8a",
  roségoud: "#b76e79",
  zilver: "#c0c0c0",
  koper: "#b87333",
  brons: "#cd7f32",
};

const KLEUR_ALIASSEN: Record<string, string> = {
  black: "zwart",
  white: "wit",
  red: "rood",
  blue: "blauw",
  green: "groen",
  yellow: "geel",
  orange: "oranje",
  purple: "paars",
  violet: "paars",
  grey: "grijs",
  gray: "grijs",
  pink: "roze",
  natural: "naturel",
  gold: "goud",
  "old gold": "oudgoud",
  silver: "zilver",
  copper: "koper",
  bronze: "brons",
  brown: "bruin",
  beige: "beige",
  "rose gold": "roségoud",
};

function geldigeEan(code: string) {
  if (!/^\d{8}$|^\d{13}$/.test(code)) return false;
  const cijfers = code.split("").map(Number);
  const controle = cijfers.pop() ?? 0;
  const som = cijfers.reverse().reduce((totaal, cijfer, index) => totaal + cijfer * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (som % 10)) % 10 === controle;
}

function herkenEigenschappen(tekst: string) {
  const boven = tekst.toUpperCase();
  const materiaal = MATERIAAL_TYPES.find((item) => new RegExp(`\\b${item}\\b`).test(boven)) ?? "PLA";
  const nederlandseKleur = Object.keys(KLEUREN).find((item) => boven.includes(item.toUpperCase()));
  const engelseKleur = Object.entries(KLEUR_ALIASSEN).find(([alias]) =>
    new RegExp(`\\b${alias}\\b`, "i").test(tekst),
  )?.[1];
  const kleur = nederlandseKleur ?? engelseKleur ?? "Onbekend";
  return { materiaal, kleur };
}

function BarcodeScanner({ onScan, onClose }: { onScan: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [handmatig, setHandmatig] = useState("");
  const [scannerStatus, setScannerStatus] = useState("Camera wordt gestart…");

  useEffect(() => {
    let actief = true;
    let stopScanner: (() => void) | undefined;

    async function startScanner() {
      if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) {
        setScannerStatus("Camera niet beschikbaar. Je kunt de EAN-code handmatig invoeren.");
        return;
      }

      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (!actief || !videoRef.current) return;
        const reader = new BrowserMultiFormatReader(undefined, {
          delayBetweenScanAttempts: 200,
          delayBetweenScanSuccess: 800,
        });
        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          },
          videoRef.current,
          (result) => {
            const code = result?.getText().replace(/\D/g, "") ?? "";
            if (!actief || !geldigeEan(code)) return;
            actief = false;
            stopScanner?.();
            onScan(code);
          },
        );
        stopScanner = () => controls.stop();
        if (actief) setScannerStatus("Houd de barcode stil binnen het kader");
        else controls.stop();
      } catch {
        if (actief) setScannerStatus("Camera niet beschikbaar. Controleer de cameratoestemming of voer de EAN-code handmatig in.");
      }
    }

    void startScanner();

    return () => {
      actief = false;
      stopScanner?.();
    };
  }, [onScan]);

  function verwerkHandmatig(event: React.FormEvent) {
    event.preventDefault();
    const code = handmatig.replace(/\D/g, "");
    if (!geldigeEan(code)) { setScannerStatus("Dit is geen geldige EAN-8 of EAN-13 code."); return; }
    onScan(code);
  }

  return (
    <div className="barcode-overlay" role="dialog" aria-modal="true" aria-label="Barcode scannen">
      <div className="barcode-modal">
        <div className="barcode-modal__header"><div><span><Barcode size={17} /> EAN-scanner</span><h2>Scan een filamentrol</h2></div><button type="button" onClick={onClose} aria-label="Scanner sluiten"><X size={20} /></button></div>
        <div className="barcode-camera">
          <video ref={(element) => { videoRef.current = element; }} muted playsInline />
          <div className="barcode-camera__shade" />
          <div className="barcode-camera__frame"><i /><i /><i /><i /><span /></div>
          <span className="barcode-camera__badge"><Camera size={15} /> Live camera</span>
        </div>
        <p className="barcode-status">{scannerStatus}</p>
        <div className="barcode-divider"><span>of voer de code in</span></div>
        <form className="barcode-manual" onSubmit={verwerkHandmatig}>
          <label><span>EAN-8 of EAN-13</span><div><Barcode size={18} /><input inputMode="numeric" maxLength={13} value={handmatig} onChange={(e) => setHandmatig(e.target.value.replace(/\D/g, ""))} placeholder="8712345678906" /></div></label>
          <button type="submit">Code gebruiken</button>
        </form>
        <small>Een barcode bevat alleen een productnummer. Onbekende producten vul je één keer aan; daarna herkent Hazali ze automatisch.</small>
      </div>
    </div>
  );
}

function filamentKleur(kleur: string) {
  return safeColor(kleur);
}

function voorraadStatus(aantal: number) {
  if (aantal <= 0) return { label: "Leeg", className: "empty" };
  if (aantal === 1) return { label: "Laatste rol", className: "low" };
  return { label: "Op voorraad", className: "good" };
}

export default function Filamenten() {
  const { session } = useAuth();
  const [naam, setNaam] = useState("");
  const [merk, setMerk] = useState("");
  const [kleur, setKleur] = useState("");
  const [type, setType] = useState("PLA");
  const [prijsPerKg, setPrijsPerKg] = useState(24.95);
  const [aantalRollen, setAantalRollen] = useState(1);
  const [gramPerRol, setGramPerRol] = useState(1000);
  const [filamenten, setFilamenten] = useState<Filament[]>([]);
  const [zoekterm, setZoekterm] = useState("");
  const [typeFilter, setTypeFilter] = useState("Alle");
  const [sortering, setSortering] = useState("naam");
  const [toonFormulier, setToonFormulier] = useState(false);
  const [foutmelding, setFoutmelding] = useState("");
  const [ean, setEan] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [melding, setMelding] = useState("");
  const [bewerkenId, setBewerkenId] = useState<number | null>(null);
  const [eanOpties, setEanOpties] = useState<EanCandidate[] | null>(null);
  const [eanBezig, setEanBezig] = useState(false);
  const [eanFout, setEanFout] = useState("");
  const invoiceInputRef = useRef<HTMLInputElement | null>(null);
  const [invoiceDragging, setInvoiceDragging] = useState(false);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [invoiceProgress, setInvoiceProgress] = useState("");
  const [invoiceError, setInvoiceError] = useState("");
  const [invoiceFileName, setInvoiceFileName] = useState("");
  const [invoiceResult, setInvoiceResult] = useState<InvoiceExtraction | null>(null);
  const [invoiceSaving, setInvoiceSaving] = useState(false);

  function resetFormulier() {
    setNaam("");
    setMerk("");
    setKleur("");
    setType("PLA");
    setPrijsPerKg(24.95);
    setAantalRollen(1);
    setGramPerRol(1000);
    setEan("");
    setFoutmelding("");
    setBewerkenId(null);
  }

  function openToevoegen() {
    resetFormulier();
    setToonFormulier(true);
  }

  function openBewerken(filament: Filament) {
    if (filament.id === undefined) return;
    setNaam(filament.naam);
    setMerk(filament.merk);
    setKleur(filament.kleur);
    setType(filament.type);
    setPrijsPerKg(filament.prijsPerKg);
    const rollen = rolGegevens(filament);
    setAantalRollen(rollen.aantal);
    setGramPerRol(rollen.gram);
    setEan(filament.ean ?? "");
    setFoutmelding("");
    setBewerkenId(filament.id);
    setToonFormulier(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function sluitFormulier() {
    resetFormulier();
    setToonFormulier(false);
  }

  async function laden() {
    setFilamenten(await loadFilaments());
  }

  async function opslaan(event: React.FormEvent) {
    event.preventDefault();
    if (!naam.trim() || !merk.trim() || !kleur.trim()) {
      setFoutmelding("Vul minimaal de naam, het merk en de kleur in.");
      return;
    }

    const gegevens = {
      naam: naam.trim(),
      merk: merk.trim(),
      kleur: kleur.trim(),
      type,
      prijsPerKg: Math.max(0, prijsPerKg),
      aantalRollen: Math.max(0, Math.round(aantalRollen)),
      gramPerRol: Math.max(1, gramPerRol),
      voorraadGram: Math.max(0, Math.round(aantalRollen)) * Math.max(1, gramPerRol),
      ean: ean || undefined,
    };

    const resultaat = bewerkenId === null
      ? await createFilament(gegevens)
      : await updateFilament(bewerkenId, gegevens);

    const wasBewerking = bewerkenId !== null;
    sluitFormulier();
    await laden();
    if (resultaat.merged) {
      setMelding(`${gegevens.naam} bestond al — de rollen zijn samengevoegd.`);
      window.setTimeout(() => setMelding(""), 4500);
    } else if (wasBewerking) {
      setMelding(`${gegevens.naam} is bijgewerkt.`);
      window.setTimeout(() => setMelding(""), 3500);
    }
  }

  async function verwijderen(filament: Filament) {
    if (filament.id === undefined) return;
    if (!window.confirm(`Weet je zeker dat je “${filament.naam}” en alle bijbehorende rollen wilt verwijderen?`)) return;
    await deleteFilament(filament.id);
    await laden();
  }

  async function wijzigAantalRollen(filament: Filament, verschil: number) {
    if (filament.id === undefined) return;
    const rollen = rolGegevens(filament);
    const nieuwAantal = Math.max(0, rollen.aantal + verschil);
    await updateFilament(filament.id, {
      aantalRollen: nieuwAantal,
      gramPerRol: rollen.gram,
      voorraadGram: nieuwAantal * rollen.gram,
    });
    await laden();
  }

  async function verwerkBarcode(code: string) {
    setScannerOpen(false);
    setMelding("Online productopties worden gezocht…");

    const bekend = await db.filamenten.where("ean").equals(code).first();
    if (bekend?.id !== undefined) {
      const rollen = rolGegevens(bekend);
      await updateFilament(bekend.id, {
        aantalRollen: rollen.aantal + 1,
        gramPerRol: rollen.gram,
        voorraadGram: (rollen.aantal + 1) * rollen.gram,
      });
      await laden();
      setMelding(`${bekend.naam} herkend — één rol aan de voorraad toegevoegd.`);
      window.setTimeout(() => setMelding(""), 4500);
      return;
    }

    try {
      const opties = await searchEan(code);
      setEan(code);
      setEanOpties(opties);
      setEanFout("");
      setMelding("");
    } catch (error) {
      setEan(code);
      setEanOpties([]);
      setEanFout(error instanceof Error ? error.message : "Online zoeken is mislukt.");
      setMelding("");
    }
  }

  function vulProductIn(product: EanProduct) {
    const tekst = [product.name, product.brand, product.description, product.category].join(" ");
    const herkend = herkenEigenschappen(tekst);
    const gewicht = tekst.match(/(\d+(?:[.,]\d+)?)\s*(kg|g)\b/i);
    const gram = gewicht ? Number(gewicht[1].replace(",", ".")) * (gewicht[2].toLowerCase() === "kg" ? 1000 : 1) : 1000;
    setNaam(product.name);
    setMerk(product.brand === "Onbekend merk" ? "" : product.brand);
    setKleur(herkend.kleur === "Onbekend" ? "" : herkend.kleur);
    setType(herkend.materiaal);
    setPrijsPerKg(product.price && product.price > 0 ? product.price / Math.max(gram / 1000, 0.001) : 24.95);
    setAantalRollen(1);
    setGramPerRol(gram);
    setEanOpties(null);
    setEanFout("");
    setToonFormulier(true);
  }

  async function kiesEanOptie(optie: EanCandidate) {
    setEanBezig(true);
    setEanFout("");
    try {
      const product = optie.product ?? await scrapeEanCandidate(ean, optie.url);
      vulProductIn(product);
    } catch (error) {
      setEanFout(error instanceof Error ? error.message : "Productgegevens konden niet worden gelezen.");
    } finally {
      setEanBezig(false);
    }
  }

  function handmatigAanvullen() {
    setEanOpties(null);
    setEanFout("");
    setNaam("");
    setMerk("");
    setKleur("");
    setAantalRollen(1);
    setGramPerRol(1000);
    setToonFormulier(true);
  }

  async function analyseerFactuur(file: File | undefined) {
    if (!file || invoiceBusy) return;
    setInvoiceBusy(true);
    setInvoiceError("");
    setInvoiceFileName(file.name);
    setInvoiceProgress("Factuur voorbereiden…");
    try {
      const result = await extractInvoice(file, setInvoiceProgress);
      if (!result.filaments.length) {
        setInvoiceError("Er zijn geen filamenten op deze factuur herkend.");
        return;
      }
      setInvoiceResult(result);
    } catch (error) {
      setInvoiceError(error instanceof Error ? error.message : "De factuur kon niet worden geanalyseerd.");
    } finally {
      setInvoiceBusy(false);
      setInvoiceProgress("");
    }
  }

  function wijzigInvoiceRegel(id: string, changes: Partial<InvoiceFilament>) {
    setInvoiceResult((current) => current ? {
      ...current,
      filaments: current.filaments.map((item) => item.id === id ? { ...item, ...changes } : item),
    } : current);
  }

  async function slaInvoiceFilamentenOp() {
    if (!invoiceResult || invoiceSaving) return;
    const geselecteerd = invoiceResult.filaments.filter((item) => item.selected);
    if (!geselecteerd.length) {
      setInvoiceError("Selecteer minimaal één filament om toe te voegen.");
      return;
    }
    if (geselecteerd.some((item) => !item.name.trim() || !item.brand.trim() || !item.color.trim() || item.quantity < 1 || item.gramsPerSpool < 1)) {
      setInvoiceError("Controleer naam, merk, kleur, aantal en gewicht van de geselecteerde regels.");
      return;
    }
    setInvoiceSaving(true);
    setInvoiceError("");
    try {
      for (const item of geselecteerd) {
        const quantity = Math.max(1, Math.round(item.quantity));
        const grams = Math.max(1, Math.round(item.gramsPerSpool));
        await createFilament({
          naam: item.name.trim(),
          merk: item.brand.trim(),
          kleur: item.color.trim(),
          type: item.material,
          prijsPerKg: Math.max(0, item.pricePerKg),
          aantalRollen: quantity,
          gramPerRol: grams,
          voorraadGram: quantity * grams,
        });
      }
      await laden();
      setInvoiceResult(null);
      setInvoiceFileName("");
      setMelding(`${geselecteerd.length} ${geselecteerd.length === 1 ? "filamentsoort is" : "filamentsoorten zijn"} uit de factuur toegevoegd.`);
      window.setTimeout(() => setMelding(""), 4500);
    } catch (error) {
      setInvoiceError(error instanceof Error ? error.message : "De filamenten konden niet worden opgeslagen.");
    } finally {
      setInvoiceSaving(false);
    }
  }

  useEffect(() => {
    let actief = true;
    loadFilaments().then((data) => {
      if (actief) setFilamenten(data);
    });
    return () => {
      actief = false;
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user.id) return;
    const client = supabase;
    const channel = client
      .channel(`filaments-${session.user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "filaments", filter: `user_id=eq.${session.user.id}` }, () => {
        void loadFilaments().then(setFilamenten);
      })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [session?.user.id]);

  const materiaalTypes = useMemo(
    () => ["Alle", ...Array.from(new Set(filamenten.map((f) => f.type)))],
    [filamenten],
  );

  const gefilterd = useMemo(() => {
    const query = zoekterm.toLowerCase().trim();
    return filamenten
      .filter((f) =>
        (!query || [f.naam, f.merk, f.kleur, f.type, colorName(f.kleur)].some((v) => v.toLowerCase().includes(query))) &&
        (typeFilter === "Alle" || f.type === typeFilter),
      )
      .sort((a, b) => {
        if (sortering === "voorraad") return rolGegevens(a).aantal - rolGegevens(b).aantal;
        if (sortering === "prijs") return b.prijsPerKg - a.prijsPerKg;
        return a.naam.localeCompare(b.naam, "nl");
      });
  }, [filamenten, zoekterm, typeFilter, sortering]);

  const totaalRollen = filamenten.reduce((som, f) => som + rolGegevens(f).aantal, 0);
  const totaalGram = filamenten.reduce((som, f) => som + totaalGewicht(f), 0);
  const lageVoorraad = filamenten.filter((f) => rolGegevens(f).aantal <= 1).length;
  const voorraadWaarde = filamenten.reduce(
    (som, f) => {
      const rollen = rolGegevens(f);
      return som + ((rollen.aantal * rollen.gram) / 1000) * f.prijsPerKg;
    },
    0,
  );

  return (
    <Page title="Filamenten" subtitle="Beheer het aantal rollen, het gewicht per rol en je materiaalkosten.">
      {scannerOpen && <BarcodeScanner onScan={verwerkBarcode} onClose={() => setScannerOpen(false)} />}
      {invoiceResult && (
        <div className="invoice-review-overlay" role="dialog" aria-modal="true" aria-labelledby="invoice-review-title">
          <section className="invoice-review">
            <header className="invoice-review__header">
              <div><span><FileText size={16} /> Geanalyseerde factuur</span><h2 id="invoice-review-title">Controleer de filamenten</h2><p>Wijzig onjuiste gegevens en selecteer wat je aan de voorraad wilt toevoegen.</p></div>
              <button type="button" onClick={() => { setInvoiceResult(null); setInvoiceError(""); }} aria-label="Factuurcontrole sluiten"><X size={20} /></button>
            </header>
            <div className="invoice-review__meta">
              <span><small>Bestand</small><strong>{invoiceFileName}</strong></span>
              <span><small>Leverancier</small><strong>{invoiceResult.supplier || "Onbekend"}</strong></span>
              <span><small>Factuurnummer</small><strong>{invoiceResult.invoiceNumber || "—"}</strong></span>
              <span><small>Datum</small><strong>{invoiceResult.invoiceDate || "—"}</strong></span>
            </div>
            {(invoiceResult.warnings.length > 0 || invoiceError) && <div className="invoice-review__warnings"><AlertTriangle size={17} /><div>{invoiceError && <p>{invoiceError}</p>}{invoiceResult.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div></div>}
            <div className="invoice-review__items">
              {invoiceResult.filaments.map((item, index) => (
                <article key={item.id} className={`invoice-item${item.selected ? "" : " is-disabled"}`}>
                  <div className="invoice-item__top">
                    <label className="invoice-item__select"><input type="checkbox" checked={item.selected} onChange={(e) => wijzigInvoiceRegel(item.id, { selected: e.target.checked })} /><span>Regel {index + 1} toevoegen</span></label>
                    <span className={`invoice-confidence${item.confidence < .7 ? " is-low" : ""}`}>{Math.round(item.confidence * 100)}% zeker</span>
                  </div>
                  <div className="invoice-item__grid">
                    <label><span>Naam *</span><input value={item.name} onChange={(e) => wijzigInvoiceRegel(item.id, { name: e.target.value })} /></label>
                    <label><span>Merk *</span><input value={item.brand} onChange={(e) => wijzigInvoiceRegel(item.id, { brand: e.target.value })} /></label>
                    <label><span>Materiaal</span><select value={item.material} onChange={(e) => wijzigInvoiceRegel(item.id, { material: e.target.value as InvoiceFilament["material"] })}>{MATERIAAL_TYPES.map((value) => <option key={value}>{value}</option>)}</select></label>
                    <label><span>Kleur *</span><input value={item.color} onChange={(e) => wijzigInvoiceRegel(item.id, { color: e.target.value })} /></label>
                    <label><span>Aantal rollen</span><input type="number" min="1" step="1" value={item.quantity} onChange={(e) => wijzigInvoiceRegel(item.id, { quantity: Number(e.target.value) })} /></label>
                    <label><span>Gram per rol</span><input type="number" min="1" step="1" value={item.gramsPerSpool} onChange={(e) => wijzigInvoiceRegel(item.id, { gramsPerSpool: Number(e.target.value) })} /></label>
                    <label><span>Prijs per rol</span><div className="filament-input-prefix"><b>€</b><input type="number" min="0" step="0.01" value={item.pricePerSpool} onChange={(e) => wijzigInvoiceRegel(item.id, { pricePerSpool: Number(e.target.value), pricePerKg: Number(e.target.value) / Math.max(item.gramsPerSpool / 1000, .001) })} /></div></label>
                    <label><span>Prijs per kg</span><div className="filament-input-prefix"><b>€</b><input type="number" min="0" step="0.01" value={item.pricePerKg} onChange={(e) => wijzigInvoiceRegel(item.id, { pricePerKg: Number(e.target.value) })} /></div></label>
                  </div>
                  {item.notes && <p className="invoice-item__notes">{item.notes}</p>}
                </article>
              ))}
            </div>
            <footer className="invoice-review__footer">
              <span>{invoiceResult.filaments.filter((item) => item.selected).length} van {invoiceResult.filaments.length} regels geselecteerd</span>
              <div><button type="button" className="invoice-cancel" onClick={() => setInvoiceResult(null)}>Annuleren</button><button type="button" className="invoice-save" disabled={invoiceSaving} onClick={() => void slaInvoiceFilamentenOp()}>{invoiceSaving ? <LoaderCircle className="invoice-spinner" size={18} /> : <Check size={18} />} {invoiceSaving ? "Toevoegen…" : "Toevoegen aan voorraad"}</button></div>
            </footer>
          </section>
        </div>
      )}
      {eanOpties && (
        <div className="ean-results-overlay" role="dialog" aria-modal="true" aria-labelledby="ean-results-title">
          <section className="ean-results">
            <div className="ean-results__header">
              <div><span>EAN {ean}</span><h2 id="ean-results-title">Kies het juiste product</h2><p>Selecteer een bron; Hazali leest daarna de beschikbare productgegevens uit.</p></div>
              <button type="button" onClick={() => setEanOpties(null)} aria-label="Resultaten sluiten"><X size={20} /></button>
            </div>
            {eanFout && <div className="ean-results__error">{eanFout}</div>}
            <div className="ean-results__list">
              {eanOpties.map((optie, index) => (
                <button key={`${optie.url}-${index}`} type="button" disabled={eanBezig} onClick={() => void kiesEanOptie(optie)}>
                  <div><strong>{optie.title}</strong><span>{optie.source}</span>{optie.snippet && <p>{optie.snippet}</p>}</div>
                  <ExternalLink size={17} />
                </button>
              ))}
              {!eanOpties.length && !eanFout && <p className="ean-results__empty">Geen passende online resultaten gevonden.</p>}
            </div>
            <div className="ean-results__footer"><button type="button" onClick={handmatigAanvullen}>Handmatig aanvullen</button><span>{eanBezig ? "Productpagina wordt gelezen…" : `${eanOpties.length} opties gevonden`}</span></div>
          </section>
        </div>
      )}
      {melding && <div className="filament-toast"><Barcode size={18} /><span>{melding}</span><button type="button" onClick={() => setMelding("")} aria-label="Melding sluiten"><X size={16} /></button></div>}
      <section className="filament-stats" aria-label="Filament overzicht">
        <div className="filament-stat filament-stat--primary">
          <span className="filament-stat__icon"><Layers3 size={21} /></span>
          <div><span>Rollen & totale voorraad</span><strong>{totaalRollen} rollen</strong></div>
          <small>{(totaalGram / 1000).toLocaleString("nl-NL", { maximumFractionDigits: 2 })} kg · {totaalGram.toLocaleString("nl-NL")} gram verdeeld over {filamenten.length} filamentsoorten</small>
        </div>
        <div className="filament-stat">
          <span className="filament-stat__icon filament-stat__icon--warning"><AlertTriangle size={21} /></span>
          <div><span>Aandacht nodig</span><strong>{lageVoorraad}</strong></div>
          <small>{lageVoorraad === 1 ? "filamentsoort heeft maximaal één rol" : "filamentsoorten hebben maximaal één rol"}</small>
        </div>
        <div className="filament-stat">
          <span className="filament-stat__icon filament-stat__icon--success"><CircleDollarSign size={21} /></span>
          <div><span>Voorraadwaarde</span><strong>€ {voorraadWaarde.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
          <small>Op basis van actuele inhoud</small>
        </div>
      </section>

      <section className="filament-workspace">
        <div
          className={`invoice-dropzone${invoiceDragging ? " is-dragging" : ""}${invoiceBusy ? " is-busy" : ""}`}
          role="button"
          tabIndex={0}
          aria-disabled={invoiceBusy}
          onClick={() => !invoiceBusy && invoiceInputRef.current?.click()}
          onKeyDown={(event) => { if (!invoiceBusy && (event.key === "Enter" || event.key === " ")) invoiceInputRef.current?.click(); }}
          onDragEnter={(event) => { event.preventDefault(); if (!invoiceBusy) setInvoiceDragging(true); }}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = invoiceBusy ? "none" : "copy"; }}
          onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget as Node)) setInvoiceDragging(false); }}
          onDrop={(event) => { event.preventDefault(); setInvoiceDragging(false); if (!invoiceBusy) void analyseerFactuur(event.dataTransfer.files[0]); }}
        >
          <span className="invoice-dropzone__icon">{invoiceBusy ? <LoaderCircle className="invoice-spinner" size={24} /> : <FileText size={24} />}</span>
          <span className="invoice-dropzone__copy"><strong>{invoiceBusy ? `Factuur analyseren: ${invoiceFileName}` : "Importeer filamenten uit een factuur"}</strong><small>{invoiceBusy ? invoiceProgress || "Filamentregels worden lokaal herkend…" : "Gratis en lokaal · sleep een PDF of afbeelding hierheen, of klik om een bestand te kiezen"}</small></span>
          <span className="invoice-dropzone__action"><CloudUpload size={17} /> Factuur kiezen</span>
          <input ref={invoiceInputRef} type="file" hidden accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp" disabled={invoiceBusy} onChange={(event) => { void analyseerFactuur(event.target.files?.[0]); event.target.value = ""; }} />
        </div>
        {invoiceError && !invoiceResult && <div className="invoice-dropzone-error"><AlertTriangle size={16} />{invoiceError}</div>}
        <div className="filament-toolbar">
          <div className="filament-toolbar__title">
            <h2>Jouw filamenten</h2>
            <span>{gefilterd.length} van {filamenten.length} filamentsoorten</span>
          </div>
          <div className="filament-toolbar__actions">
            <label className="filament-search">
              <Search size={18} />
              <input value={zoekterm} onChange={(e) => setZoekterm(e.target.value)} placeholder="Zoek op naam, merk of kleur..." />
              {zoekterm && <button type="button" onClick={() => setZoekterm("")} aria-label="Zoekopdracht wissen"><X size={16} /></button>}
            </label>
            <label className="filament-select">
              <SlidersHorizontal size={17} />
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter op materiaal">
                {materiaalTypes.map((item) => <option key={item}>{item}</option>)}
              </select>
              <ChevronDown size={15} />
            </label>
            <label className="filament-select filament-select--sort">
              <select value={sortering} onChange={(e) => setSortering(e.target.value)} aria-label="Sorteer filamenten">
                <option value="naam">Naam A–Z</option>
                <option value="voorraad">Laagste voorraad</option>
                <option value="prijs">Hoogste prijs</option>
              </select>
              <ChevronDown size={15} />
            </label>
            <button className="filament-add-button" type="button" onClick={() => toonFormulier ? sluitFormulier() : openToevoegen()}>
              {toonFormulier ? <X size={19} /> : <Plus size={19} />}
              {toonFormulier ? "Sluiten" : "Filament toevoegen"}
            </button>
            <button className="filament-scan-button" type="button" onClick={() => setScannerOpen(true)}>
              <Barcode size={19} /> Barcode scannen
            </button>
          </div>
        </div>

        {toonFormulier && (
          <form className="filament-form" onSubmit={opslaan}>
            <div className="filament-form__heading">
              <div><span>{bewerkenId === null ? "Nieuwe rol" : "Filament bewerken"}</span><h3>{bewerkenId === null ? "Voeg filament toe aan je voorraad" : "Werk de gegevens van deze rol bij"}</h3></div>
              <div className="filament-form__swatch" style={{ background: filamentKleur(kleur) }} />
            </div>
            <div className="filament-form__grid">
              {ean && <label className="filament-form__ean"><span>EAN-code</span><div><Barcode size={17} /><input value={ean} readOnly /></div></label>}
              <label><span>Naam *</span><input autoFocus value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="Bijv. Matte Black" /></label>
              <label><span>Merk *</span><input value={merk} onChange={(e) => setMerk(e.target.value)} placeholder="Bijv. Bambu Lab" /></label>
              <label><span>Kleur of hexcode *</span><input value={kleur} onChange={(e) => setKleur(e.target.value)} placeholder="Zwart of #191b20" /></label>
              <label><span>Materiaal</span><select value={type} onChange={(e) => setType(e.target.value)}>{MATERIAAL_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span>Prijs per kg</span><div className="filament-input-prefix"><b>€</b><input type="number" min="0" step="0.01" value={prijsPerKg} onChange={(e) => setPrijsPerKg(Number(e.target.value))} /></div></label>
              <label><span>Aantal rollen</span><div className="filament-input-suffix"><input type="number" min="0" step="1" value={aantalRollen} onChange={(e) => setAantalRollen(Number(e.target.value))} /><b>rollen</b></div></label>
              <label><span>Gewicht per rol</span><div className="filament-input-suffix"><input type="number" min="1" step="1" value={gramPerRol} onChange={(e) => setGramPerRol(Number(e.target.value))} /><b>gram</b></div></label>
            </div>
            <div className="filament-form__footer">
              <span className={foutmelding ? "filament-form__error" : "filament-form__hint"}>{foutmelding || "Velden met een * zijn verplicht."}</span>
              <button type="submit"><Check size={18} /> {bewerkenId === null ? "Rol opslaan" : "Wijzigingen opslaan"}</button>
            </div>
          </form>
        )}

        {gefilterd.length > 0 ? (
          <div className="filament-grid">
            {gefilterd.map((f) => {
              const rollen = rolGegevens(f);
              const totaalGramFilament = totaalGewicht(f);
              const status = voorraadStatus(rollen.aantal);
              return (
                <article key={f.id} className="filament-card" style={{ "--filament-color": filamentKleur(f.kleur) } as React.CSSProperties}>
                  <div className="filament-card__topline" />
                  <div className="filament-card__header">
                    <div className="filament-spool" aria-hidden="true"><span /><i /></div>
                    <div className="filament-card__identity"><span>{f.merk || "Onbekend merk"}</span><h3>{f.naam}</h3></div>
                    <div className="filament-card__actions">
                      <button className="filament-edit" type="button" onClick={() => openBewerken(f)} aria-label={`${f.naam} bewerken`} title="Filament bewerken"><Pencil size={16} /></button>
                      <button className="filament-delete" type="button" onClick={() => void verwijderen(f)} aria-label={`${f.naam} verwijderen`} title="Filament verwijderen"><Trash2 size={17} /></button>
                    </div>
                  </div>
                  <div className="filament-card__tags"><span>{f.type}</span><span title={f.kleur}><i style={{ background: filamentKleur(f.kleur) }} />{colorName(f.kleur)}</span></div>
                  {f.ean && <div className="filament-card__ean"><Barcode size={14} /> {f.ean}</div>}
                  <div className="filament-card__stock">
                    <div className="filament-card__stock-head"><span>Voorraad</span><strong>{rollen.aantal} {rollen.aantal === 1 ? "rol" : "rollen"}</strong></div>
                    <div className={`filament-rolls ${rollen.aantal === 0 ? "filament-rolls--empty" : ""}`} aria-label={`${rollen.aantal} rollen`}>
                      {rollen.aantal === 0 ? <i /> : Array.from({ length: Math.min(rollen.aantal, 8) }, (_, index) => <i key={index} />)}
                      {rollen.aantal > 8 && <b>+{rollen.aantal - 8}</b>}
                    </div>
                    <div className="filament-card__stock-foot"><span className={`filament-status filament-status--${status.className}`}><i />{status.label}</span><span>{rollen.aantal} × {rollen.gram.toLocaleString("nl-NL")} g · {totaalGramFilament.toLocaleString("nl-NL")} g totaal</span></div>
                  </div>
                  <div className="filament-card__footer">
                    <div><span>Prijs per kg</span><strong>€ {f.prijsPerKg.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</strong></div>
                    <div className="filament-stepper" aria-label="Voorraad aanpassen">
                      <button type="button" onClick={() => wijzigAantalRollen(f, -1)} title="Eén rol afboeken"><Minus size={16} /></button>
                      <span>1 rol</span>
                      <button type="button" onClick={() => wijzigAantalRollen(f, 1)} title="Eén rol toevoegen"><Plus size={16} /></button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="filament-empty">
            <span><PackageOpen size={30} /></span>
            <h3>{filamenten.length ? "Geen filamenten gevonden" : "Je filamentkast is nog leeg"}</h3>
            <p>{filamenten.length ? "Pas je zoekopdracht of materiaalfilter aan." : "Voeg je eerste rol toe om voorraad en kosten bij te houden."}</p>
            {!filamenten.length && <button type="button" onClick={openToevoegen}><Plus size={18} /> Eerste filament toevoegen</button>}
          </div>
        )}
      </section>
    </Page>
  );
}
