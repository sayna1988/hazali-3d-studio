import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Prints.css";
import EditPrintModal from "../components/EditPrintModal/EditPrintModal";
import { import3MF } from "../services/PrintImportService";
import PrintsTable from "../components/PrintsTable/PrintsTable";
import PrintToolbar from "../components/PrintToolbar/PrintToolbar";
import PrintHeader from "../components/PrintHeader/PrintHeader";
import type { Print } from "../types/Print";
import { loadPrints, deletePrint, savePrint } from "../services/PrintService";

export default function Prints() {
  const [selectedPrint, setSelectedPrint] = useState<Print | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [prints, setPrints] = useState<Print[]>([]);
  const [zoekterm, setZoekterm] = useState("");
  const [sortering, setSortering] = useState("nieuwste");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const navigate = useNavigate();

  async function laden() { setPrints(await loadPrints()); }

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

  async function importeer3MF(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    try {
      setImporting(true);
      setImportMessage(null);
      const results = [];
      for (const file of files) results.push(await import3MF(file));
      await laden();
      const warnings = results.reduce((sum, result) => sum + result.waarschuwingen.length, 0);
      setImportMessage({
        type: "success",
        text: `${results.length} ${results.length === 1 ? "3MF-bestand" : "3MF-bestanden"} geanalyseerd en geïmporteerd${warnings ? ` · ${warnings} aandachtspunt${warnings === 1 ? "" : "en"}` : ""}.`
      });
    } catch (error) {
      console.error(error);
      setImportMessage({ type: "error", text: error instanceof Error ? error.message : "De 3MF kon niet worden geïmporteerd." });
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  }

  useEffect(() => {
    let actief = true;
    loadPrints().then((data) => { if (actief) setPrints(data); });
    return () => { actief = false; };
  }, []);

  const gefilterdePrints = [...prints]
    .filter((print) => print.naam?.toLowerCase().includes(zoekterm.toLowerCase()))
    .sort((a, b) => {
      if (sortering === "winst") return b.winst - a.winst;
      if (sortering === "verkoopprijs") return b.verkoopprijs - a.verkoopprijs;
      return (b.id || 0) - (a.id || 0);
    });

  return (
    <div>
      <PrintHeader
        onImport={() => document.getElementById("import3mf")?.click()}
        onImportChange={importeer3MF}
        importing={importing}
      />
      {importMessage && (
        <div className={`import-message ${importMessage.type}`} role="status">
          <span>{importMessage.text}</span>
          <button aria-label="Melding sluiten" onClick={() => setImportMessage(null)}>×</button>
        </div>
      )}
      <PrintToolbar zoekterm={zoekterm} setZoekterm={setZoekterm} sortering={sortering} setSortering={setSortering} />
      <PrintsTable prints={gefilterdePrints} navigate={navigate} verwijderen={verwijderen} setSelectedPrint={setSelectedPrint} setShowEditModal={setShowEditModal} />
      <EditPrintModal open={showEditModal} print={selectedPrint} setPrint={setSelectedPrint} onSave={savePrintChanges} onCancel={() => setShowEditModal(false)} />
    </div>
  );
}
