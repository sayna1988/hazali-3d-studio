import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Box,
  Barcode,
  Camera,
  Check,
  ChevronDown,
  CircleDollarSign,
  ExternalLink,
  Layers3,
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
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
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
  const value = kleur.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  return KLEUREN[value] ?? "#159cff";
}

function voorraadStatus(gram: number) {
  if (gram <= 0) return { label: "Leeg", className: "empty" };
  if (gram < 200) return { label: "Bijna op", className: "low" };
  return { label: "Op voorraad", className: "good" };
}

export default function Filamenten() {
  const { session } = useAuth();
  const [naam, setNaam] = useState("");
  const [merk, setMerk] = useState("");
  const [kleur, setKleur] = useState("");
  const [type, setType] = useState("PLA");
  const [prijsPerKg, setPrijsPerKg] = useState(24.95);
  const [voorraadGram, setVoorraadGram] = useState(1000);
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

  function resetFormulier() {
    setNaam("");
    setMerk("");
    setKleur("");
    setType("PLA");
    setPrijsPerKg(24.95);
    setVoorraadGram(1000);
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
    setVoorraadGram(filament.voorraadGram);
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
      voorraadGram: Math.max(0, voorraadGram),
      ean: ean || undefined,
    };

    if (bewerkenId === null) await createFilament(gegevens);
    else await updateFilament(bewerkenId, gegevens);

    const wasBewerking = bewerkenId !== null;
    sluitFormulier();
    await laden();
    if (wasBewerking) {
      setMelding(`${gegevens.naam} is bijgewerkt.`);
      window.setTimeout(() => setMelding(""), 3500);
    }
  }

  async function verwijderen(id: number) {
    await deleteFilament(id);
    await laden();
  }

  async function wijzigVoorraad(filament: Filament, verschil: number) {
    if (filament.id === undefined) return;
    await updateFilament(filament.id, {
      voorraadGram: Math.max(0, filament.voorraadGram + verschil),
    });
    await laden();
  }

  async function verwerkBarcode(code: string) {
    setScannerOpen(false);
    setMelding("Online productopties worden gezocht…");

    const bekend = await db.filamenten.where("ean").equals(code).first();
    if (bekend?.id !== undefined) {
      await updateFilament(bekend.id, { voorraadGram: bekend.voorraadGram + 1000 });
      await laden();
      setMelding(`${bekend.naam} herkend — 1.000 gram aan de voorraad toegevoegd.`);
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
    setVoorraadGram(gram);
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
    setToonFormulier(true);
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
        (!query || [f.naam, f.merk, f.kleur, f.type].some((v) => v.toLowerCase().includes(query))) &&
        (typeFilter === "Alle" || f.type === typeFilter),
      )
      .sort((a, b) => {
        if (sortering === "voorraad") return a.voorraadGram - b.voorraadGram;
        if (sortering === "prijs") return b.prijsPerKg - a.prijsPerKg;
        return a.naam.localeCompare(b.naam, "nl");
      });
  }, [filamenten, zoekterm, typeFilter, sortering]);

  const totaalGram = filamenten.reduce((som, f) => som + f.voorraadGram, 0);
  const lageVoorraad = filamenten.filter((f) => f.voorraadGram < 200).length;
  const voorraadWaarde = filamenten.reduce(
    (som, f) => som + (f.voorraadGram / 1000) * f.prijsPerKg,
    0,
  );

  return (
    <Page title="Filamenten" subtitle="Beheer je materialen, voorraad en kosten op één plek.">
      {scannerOpen && <BarcodeScanner onScan={verwerkBarcode} onClose={() => setScannerOpen(false)} />}
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
          <div><span>Rollen</span><strong>{filamenten.length}</strong></div>
          <small>{new Set(filamenten.map((f) => f.type)).size} materiaalsoorten</small>
        </div>
        <div className="filament-stat">
          <span className="filament-stat__icon"><Box size={21} /></span>
          <div><span>Totale voorraad</span><strong>{(totaalGram / 1000).toLocaleString("nl-NL", { maximumFractionDigits: 2 })} kg</strong></div>
          <small>{totaalGram.toLocaleString("nl-NL")} gram beschikbaar</small>
        </div>
        <div className="filament-stat">
          <span className="filament-stat__icon filament-stat__icon--warning"><AlertTriangle size={21} /></span>
          <div><span>Aandacht nodig</span><strong>{lageVoorraad}</strong></div>
          <small>{lageVoorraad === 1 ? "rol is bijna op" : "rollen zijn bijna op"}</small>
        </div>
        <div className="filament-stat">
          <span className="filament-stat__icon filament-stat__icon--success"><CircleDollarSign size={21} /></span>
          <div><span>Voorraadwaarde</span><strong>€ {voorraadWaarde.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
          <small>Op basis van actuele inhoud</small>
        </div>
      </section>

      <section className="filament-workspace">
        <div className="filament-toolbar">
          <div className="filament-toolbar__title">
            <h2>Jouw filamenten</h2>
            <span>{gefilterd.length} van {filamenten.length} rollen</span>
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
              <label><span>Huidige voorraad</span><div className="filament-input-suffix"><input type="number" min="0" step="1" value={voorraadGram} onChange={(e) => setVoorraadGram(Number(e.target.value))} /><b>gram</b></div></label>
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
              const status = voorraadStatus(f.voorraadGram);
              const percentage = Math.min((f.voorraadGram / 1000) * 100, 100);
              return (
                <article key={f.id} className="filament-card" style={{ "--filament-color": filamentKleur(f.kleur) } as React.CSSProperties}>
                  <div className="filament-card__topline" />
                  <div className="filament-card__header">
                    <div className="filament-spool" aria-hidden="true"><span /><i /></div>
                    <div className="filament-card__identity"><span>{f.merk || "Onbekend merk"}</span><h3>{f.naam}</h3></div>
                    <div className="filament-card__actions">
                      <button className="filament-edit" type="button" onClick={() => openBewerken(f)} aria-label={`${f.naam} bewerken`} title="Filament bewerken"><Pencil size={16} /></button>
                      <button className="filament-delete" type="button" onClick={() => f.id !== undefined && verwijderen(f.id)} aria-label={`${f.naam} verwijderen`} title="Filament verwijderen"><Trash2 size={17} /></button>
                    </div>
                  </div>
                  <div className="filament-card__tags"><span>{f.type}</span><span><i style={{ background: filamentKleur(f.kleur) }} />{f.kleur || "Geen kleur"}</span></div>
                  {f.ean && <div className="filament-card__ean"><Barcode size={14} /> {f.ean}</div>}
                  <div className="filament-card__stock">
                    <div className="filament-card__stock-head"><span>Voorraad</span><strong>{f.voorraadGram.toLocaleString("nl-NL")} g</strong></div>
                    <div className="filament-progress"><span style={{ width: `${percentage}%` }} /></div>
                    <div className="filament-card__stock-foot"><span className={`filament-status filament-status--${status.className}`}><i />{status.label}</span><span>{Math.round(percentage)}% van een rol</span></div>
                  </div>
                  <div className="filament-card__footer">
                    <div><span>Prijs per kg</span><strong>€ {f.prijsPerKg.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</strong></div>
                    <div className="filament-stepper" aria-label="Voorraad aanpassen">
                      <button type="button" onClick={() => wijzigVoorraad(f, -50)} title="50 gram afboeken"><Minus size={16} /></button>
                      <span>50 g</span>
                      <button type="button" onClick={() => wijzigVoorraad(f, 50)} title="50 gram toevoegen"><Plus size={16} /></button>
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
