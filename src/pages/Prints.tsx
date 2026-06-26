import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Boxes, CircleDollarSign } from "lucide-react";
import "./Prints.css";
import EditPrintModal from "../components/EditPrintModal/EditPrintModal";
import { import3MF } from "../services/PrintImportService";
import PrintsTable from "../components/PrintsTable/PrintsTable";
import PrintToolbar from "../components/PrintToolbar/PrintToolbar";
import PrintHeader from "../components/PrintHeader/PrintHeader";
import type { Print } from "../types/Print";
import { loadPrints, loadPrintSummaries, deletePrint, savePrint } from "../services/PrintService";
import { db } from "../database/db";
import { importMakerWorldUrl } from "../services/MakerWorldImportService";
import { createInventory, deleteInventory, loadInventory, updateInventory } from "../services/InventoryService";
import { loadFilaments } from "../services/FilamentService";
import type { Filament } from "../types/Filament";
import type { Inventory } from "../types/Inventory";

interface ImportMessage {
  type: "success" | "error";
  text: string;
  aandachtspunten?: Array<{ bestandsnaam: string; meldingen: string[] }>;
}

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

function catalogusVoorraadMap(producten: Inventory[]) {
  return Object.fromEntries(
    producten
      .filter((product) => product.printId !== undefined)
      .map((product) => [product.printId!, product.voorraad])
  );
}

