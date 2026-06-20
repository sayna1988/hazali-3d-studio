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
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importMessage, setImportMessage] = useState<ImportMessage | null>(null);
  const navigate = useNavigate();

  async function laden() {
    setPrints(await loadPrints());
  }

  async function savePrintChanges() {
    if (!selectedPrint) return;
    await savePrint(selectedPrint);
    setShowEditModal(false);
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

  useEffect(() => {
    let actief = true;
    loadPrints().then((data) => { if (actief) setPrints(data); });
    return () => { actief = false; };
  }, []);

  const beschikbareTags = useMemo(
    () => [...new Set(prints.flatMap((print) => print.tags ?? []))].sort((a, b) => a.localeCompare(b, "nl")),
    [prints]
  );

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
      <PrintHeader onFiles={(files) => void importeer3MF(files)} importing={importing} importProgress={importProgress} />
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
        tags={beschikbareTags}
        geselecteerdeTag={geselecteerdeTag}
        setGeselecteerdeTag={setGeselecteerdeTag}
      />
      <PrintsTable prints={gefilterdePrints} navigate={navigate} verwijderen={verwijderen} setSelectedPrint={setSelectedPrint} setShowEditModal={setShowEditModal} />
      <EditPrintModal open={showEditModal} print={selectedPrint} setPrint={setSelectedPrint} onSave={savePrintChanges} onCancel={() => setShowEditModal(false)} />
    </div>
  );
}
