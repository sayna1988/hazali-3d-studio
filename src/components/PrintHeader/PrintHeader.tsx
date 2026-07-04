import { useId, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { FileUp, Link2, Upload } from "lucide-react";
import "./PrintHeader.css";
import type { CatalogFolder } from "../../types/CatalogFolder";
import { sortFolders } from "../../services/CatalogFolderService";
import BottomSheet from "../BottomSheet/BottomSheet";

interface Props {
  onFiles: (files: File[]) => void;
  onMakerWorld: (url: string, folderId: number | null) => void;
  makerWorldFolderId: number | null;
  onMakerWorldFolderChange: (folderId: number | null) => void;
  folders?: CatalogFolder[];
  importing?: boolean;
  makerWorldImporting?: boolean;
  importProgress?: { current: number; total: number } | null;
}

interface FolderOption {
  folder: CatalogFolder;
  depth: number;
}

function folderOptions(folders: CatalogFolder[]) {
  const byParent = new Map<number | null, CatalogFolder[]>();
  folders.forEach((folder) => {
    const parentId = folder.parentId ?? null;
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), folder]);
  });
  byParent.forEach((items) => items.sort(sortFolders));

  const options: FolderOption[] = [];
  const visited = new Set<number>();
  const visit = (parentId: number | null, depth: number) => {
    for (const folder of byParent.get(parentId) ?? []) {
      if (folder.id === undefined || visited.has(folder.id)) continue;
      visited.add(folder.id);
      options.push({ folder, depth });
      visit(folder.id, depth + 1);
    }
  };
  visit(null, 0);
  return options;
}

export default function PrintHeader({
  onFiles,
  onMakerWorld,
  makerWorldFolderId,
  onMakerWorldFolderChange,
  folders = [],
  importing = false,
  makerWorldImporting = false,
  importProgress = null
}: Props) {
  const [importSheetOpen, setImportSheetOpen] = useState(false);

  return (
    <div className="prints-header">
      <div>
        <h1>Catalogus</h1>
        <p className="page-subtitle">Overzicht van al je opgeslagen prints.</p>
      </div>

      <button type="button" className="prints-header__sheet-trigger" onClick={() => setImportSheetOpen(true)}>
        <FileUp size={18} />
        Importeren
      </button>

      <ImportControls
        onFiles={onFiles}
        onMakerWorld={onMakerWorld}
        makerWorldFolderId={makerWorldFolderId}
        onMakerWorldFolderChange={onMakerWorldFolderChange}
        folders={folders}
        importing={importing}
        makerWorldImporting={makerWorldImporting}
        importProgress={importProgress}
        className="prints-header__desktop-imports"
      />

      <BottomSheet
        open={importSheetOpen}
        title="Prints importeren"
        description="Voeg 3MF-bestanden of een MakerWorld-link toe aan de catalogus."
        onClose={() => setImportSheetOpen(false)}
      >
        <ImportControls
          onFiles={(files) => {
            onFiles(files);
            setImportSheetOpen(false);
          }}
          onMakerWorld={(url, folderId) => {
            onMakerWorld(url, folderId);
            setImportSheetOpen(false);
          }}
          makerWorldFolderId={makerWorldFolderId}
          onMakerWorldFolderChange={onMakerWorldFolderChange}
          folders={folders}
          importing={importing}
          makerWorldImporting={makerWorldImporting}
          importProgress={importProgress}
          className="prints-import-sheet"
        />
      </BottomSheet>
    </div>
  );
}

