import { Move } from "lucide-react";
import { useState } from "react";
import type { CatalogFolder } from "../../types/CatalogFolder";
import FolderTree from "./FolderTree";

interface Props {
  open: boolean;
  title: string;
  folders: CatalogFolder[];
  initialFolderId: number | null;
  disabledFolderIds?: Set<number>;
  error?: string;
  saving: boolean;
  onMove: (folderId: number | null) => void;
  onCancel: () => void;
}

export default function MoveToFolderModal({
  open,
  title,
  folders,
  initialFolderId,
  disabledFolderIds,
  error,
  saving,
  onMove,
  onCancel
}: Props) {
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(initialFolderId);

  if (!open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="move-folder-title">
      <div className="modal catalog-modal">
        <h2 id="move-folder-title"><Move size={20} /> {title}</h2>
        <FolderTree folders={folders} selectedFolderId={selectedFolderId} onSelect={setSelectedFolderId} disabledFolderIds={disabledFolderIds} />
        {error && <p className="catalog-modal__error">{error}</p>}
        <div className="modal-buttons">
          <button type="button" className="save-button" disabled={saving} onClick={() => onMove(selectedFolderId)}>{saving ? "Verplaatsen..." : "Verplaatsen"}</button>
          <button type="button" className="cancel-button" onClick={onCancel}>Annuleren</button>
        </div>
      </div>
    </div>
  );
}
