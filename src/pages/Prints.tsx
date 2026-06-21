import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Prints.css";
import EditPrintModal from "../components/EditPrintModal/EditPrintModal";
import { import3MF } from "../services/PrintImportService";
import PrintsTable from "../components/PrintsTable/PrintsTable";
import PrintToolbar from "../components/PrintToolbar/PrintToolbar";
import PrintHeader from "../components/PrintHeader/PrintHeader";
import type { Print } from "../types/Print";
import { loadPrints, deletePrint, savePrint } from "../services/PrintService";
import { db } from "../database/db";
import { importMakerWorldUrl } from "../services/MakerWorldImportService";

interface ImportMessage {
  type: "success" | "error";
  text: string;
  aandachtspunten?: Array<{ bestandsnaam: string; meldingen: string[] }>;
}

export default function Prints() {
  const [selectedPrint, setSelectedPrint] = useState<Print | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [prints, setPrints] = useState<Print[]>([]);
  const [zoekterm, setZoekterm] = useState("");
  const [sortering, setSortering] = useState("nieuwste");
  const [geselecteerdeTag, setGeselecteerdeTag] = useState("");
  const [importing, setImporting] = useState(false);
  const [makerWorldImporting, setMakerWorldImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importMessage, setImportMessage] = useState<ImportMessage | null>(null);
  const [catalogusVoorraad, setCatalogusVoorraad] = useState<Record<number, number>>({});
  const navigate = useNavigate();

  async function laden() {
    setPrints(await loadPrints());
  }

  async function laadCatalogusVoorraad() {
    const producten = await db.inventory.toArray();
    setCatalogusVoorraad(Object.fromEntries(
      producten
        .filter((product) => product.printId !== undefined)
        .map((product) => [product.printId!, product.voorraad])
    ));
  }

  async function voegUitgeprinteExemplarenToe(print: Print, aantal: number) {
    if (print.id === undefined || aantal < 1) return;

    await db.transaction("rw", db.inventory, async () => {
      const bestaand = await db.inventory
        .filter((product) => product.printId === print.id)
        .first();

      if (bestaand?.id !== undefined) {
        await db.inventory.update(bestaand.id, { voorraad: bestaand.voorraad + aantal });
        return;
      }

      await db.inventory.add({
        printId: print.id,
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
    });

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
    await deletePrint(id);
    await laden();
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
    const results: Array<{ bestandsnaam: string; result: Awaited<ReturnType<typeof import3MF>> }> = [];
    const mislukt: string[] = [];

    try {
      for (const [index, file] of geldigeBestanden.entries()) {
        try {
          results.push({ bestandsnaam: file.name, result: await import3MF(file) });
        } catch (error) {
          console.error(error);
          mislukt.push(file.name);
        }
        setImportProgress({ current: index + 1, total: geldigeBestanden.length });
      }

      await laden();
      const aandachtspunten = results
        .filter(({ result }) => result.waarschuwingen.length > 0)
        .map(({ bestandsnaam, result }) => ({ bestandsnaam, meldingen: result.waarschuwingen }));
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
    loadPrints().then((data) => { if (actief) setPrints(data); });
    db.inventory.toArray().then((producten) => {
      if (!actief) return;
      setCatalogusVoorraad(Object.fromEntries(
        producten
          .filter((product) => product.printId !== undefined)
          .map((product) => [product.printId!, product.voorraad])
      ));
    });
    return () => { actief = false; };
  }, []);

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

  return (
    <div>
      <PrintHeader
        onFiles={(files) => void importeer3MF(files)}
        onMakerWorld={(url) => void importeerMakerWorld(url)}
        importing={importing}
        makerWorldImporting={makerWorldImporting}
        importProgress={importProgress}
      />
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
      />
      <PrintsTable prints={gefilterdePrints} catalogusVoorraad={catalogusVoorraad} navigate={navigate} verwijderen={verwijderen} setSelectedPrint={setSelectedPrint} setShowEditModal={setShowEditModal} toggleSplitPrint={(printData, checked) => void toggleSplitPrint(printData, checked)} voegUitgeprinteExemplarenToe={voegUitgeprinteExemplarenToe} />
      <EditPrintModal key={`${showEditModal}-${selectedPrint?.id ?? "new"}`} open={showEditModal} print={selectedPrint} setPrint={setSelectedPrint} onSave={savePrintChanges} onCancel={() => setShowEditModal(false)} />
    </div>
  );
}