export default function Prints() {
  const [selectedPrint, setSelectedPrint] = useState<Print | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [prints, setPrints] = useState<Print[]>([]);
  const [geselecteerdePrintIds, setGeselecteerdePrintIds] = useState<number[]>([]);
  const [bulkTagsInput, setBulkTagsInput] = useState("");
  const [bulkBezig, setBulkBezig] = useState(false);
  const [zoekterm, setZoekterm] = useState("");
  const [sortering, setSortering] = useState("nieuwste");
  const [geselecteerdeTag, setGeselecteerdeTag] = useState("");
  const [weergave, setWeergave] = useState<"tabel" | "grid">(() =>
    window.localStorage.getItem("catalogus-weergave") === "grid" ? "grid" : "tabel"
  );
  const [importing, setImporting] = useState(false);
  const [makerWorldImporting, setMakerWorldImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importMessage, setImportMessage] = useState<ImportMessage | null>(null);
  const [catalogusVoorraad, setCatalogusVoorraad] = useState<Record<number, number>>({});
  const [inventarisProducten, setInventarisProducten] = useState<Inventory[]>([]);
  const [filamentVoorraad, setFilamentVoorraad] = useState<Filament[]>([]);
  const navigate = useNavigate();

  async function laden() {
    const [printsData, filamentenData, producten] = await Promise.all([loadPrints(), loadFilaments(), loadInventory()]);
    setPrints(printsData);
    setFilamentVoorraad(filamentenData);
    setInventarisProducten(producten);
    setCatalogusVoorraad(catalogusVoorraadMap(producten));
  }

  async function laadCatalogusVoorraad() {
    const producten = await loadInventory();
    setInventarisProducten(producten);
    setCatalogusVoorraad(catalogusVoorraadMap(producten));
  }

  async function voegUitgeprinteExemplarenToe(print: Print, aantal: number) {
    if (print.id === undefined || aantal < 1) return;

    const bestaand = await db.inventory
      .filter((product) => product.printId === print.id)
      .first();

    if (bestaand?.id !== undefined) {
      await updateInventory(bestaand.id, { voorraad: bestaand.voorraad + aantal });
    } else {
      await createInventory({
        printId: print.id,
        printCloudId: print.cloudId,
        naam: print.naam,
        foto: print.foto ?? "",
        sku: `PRINT-${String(print.id).padStart(4, "0")}`,
        voorraad: aantal,
        minimumVoorraad: 0,
        kostprijs: Math.max(0, Number(print.kostprijs || 0)),
        verkoopprijs: Math.max(0, Number(print.verkoopprijs || 0)),
        locatie: "",
        aangemaaktOp: new Date().toISOString()
      });
    }

    await laadCatalogusVoorraad();
  }

  async function pasCatalogusVoorraadAan(print: Print, verschil: number) {
    if (print.id === undefined) return;

    const bestaand = await db.inventory
      .filter((product) => product.printId === print.id)
      .first();

    if (bestaand?.id !== undefined) {
      await updateInventory(bestaand.id, {
        naam: print.naam,
        foto: print.foto ?? bestaand.foto,
        voorraad: Math.max(0, bestaand.voorraad + verschil),
        kostprijs: Math.max(0, Number(print.kostprijs || 0)),
        verkoopprijs: Math.max(0, Number(print.verkoopprijs || 0))
      });
    } else if (verschil > 0) {
      await createInventory({
        printId: print.id,
        printCloudId: print.cloudId,
        naam: print.naam,
        foto: print.foto ?? "",
        sku: `PRINT-${String(print.id).padStart(4, "0")}`,
        voorraad: verschil,
        minimumVoorraad: 0,
        kostprijs: Math.max(0, Number(print.kostprijs || 0)),
        verkoopprijs: Math.max(0, Number(print.verkoopprijs || 0)),
        locatie: "",
        aangemaaktOp: new Date().toISOString()
      });
    }

    await laadCatalogusVoorraad();
  }

  async function savePrintChanges(tags: string[]) {
    if (!selectedPrint) return;
    await savePrint({ ...selectedPrint, tags });
    setShowEditModal(false);
    await laden();
  }

  async function toggleSplitPrint(printData: Print, checked: boolean) {
    const filamenten = printData.filamenten?.length
      ? printData.filamenten
      : (printData.filamentKleuren ?? []).map((kleur) => ({ kleur, gewicht: 0, uren: 0, minuten: 0 }));
    await savePrint({
      ...printData,
      filamenten,
      splitPrint: checked,
      splitPrintBron: checked ? "handmatig" : undefined
    });
    await laden();
  }

  async function verwijderen(id: number) {
    if (!window.confirm("Weet je zeker dat je deze print wilt verwijderen?")) return;
    const gekoppeldeProducten = await db.inventory
      .filter((product) => product.printId === id)
      .toArray();
    await Promise.all(gekoppeldeProducten.map((product) => product.id === undefined ? undefined : deleteInventory(product.id)));
    await deletePrint(id);
    setGeselecteerdePrintIds((huidig) => huidig.filter((printId) => printId !== id));
    await laden();
  }

  function parseBulkTags() {
    return Array.from(new Set(
      bulkTagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    ));
  }

  async function bulkTagsToepassen() {
    const tags = parseBulkTags();
    const geselecteerdePrints = prints.filter((print) => print.id !== undefined && geselecteerdePrintIds.includes(print.id));

    if (!geselecteerdePrints.length) return;
    if (!tags.length) {
      setImportMessage({ type: "error", text: "Voer minimaal een tag in om in bulk toe te passen." });
      return;
    }

    setBulkBezig(true);
    setImportMessage(null);
    try {
      await Promise.all(geselecteerdePrints.map((print) => savePrint({
        ...print,
        tags: Array.from(new Set([...(print.tags ?? []), ...tags]))
      })));
      await laden();
      setBulkTagsInput("");
      setImportMessage({
        type: "success",
        text: `${tags.length} ${tags.length === 1 ? "tag is" : "tags zijn"} toegevoegd aan ${geselecteerdePrints.length} ${geselecteerdePrints.length === 1 ? "print" : "prints"}.`
      });
    } finally {
      setBulkBezig(false);
    }
  }

  async function bulkVerwijderen() {
    const ids = [...geselecteerdePrintIds];
    if (!ids.length) return;
    if (!window.confirm(`Weet je zeker dat je ${ids.length} ${ids.length === 1 ? "geselecteerde print" : "geselecteerde prints"} wilt verwijderen?`)) return;

    setBulkBezig(true);
    setImportMessage(null);
    try {
      const gekoppeldeProducten = await db.inventory
        .filter((product) => product.printId !== undefined && ids.includes(product.printId))
        .toArray();
      await Promise.all(gekoppeldeProducten.map((product) => product.id === undefined ? undefined : deleteInventory(product.id)));
      await Promise.all(ids.map((id) => deletePrint(id)));
      setGeselecteerdePrintIds([]);
      await laden();
      setImportMessage({
        type: "success",
        text: `${ids.length} ${ids.length === 1 ? "print is" : "prints zijn"} verwijderd.`
      });
    } finally {
      setBulkBezig(false);
    }
  }

  async function importeer3MF(files: File[]) {
    if (!files.length) return;

    const geldigeBestanden = files.filter((file) => file.name.toLowerCase().endsWith(".3mf"));
    const overgeslagen = files.length - geldigeBestanden.length;
    if (!geldigeBestanden.length) {
      setImportMessage({ type: "error", text: "Selecteer één of meerdere bestanden met de extensie .3mf." });
      return;
    }

    setImporting(true);
    setImportMessage(null);
    setImportProgress({ current: 0, total: geldigeBestanden.length });
    const results: Array<{ bestandsnaam: string; waarschuwingen: string[] }> = [];
    const mislukt: string[] = [];

    try {
      for (const [index, file] of geldigeBestanden.entries()) {
        try {
          const result = await import3MF(file);
          results.push({ bestandsnaam: file.name, waarschuwingen: result.waarschuwingen });
        } catch (error) {
          console.error(error);
          mislukt.push(file.name);
        }
        setImportProgress({ current: index + 1, total: geldigeBestanden.length });
        // Geef de browser tussen ZIP-bestanden ruimte om tijdelijke parse-data op te ruimen.
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }

      await laden();
      const aandachtspunten = results
        .filter(({ waarschuwingen }) => waarschuwingen.length > 0)
        .map(({ bestandsnaam, waarschuwingen }) => ({ bestandsnaam, meldingen: waarschuwingen }));
      const warnings = aandachtspunten.reduce((sum, item) => sum + item.meldingen.length, 0);
      setImportMessage({
        type: mislukt.length ? "error" : "success",
        text: `${results.length} van ${geldigeBestanden.length} ${geldigeBestanden.length === 1 ? "3MF-bestand" : "3MF-bestanden"} geïmporteerd${warnings ? ` · ${warnings} aandachtspunt${warnings === 1 ? "" : "en"}` : ""}${overgeslagen ? ` · ${overgeslagen} ongeldig bestand overgeslagen` : ""}${mislukt.length ? ` · mislukt: ${mislukt.join(", ")}` : ""}.`,
        aandachtspunten
      });
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  }

  async function importeerMakerWorld(url: string) {
    setMakerWorldImporting(true);
    setImportMessage(null);
    try {
      const result = await importMakerWorldUrl(url);
      await laden();
      setImportMessage({
        type: "success",
        text: `“${result.print.naam}” is vanuit MakerWorld geïmporteerd met het 3MF-bestand en ${result.print.fotos?.length ?? 0} foto’s.`,
        aandachtspunten: result.waarschuwingen.length
          ? [{ bestandsnaam: result.print.bron3mf || "MakerWorld 3MF", meldingen: result.waarschuwingen }]
          : undefined,
      });
    } catch (error) {
      console.error(error);
      setImportMessage({
        type: "error",
        text: error instanceof Error ? error.message : "MakerWorld-import is mislukt.",
      });
    } finally {
      setMakerWorldImporting(false);
    }
  }

  useEffect(() => {
    let actief = true;
    const verversNaSync = () => {
      void loadPrintSummaries().then((data) => { if (actief) setPrints(data); });
    };
    Promise.all([loadPrints(), loadFilaments(), loadInventory()]).then(([printData, filamentData, producten]) => {
      if (!actief) return;
      setPrints(printData);
      setFilamentVoorraad(filamentData);
      setInventarisProducten(producten);
      setCatalogusVoorraad(Object.fromEntries(
        producten
          .filter((product) => product.printId !== undefined)
          .map((product) => [product.printId!, product.voorraad])
      ));
    });
    window.addEventListener("hazali:prints-synced", verversNaSync);
    window.addEventListener("hazali:inventory-synced", laadCatalogusVoorraad);
    return () => {
      actief = false;
      window.removeEventListener("hazali:prints-synced", verversNaSync);
      window.removeEventListener("hazali:inventory-synced", laadCatalogusVoorraad);
    };
  }, []);

  useEffect(() => {
    const geldigeIds = new Set(prints.map((print) => print.id).filter((id): id is number => id !== undefined));
    const timer = window.setTimeout(() => {
      setGeselecteerdePrintIds((huidig) => huidig.filter((id) => geldigeIds.has(id)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [prints]);

  useEffect(() => {
    window.localStorage.setItem("catalogus-weergave", weergave);
  }, [weergave]);

  const tagRanking = useMemo(() => {
    const aantallen = new Map<string, number>();

    prints.forEach((print) => {
      new Set(print.tags ?? []).forEach((tag) => {
        aantallen.set(tag, (aantallen.get(tag) ?? 0) + 1);
      });
    });

    return [...aantallen.entries()]
      .map(([tag, aantal]) => ({ tag, aantal }))
      .sort((a, b) => b.aantal - a.aantal || a.tag.localeCompare(b.tag, "nl"));
  }, [prints]);

  const gefilterdePrints = [...prints]
    .filter((print) => {
      const zoek = zoekterm.trim().toLowerCase();
      return !zoek || print.naam?.toLowerCase().includes(zoek) || print.tags?.some((tag) => tag.toLowerCase().includes(zoek));
    })
    .filter((print) => !geselecteerdeTag || print.tags?.includes(geselecteerdeTag))
    .sort((a, b) => {
      if (sortering === "winst") return b.winst - a.winst;
      if (sortering === "verkoopprijs") return b.verkoopprijs - a.verkoopprijs;
      return (b.id || 0) - (a.id || 0);
    });

  const zichtbarePrintIds = gefilterdePrints
    .map((print) => print.id)
    .filter((id): id is number => id !== undefined);
  const alleZichtbarePrintsGeselecteerd = zichtbarePrintIds.length > 0 && zichtbarePrintIds.every((id) => geselecteerdePrintIds.includes(id));
  const enkeleZichtbarePrintsGeselecteerd = zichtbarePrintIds.some((id) => geselecteerdePrintIds.includes(id));

  const inventarisStats = useMemo(() => {
    const totaleStuks = inventarisProducten.reduce((totaal, item) => totaal + item.voorraad, 0);
    const verkoopwaarde = inventarisProducten.reduce((totaal, item) => totaal + item.voorraad * item.verkoopprijs, 0);
    const lageVoorraad = inventarisProducten.filter((item) => item.voorraad <= item.minimumVoorraad).length;
    return { totaleStuks, verkoopwaarde, lageVoorraad };
  }, [inventarisProducten]);

  function togglePrintSelectie(id: number, checked: boolean) {
    setGeselecteerdePrintIds((huidig) => checked
      ? [...new Set([...huidig, id])]
      : huidig.filter((printId) => printId !== id)
    );
  }

  function toggleZichtbarePrints(checked: boolean) {
    setGeselecteerdePrintIds((huidig) => checked
      ? [...new Set([...huidig, ...zichtbarePrintIds])]
      : huidig.filter((id) => !zichtbarePrintIds.includes(id))
    );
  }

  return (
    <div>
      <PrintHeader
        onFiles={(files) => void importeer3MF(files)}
        onMakerWorld={(url) => void importeerMakerWorld(url)}
        importing={importing}
        makerWorldImporting={makerWorldImporting}
        importProgress={importProgress}
      />
      <section className="catalog-stats" aria-label="Catalogusoverzicht">
        <article className="catalog-stat-card">
          <span className="catalog-stat-icon blue"><Boxes size={20} /></span>
          <div><span>Producten</span><strong>{inventarisProducten.length}</strong></div>
          <small>{inventarisStats.totaleStuks} stuks op voorraad</small>
        </article>
        <article className="catalog-stat-card">
          <span className="catalog-stat-icon green"><CircleDollarSign size={20} /></span>
          <div><span>Verkoopwaarde</span><strong>{euro.format(inventarisStats.verkoopwaarde)}</strong></div>
          <small>Potentiele omzet</small>
        </article>
        <article className={`catalog-stat-card ${inventarisStats.lageVoorraad > 0 ? "needs-attention" : ""}`}>
          <span className="catalog-stat-icon orange"><AlertTriangle size={20} /></span>
          <div><span>Aandacht nodig</span><strong>{inventarisStats.lageVoorraad}</strong></div>
          <small>{inventarisStats.lageVoorraad ? "Onder minimumvoorraad" : "Alles is op niveau"}</small>
        </article>
      </section>
      {importMessage && (
        <div className={`import-message ${importMessage.type}`} role="status">
          <div className="import-message-content">
            <span>{importMessage.text}</span>
            {!!importMessage.aandachtspunten?.length && (
              <div className="import-warnings">
                <strong>Aandachtspunten</strong>
                {importMessage.aandachtspunten.map(({ bestandsnaam, meldingen }) => (
                  <div className="import-warning-file" key={bestandsnaam}>
                    <span>{bestandsnaam}</span>
                    <ul>
                      {meldingen.map((melding, index) => <li key={`${bestandsnaam}-${index}`}>{melding.trim()}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button aria-label="Melding sluiten" onClick={() => setImportMessage(null)}>×</button>
        </div>
      )}
      <PrintToolbar
        zoekterm={zoekterm}
        setZoekterm={setZoekterm}
        sortering={sortering}
        setSortering={setSortering}
        tagRanking={tagRanking}
        geselecteerdeTag={geselecteerdeTag}
        setGeselecteerdeTag={setGeselecteerdeTag}
        weergave={weergave}
        setWeergave={setWeergave}
      />
      <section className="bulk-actions" aria-label="Bulkacties voor de catalogus">
        <div className="bulk-actions__summary">
          <strong>{geselecteerdePrintIds.length}</strong>
          <span>{geselecteerdePrintIds.length === 1 ? "print geselecteerd" : "prints geselecteerd"}</span>
          {geselecteerdePrintIds.length > 0 && (
            <button type="button" className="bulk-actions__clear" onClick={() => setGeselecteerdePrintIds([])}>
              Selectie wissen
            </button>
          )}
        </div>
        <div className="bulk-actions__controls">
          <input
            type="text"
            value={bulkTagsInput}
            onChange={(event) => setBulkTagsInput(event.target.value)}
            placeholder="Tags toevoegen, gescheiden door komma's"
            aria-label="Tags in bulk toevoegen"
            disabled={bulkBezig || geselecteerdePrintIds.length === 0}
          />
          <button type="button" className="save-button" onClick={() => void bulkTagsToepassen()} disabled={bulkBezig || geselecteerdePrintIds.length === 0}>
            Tags toepassen
          </button>
          <button type="button" className="cancel-button bulk-actions__delete" onClick={() => void bulkVerwijderen()} disabled={bulkBezig || geselecteerdePrintIds.length === 0}>
            Verwijderen
          </button>
        </div>
      </section>
      <PrintsTable
        weergave={weergave}
        prints={gefilterdePrints}
        catalogusVoorraad={catalogusVoorraad}
        navigate={navigate}
        verwijderen={verwijderen}
        setSelectedPrint={setSelectedPrint}
        setShowEditModal={setShowEditModal}
        toggleSplitPrint={(printData, checked) => void toggleSplitPrint(printData, checked)}
        voegUitgeprinteExemplarenToe={voegUitgeprinteExemplarenToe}
        pasCatalogusVoorraadAan={pasCatalogusVoorraadAan}
        geselecteerdePrintIds={geselecteerdePrintIds}
        alleZichtbarePrintsGeselecteerd={alleZichtbarePrintsGeselecteerd}
        enkeleZichtbarePrintsGeselecteerd={enkeleZichtbarePrintsGeselecteerd}
        togglePrintSelectie={togglePrintSelectie}
        toggleZichtbarePrints={toggleZichtbarePrints}
      />
      <EditPrintModal key={`${showEditModal}-${selectedPrint?.id ?? "new"}`} open={showEditModal} print={selectedPrint} filamentVoorraad={filamentVoorraad} setPrint={setSelectedPrint} onSave={savePrintChanges} onCancel={() => setShowEditModal(false)} />
    </div>
  );
}
