import { useCallback, useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { FolderPlus, Move } from "lucide-react";
import "./Prints.css";
import EditPrintModal from "../components/EditPrintModal/EditPrintModal";
import { import3MF } from "../services/PrintImportService";
import PrintsTable from "../components/PrintsTable/PrintsTable";
import PrintToolbar from "../components/PrintToolbar/PrintToolbar";
import PrintHeader from "../components/PrintHeader/PrintHeader";
import type { Print } from "../types/Print";
import { loadPrints, loadPrintSummaries, deletePrint, savePrint } from "../services/PrintService";
import type { CatalogFolder } from "../types/CatalogFolder";
import CatalogBreadcrumbs from "../components/catalog/CatalogBreadcrumbs";
import CatalogFolderGrid from "../components/catalog/CatalogFolderGrid";
import CreateFolderModal from "../components/catalog/CreateFolderModal";
import DeleteFolderModal from "../components/catalog/DeleteFolderModal";
import MoveToFolderModal from "../components/catalog/MoveToFolderModal";
import RenameFolderModal from "../components/catalog/RenameFolderModal";
import {
  createFolder,
  deleteFolder,
  getDescendantFolderIds,
  loadCatalogFolders,
  moveCatalogItems,
  moveFolder,
  renameFolder,
  sortFolders,
  sortPrints,
  type FolderDeleteMode,
  type FolderUpdateInput
} from "../services/CatalogFolderService";
import { db } from "../database/db";
import { importMakerWorldUrl } from "../services/MakerWorldImportService";
import { createInventory, deleteInventory, loadInventory, updateInventory } from "../services/InventoryService";
import { loadFilaments } from "../services/FilamentService";
import type { Filament } from "../types/Filament";
import type { Inventory } from "../types/Inventory";
import { exportCatalogusPdf } from "../utils/catalogExportPdf";
import { catalogPricingMap } from "../utils/printPricing";

interface ImportMessage {
  type: "success" | "error";
  text: string;
  aandachtspunten?: Array<{ bestandsnaam: string; meldingen: string[] }>;
}

const printDragMimeType = "application/x-hazali-print-ids";

interface MovePrintSelection {
  ids: number[];
  title: string;
  initialFolderId: number | null;
}

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
  const [bulkBezig, setBulkBezig] = useState(false);
  const [zoekterm, setZoekterm] = useState("");
  const [sortering, setSortering] = useState("nieuwste");
  const [geselecteerdeTag] = useState("");
  const [weergave, setWeergave] = useState<"tabel" | "grid">(() =>
    window.localStorage.getItem("catalogus-weergave") === "grid" ? "grid" : "tabel"
  );
  const [importing, setImporting] = useState(false);
  const [makerWorldImporting, setMakerWorldImporting] = useState(false);
  const [exportBezig, setExportBezig] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importMessage, setImportMessage] = useState<ImportMessage | null>(null);
  const [catalogusVoorraad, setCatalogusVoorraad] = useState<Record<number, number>>({});
  const [inventarisProducten, setInventarisProducten] = useState<Inventory[]>([]);
  const [filamentVoorraad, setFilamentVoorraad] = useState<Filament[]>([]);
  const [folders, setFolders] = useState<CatalogFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [folderModalError, setFolderModalError] = useState("");
  const [folderSaving, setFolderSaving] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [renameFolderTarget, setRenameFolderTarget] = useState<CatalogFolder | null>(null);
  const [moveFolderTarget, setMoveFolderTarget] = useState<CatalogFolder | null>(null);
  const [moveFolderDisabledIds, setMoveFolderDisabledIds] = useState<Set<number>>(new Set());
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<CatalogFolder | null>(null);
  const [movePrintSelection, setMovePrintSelection] = useState<MovePrintSelection | null>(null);
  const [openMenuFolderId, setOpenMenuFolderId] = useState<number | null>(null);
  const [draggedPrintIds, setDraggedPrintIds] = useState<number[]>([]);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<number | null>(null);
  const navigate = useNavigate();

  async function laden() {
    const [printsData, filamentenData, producten, folderData] = await Promise.all([loadPrints(), loadFilaments(), loadInventory(), loadCatalogFolders()]);
    setPrints(printsData);
    setFilamentVoorraad(filamentenData);
    setInventarisProducten(producten);
    setCatalogusVoorraad(catalogusVoorraadMap(producten));
    setFolders(folderData);
  }

  async function laadFolders() {
    setFolders(await loadCatalogFolders());
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
          const result = await import3MF(file, currentFolderId);
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
      const result = await importMakerWorldUrl(url, undefined, currentFolderId);
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
    const verversCatalogusNaSync = () => {
      void Promise.all([loadPrintSummaries(), db.folders.orderBy("sortOrder").toArray()])
        .then(([printData, folderData]) => {
          if (!actief) return;
          setPrints(printData);
          setFolders(folderData);
        })
        .catch((error) => console.error(error));
    };
    Promise.all([loadPrints(), loadFilaments(), loadInventory(), loadCatalogFolders()]).then(([printData, filamentData, producten, folderData]) => {
      if (!actief) return;
      setPrints(printData);
      setFilamentVoorraad(filamentData);
      setInventarisProducten(producten);
      setFolders(folderData);
      setCatalogusVoorraad(Object.fromEntries(
        producten
          .filter((product) => product.printId !== undefined)
          .map((product) => [product.printId!, product.voorraad])
      ));
      setCatalogLoading(false);
    }).catch((error) => {
      console.error(error);
      if (actief) {
        setImportMessage({ type: "error", text: "De catalogus kon niet worden geladen." });
        setCatalogLoading(false);
      }
    });
    window.addEventListener("hazali:prints-synced", verversNaSync);
    window.addEventListener("hazali:folders-synced", verversCatalogusNaSync);
    window.addEventListener("hazali:inventory-synced", laadCatalogusVoorraad);
    return () => {
      actief = false;
      window.removeEventListener("hazali:prints-synced", verversNaSync);
      window.removeEventListener("hazali:folders-synced", verversCatalogusNaSync);
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

  const pricingByPrintId = useMemo(
    () => catalogPricingMap(prints, filamentVoorraad),
    [prints, filamentVoorraad]
  );

  const folderById = useMemo(
    () => new Map(folders.filter((folder) => folder.id !== undefined).map((folder) => [folder.id!, folder])),
    [folders]
  );

  const folderPath = useCallback((folderId: number | null) => {
    const path: CatalogFolder[] = [];
    const visited = new Set<number>();
    let id = folderId;
    while (id !== null && !visited.has(id)) {
      visited.add(id);
      const folder = folderById.get(id);
      if (!folder) break;
      path.unshift(folder);
      id = folder.parentId ?? null;
    }
    return path;
  }, [folderById]);

  const currentFolderPath = useMemo(() => folderPath(currentFolderId), [currentFolderId, folderPath]);
  const currentFolderName = currentFolderPath.at(-1)?.name ?? "Catalogus hoofdmap";
  const zoek = zoekterm.trim().toLocaleLowerCase("nl-NL");

  const countsByFolderId = useMemo(() => {
    const counts: Record<number, { childFolderCount: number; itemCount: number }> = {};
    folders.forEach((folder) => {
      if (folder.id === undefined) return;
      counts[folder.id] = { childFolderCount: 0, itemCount: 0 };
    });
    folders.forEach((folder) => {
      if (folder.parentId !== null && folder.parentId !== undefined && counts[folder.parentId]) counts[folder.parentId].childFolderCount += 1;
    });
    prints.forEach((print) => {
      if (print.folderId !== null && print.folderId !== undefined && counts[print.folderId]) counts[print.folderId].itemCount += 1;
    });
    return counts;
  }, [folders, prints]);

  const zichtbareFolders = useMemo(() => {
    const basis = folders.filter((folder) => (folder.parentId ?? null) === currentFolderId);

    return basis.sort(sortFolders);
  }, [currentFolderId, folders]);

  const folderPathByPrintId = useMemo<Record<number, string>>(() => ({}), []);

  const gefilterdePrints = sortPrints(
    prints
      .filter((print) => (print.folderId ?? null) === currentFolderId)
      .filter((print) => {
        return !zoek || print.naam?.toLocaleLowerCase("nl-NL").includes(zoek) || print.tags?.some((tag) => tag.toLocaleLowerCase("nl-NL").includes(zoek));
      })
      .filter((print) => !geselecteerdeTag || print.tags?.includes(geselecteerdeTag)),
    sortering,
    pricingByPrintId
  );

  const zichtbarePrintIds = gefilterdePrints
    .map((print) => print.id)
    .filter((id): id is number => id !== undefined);
  const alleZichtbarePrintsGeselecteerd = zichtbarePrintIds.length > 0 && zichtbarePrintIds.every((id) => geselecteerdePrintIds.includes(id));
  const enkeleZichtbarePrintsGeselecteerd = zichtbarePrintIds.some((id) => geselecteerdePrintIds.includes(id));

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

  function resetFolderModalState() {
    setFolderModalError("");
    setFolderSaving(false);
    setOpenMenuFolderId(null);
  }

  async function mapAanmaken(name: string) {
    setFolderSaving(true);
    setFolderModalError("");
    try {
      await createFolder(name, currentFolderId);
      setCreateFolderOpen(false);
      await laadFolders();
    } catch (error) {
      setFolderModalError(error instanceof Error ? error.message : "De map kon niet worden aangemaakt.");
    } finally {
      setFolderSaving(false);
    }
  }

  async function mapHernoemen(input: FolderUpdateInput) {
    if (renameFolderTarget?.id === undefined) return;
    setFolderSaving(true);
    setFolderModalError("");
    try {
      await renameFolder(renameFolderTarget.id, input);
      setRenameFolderTarget(null);
      await laadFolders();
    } catch (error) {
      setFolderModalError(error instanceof Error ? error.message : "De map kon niet worden hernoemd.");
    } finally {
      setFolderSaving(false);
    }
  }

  async function openMapVerplaatsen(folder: CatalogFolder) {
    if (folder.id === undefined) return;
    resetFolderModalState();
    const descendants = await getDescendantFolderIds(folder.id);
    setMoveFolderDisabledIds(new Set([folder.id, ...descendants]));
    setMoveFolderTarget(folder);
  }

  async function mapVerplaatsen(targetParentId: number | null) {
    if (moveFolderTarget?.id === undefined) return;
    setFolderSaving(true);
    setFolderModalError("");
    try {
      await moveFolder(moveFolderTarget.id, targetParentId);
      setMoveFolderTarget(null);
      await laadFolders();
    } catch (error) {
      setFolderModalError(error instanceof Error ? error.message : "De map kon niet worden verplaatst.");
    } finally {
      setFolderSaving(false);
    }
  }

  function openPrintsVerplaatsen(selection: MovePrintSelection) {
    resetFolderModalState();
    setMovePrintSelection(selection);
  }

  function openPrintVerplaatsen(printData: Print) {
    if (printData.id === undefined) return;
    openPrintsVerplaatsen({
      ids: [printData.id],
      title: `"${printData.naam}" verplaatsen naar`,
      initialFolderId: printData.folderId ?? null
    });
  }

  function openBulkPrintsVerplaatsen() {
    const ids = prints
      .map((print) => print.id)
      .filter((id): id is number => id !== undefined && geselecteerdePrintIds.includes(id));
    if (ids.length === 0) return;

    const selectedPrints = prints.filter((print) => print.id !== undefined && ids.includes(print.id));
    const firstFolderId = selectedPrints[0]?.folderId ?? null;
    const sameFolder = selectedPrints.every((print) => (print.folderId ?? null) === firstFolderId);
    openPrintsVerplaatsen({
      ids,
      title: `${ids.length} ${ids.length === 1 ? "print" : "prints"} verplaatsen naar`,
      initialFolderId: sameFolder ? firstFolderId : currentFolderId
    });
  }

  async function printVerplaatsen(targetFolderId: number | null) {
    if (!movePrintSelection?.ids.length) return;
    const ids = movePrintSelection.ids;
    setFolderSaving(true);
    setFolderModalError("");
    try {
      await moveCatalogItems(ids, targetFolderId);
      const movedCount = ids.length;
      setMovePrintSelection(null);
      setGeselecteerdePrintIds((huidig) => huidig.filter((id) => !ids.includes(id)));
      await laden();
      setImportMessage({
        type: "success",
        text: `${movedCount} ${movedCount === 1 ? "print is" : "prints zijn"} verplaatst.`
      });
    } catch (error) {
      setFolderModalError(error instanceof Error ? error.message : "Het item kon niet worden verplaatst.");
    } finally {
      setFolderSaving(false);
    }
  }

  function draggedIdsFromEvent(event: DragEvent<HTMLElement>) {
    const raw = event.dataTransfer.getData(printDragMimeType);
    if (!raw) return draggedPrintIds;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return draggedPrintIds;
      return parsed.filter((id): id is number => Number.isInteger(id));
    } catch {
      return draggedPrintIds;
    }
  }

  function handlePrintDragStart(printData: Print, event: DragEvent<HTMLElement>) {
    if (printData.id === undefined) return;
    const ids = geselecteerdePrintIds.includes(printData.id) ? geselecteerdePrintIds : [printData.id];
    setDraggedPrintIds(ids);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(printDragMimeType, JSON.stringify(ids));
    event.dataTransfer.setData("text/plain", `${ids.length} ${ids.length === 1 ? "print" : "prints"} verplaatsen`);
  }

  function handlePrintDragEnd() {
    setDraggedPrintIds([]);
    setDropTargetFolderId(null);
  }

  function handleFolderDragOver(event: DragEvent<HTMLElement>, folderId: number) {
    if (draggedPrintIds.length === 0 && !event.dataTransfer.types.includes(printDragMimeType)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetFolderId(folderId);
  }

  function handleFolderDragLeave(folderId: number) {
    setDropTargetFolderId((current) => current === folderId ? null : current);
  }

  async function handleDropOnFolder(event: DragEvent<HTMLElement>, folderId: number) {
    event.preventDefault();
    event.stopPropagation();
    const ids = draggedIdsFromEvent(event);
    setDraggedPrintIds([]);
    setDropTargetFolderId(null);
    if (ids.length === 0) return;

    try {
      await moveCatalogItems(ids, folderId);
      setGeselecteerdePrintIds((huidig) => huidig.filter((id) => !ids.includes(id)));
      await laden();
      const folderName = folderById.get(folderId)?.name ?? "de map";
      setImportMessage({
        type: "success",
        text: `${ids.length} ${ids.length === 1 ? "print is" : "prints zijn"} verplaatst naar ${folderName}.`
      });
    } catch (error) {
      setImportMessage({
        type: "error",
        text: error instanceof Error ? error.message : "De prints konden niet worden verplaatst."
      });
    }
  }

  async function mapVerwijderen(mode: FolderDeleteMode) {
    if (deleteFolderTarget?.id === undefined) return;
    setFolderSaving(true);
    setFolderModalError("");
    try {
      await deleteFolder(deleteFolderTarget.id, mode);
      if (currentFolderId === deleteFolderTarget.id) setCurrentFolderId(deleteFolderTarget.parentId ?? null);
      setDeleteFolderTarget(null);
      await laden();
    } catch (error) {
      setFolderModalError(error instanceof Error ? error.message : "De map kon niet worden verwijderd.");
    } finally {
      setFolderSaving(false);
    }
  }

  async function exporteerCatalogus() {
    const actieveFilters = [
      geselecteerdeTag ? `Tag: ${geselecteerdeTag}` : "",
      zoekterm.trim() ? `Zoekterm: ${zoekterm.trim()}` : ""
    ].filter(Boolean).join(" / ") || "Alle producten";

    setExportBezig(true);
    try {
      await exportCatalogusPdf(gefilterdePrints, inventarisProducten, actieveFilters);
      setImportMessage({
        type: "success",
        text: `${gefilterdePrints.length} ${gefilterdePrints.length === 1 ? "catalogusitem is" : "catalogusitems zijn"} geexporteerd naar PDF.`
      });
    } catch (error) {
      console.error(error);
      setImportMessage({
        type: "error",
        text: "PDF-export is mislukt. Probeer het opnieuw."
      });
    } finally {
      setExportBezig(false);
    }
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
      {catalogLoading ? (
        <div className="catalog-loading">Catalogus laden...</div>
      ) : (
        <>
          <CatalogFolderGrid
            folders={zichtbareFolders}
            countsByFolderId={countsByFolderId}
            openMenuFolderId={openMenuFolderId}
            dropTargetFolderId={dropTargetFolderId}
            onToggleMenu={(folderId) => setOpenMenuFolderId((huidig) => huidig === folderId ? null : folderId)}
            onOpen={setCurrentFolderId}
            onRename={(folder) => { resetFolderModalState(); setRenameFolderTarget(folder); }}
            onMove={(folder) => void openMapVerplaatsen(folder)}
            onDelete={(folder) => { resetFolderModalState(); setDeleteFolderTarget(folder); }}
            onDragOverFolder={handleFolderDragOver}
            onDragLeaveFolder={handleFolderDragLeave}
            onDropOnFolder={(event, folderId) => void handleDropOnFolder(event, folderId)}
          />
          {zichtbareFolders.length === 0 && gefilterdePrints.length === 0 && (
            <div className="catalog-empty-state">
              {zoek ? "Geen mappen of catalogusitems gevonden." : "Deze map is leeg."}
            </div>
          )}
        </>
      )}
      <section className="catalog-organizer" aria-label="Catalogusmappen">
        <CatalogBreadcrumbs path={currentFolderPath} onNavigate={setCurrentFolderId} />
      </section>
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
          <PrintToolbar
            zoekterm={zoekterm}
            setZoekterm={setZoekterm}
            sortering={sortering}
            setSortering={setSortering}
            weergave={weergave}
            setWeergave={setWeergave}
            onExport={() => void exporteerCatalogus()}
            exportBezig={exportBezig}
          />
          <button type="button" className="catalog-action-button" onClick={() => { resetFolderModalState(); setCreateFolderOpen(true); }}>
            <FolderPlus size={15} />
            Nieuwe map
          </button>
          <button type="button" className="catalog-action-button bulk-actions__move" onClick={openBulkPrintsVerplaatsen} disabled={bulkBezig || geselecteerdePrintIds.length === 0}>
            <Move size={15} />
            Verplaatsen
          </button>
          <button type="button" className="catalog-action-button danger bulk-actions__delete" onClick={() => void bulkVerwijderen()} disabled={bulkBezig || geselecteerdePrintIds.length === 0}>
            Verwijderen
          </button>
        </div>
      </section>
      <PrintsTable
        weergave={weergave}
        prints={gefilterdePrints}
        catalogusVoorraad={catalogusVoorraad}
        pricingByPrintId={pricingByPrintId}
        folderPathByPrintId={folderPathByPrintId}
        navigate={navigate}
        verwijderen={verwijderen}
        onMovePrint={openPrintVerplaatsen}
        onPrintDragStart={handlePrintDragStart}
        onPrintDragEnd={handlePrintDragEnd}
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
      <EditPrintModal key={`${showEditModal}-${selectedPrint?.id ?? "new"}`} open={showEditModal} print={selectedPrint} filamentVoorraad={filamentVoorraad} folders={folders} setPrint={setSelectedPrint} onSave={savePrintChanges} onCancel={() => setShowEditModal(false)} />
      <CreateFolderModal key={createFolderOpen ? `create-${currentFolderId ?? "root"}` : "create-closed"} open={createFolderOpen} parentName={currentFolderName} error={folderModalError} saving={folderSaving} onCreate={(name) => void mapAanmaken(name)} onCancel={() => { resetFolderModalState(); setCreateFolderOpen(false); }} />
      <RenameFolderModal key={renameFolderTarget?.id ?? "rename-closed"} folder={renameFolderTarget} error={folderModalError} saving={folderSaving} onRename={(input) => void mapHernoemen(input)} onCancel={() => { resetFolderModalState(); setRenameFolderTarget(null); }} />
      <MoveToFolderModal key={moveFolderTarget?.id ?? "move-folder-closed"} open={Boolean(moveFolderTarget)} title={moveFolderTarget ? `"${moveFolderTarget.name}" verplaatsen naar` : "Map verplaatsen"} folders={folders} initialFolderId={moveFolderTarget?.parentId ?? null} disabledFolderIds={moveFolderDisabledIds} error={folderModalError} saving={folderSaving} onMove={(folderId) => void mapVerplaatsen(folderId)} onCancel={() => { resetFolderModalState(); setMoveFolderTarget(null); }} />
      <MoveToFolderModal key={movePrintSelection?.ids.join("-") ?? "move-print-closed"} open={Boolean(movePrintSelection)} title={movePrintSelection?.title ?? "Prints verplaatsen"} folders={folders} initialFolderId={movePrintSelection?.initialFolderId ?? null} error={folderModalError} saving={folderSaving} onMove={(folderId) => void printVerplaatsen(folderId)} onCancel={() => { resetFolderModalState(); setMovePrintSelection(null); }} />
      <DeleteFolderModal folder={deleteFolderTarget} childFolderCount={deleteFolderTarget?.id === undefined ? 0 : countsByFolderId[deleteFolderTarget.id]?.childFolderCount ?? 0} itemCount={deleteFolderTarget?.id === undefined ? 0 : countsByFolderId[deleteFolderTarget.id]?.itemCount ?? 0} error={folderModalError} saving={folderSaving} onDelete={(mode) => void mapVerwijderen(mode)} onCancel={() => { resetFolderModalState(); setDeleteFolderTarget(null); }} />
    </div>
  );
}
