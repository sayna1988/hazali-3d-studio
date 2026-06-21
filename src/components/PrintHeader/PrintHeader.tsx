import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { FileUp, Link2, Upload } from "lucide-react";
import "./PrintHeader.css";

interface Props {
  onFiles: (files: File[]) => void;
  onMakerWorld: (url: string) => void;
  importing?: boolean;
  makerWorldImporting?: boolean;
  importProgress?: { current: number; total: number } | null;
}

export default function PrintHeader({ onFiles, onMakerWorld, importing = false, makerWorldImporting = false, importProgress = null }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [makerWorldUrl, setMakerWorldUrl] = useState("");
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
    if (value && !makerWorldImporting && !importing) onMakerWorld(value);
  }

  return (
    <div className="prints-header">
      <div>
        <h1>Catalogus</h1>
        <p className="page-subtitle">Overzicht van al je opgeslagen prints.</p>
      </div>

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
          <small>{importing ? "Sluit deze pagina niet tijdens het importeren." : "Of klik om één of meerdere bestanden te kiezen"}</small>
        </span>
        <span className="dropzone-action"><Upload size={16} /> Bestanden kiezen</span>
        <input
          ref={inputRef}
          id="import3mf"
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
        <label htmlFor="makerworld-url">
          <strong>Importeer vanuit MakerWorld</strong>
          <small>De 3MF, modelnaam, tags en printfoto’s worden toegevoegd.</small>
        </label>
        <div className="makerworld-import-controls">
          <input
            id="makerworld-url"
            type="url"
            inputMode="url"
            value={makerWorldUrl}
            onChange={(event) => setMakerWorldUrl(event.target.value)}
            placeholder="https://makerworld.com/models/1423288"
            disabled={makerWorldImporting || importing}
            required
          />
          <button type="submit" disabled={!makerWorldUrl.trim() || makerWorldImporting || importing}>
            {makerWorldImporting ? <span className="makerworld-spinner" aria-hidden="true" /> : <Link2 size={16} />}
            {makerWorldImporting ? "Importeren…" : "Importeren"}
          </button>
        </div>
      </form>
    </div>
  );
}