function ImportControls({
  onFiles,
  onMakerWorld,
  makerWorldFolderId,
  onMakerWorldFolderChange,
  folders = [],
  importing = false,
  makerWorldImporting = false,
  importProgress = null,
  className = ""
}: Props & { className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  const makerWorldUrlId = useId();
  const [dragging, setDragging] = useState(false);
  const [makerWorldUrl, setMakerWorldUrl] = useState("");
  const makerWorldFolderOptions = useMemo(() => folderOptions(folders), [folders]);
  const progressPercentage = importProgress?.total
    ? Math.min(100, Math.max(0, (importProgress.current / importProgress.total) * 100))
    : 0;

  function selectFiles(files: FileList | null) {
    const selected = Array.from(files ?? []);
    if (selected.length) onFiles(selected);
  }

  function submitMakerWorld(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = makerWorldUrl.trim();
    if (value && !makerWorldImporting && !importing) onMakerWorld(value, makerWorldFolderId);
  }

  return (
    <div className={`prints-import-controls ${className}`.trim()}>
      <div
        className={`three-mf-dropzone${dragging ? " is-dragging" : ""}${importing ? " is-importing" : ""}`}
        onDragEnter={(event) => { event.preventDefault(); if (!importing) setDragging(true); }}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = importing ? "none" : "copy"; }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!importing) selectFiles(event.dataTransfer.files);
        }}
        onClick={() => !importing && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (!importing && (event.key === "Enter" || event.key === " ")) inputRef.current?.click();
        }}
        role="button"
        tabIndex={0}
        aria-disabled={importing}
        aria-label={importing ? `3MF-bestanden analyseren: ${Math.round(progressPercentage)} procent voltooid` : undefined}
      >
        {importing && (
          <span
            className="dropzone-progress"
            style={{ width: `${progressPercentage}%` }}
            role="progressbar"
            aria-label="Verwerkingsvoortgang"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressPercentage)}
          />
        )}
        <span className="dropzone-icon"><FileUp size={24} /></span>
        <span className="dropzone-copy">
          <strong>{importing ? `3MF-bestanden analyseren (${importProgress?.current ?? 0}/${importProgress?.total ?? 0})` : "Sleep je 3MF-bestanden hierheen"}</strong>
          <small>{importing ? "Sluit deze pagina niet tijdens het importeren." : "Of klik om een of meerdere bestanden te kiezen"}</small>
        </span>
        <span className="dropzone-action"><Upload size={16} /> Bestanden kiezen</span>
        <input
          ref={inputRef}
          id={fileInputId}
          type="file"
          accept=".3mf,application/vnd.ms-package.3dmanufacturing-3dmodel+xml"
          multiple
          hidden
          disabled={importing}
          onChange={(event) => { selectFiles(event.target.files); event.target.value = ""; }}
        />
      </div>

      <form className="makerworld-import" onSubmit={submitMakerWorld}>
        <span className="makerworld-import-icon"><Link2 size={21} /></span>
        <label htmlFor={makerWorldUrlId}>
          <strong>Importeer vanuit MakerWorld</strong>
          <small>De 3MF, modelnaam, tags en printfoto's worden toegevoegd.</small>
        </label>
        <div className="makerworld-import-controls">
          <input
            id={makerWorldUrlId}
            type="url"
            inputMode="url"
            value={makerWorldUrl}
            onChange={(event) => setMakerWorldUrl(event.target.value)}
            placeholder="https://makerworld.com/models/1423288"
            disabled={makerWorldImporting || importing}
            required
          />
          <select
            className="makerworld-folder-select"
            value={makerWorldFolderId ?? ""}
            onChange={(event) => onMakerWorldFolderChange(event.target.value ? Number(event.target.value) : null)}
            disabled={makerWorldImporting || importing}
            aria-label="MakerWorld importmap"
          >
            <option value="">Catalogus hoofdmap</option>
            {makerWorldFolderOptions.map(({ folder, depth }) => (
              <option key={folder.id} value={folder.id}>
                {"--".repeat(depth)}{depth > 0 ? " " : ""}{folder.name}
              </option>
            ))}
          </select>
          <button type="submit" disabled={!makerWorldUrl.trim() || makerWorldImporting || importing}>
            {makerWorldImporting ? <span className="makerworld-spinner" aria-hidden="true" /> : <Link2 size={16} />}
            {makerWorldImporting ? "Importeren..." : "Importeren"}
          </button>
        </div>
      </form>
    </div>
  );
}
