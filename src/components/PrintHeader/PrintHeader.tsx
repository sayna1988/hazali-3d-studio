import { useRef, useState } from "react";
import { FileUp, Upload } from "lucide-react";
import "./PrintHeader.css";

interface Props {
  onFiles: (files: File[]) => void;
  importing?: boolean;
  importProgress?: { current: number; total: number } | null;
}

export default function PrintHeader({ onFiles, importing = false, importProgress = null }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function selectFiles(files: FileList | null) {
    const selected = Array.from(files ?? []);
    if (selected.length) onFiles(selected);
  }

  return (
    <div className="prints-header">
      <div>
        <h1>Mijn Prints</h1>
        <p className="page-subtitle">Overzicht van al je opgeslagen prints.</p>
      </div>

      <div className="print-header-actions">
        <button className="new-print-button">+ Nieuwe print</button>
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
      >
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
    </div>
  );
}
