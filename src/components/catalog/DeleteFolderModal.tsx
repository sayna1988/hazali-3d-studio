import { Trash2 } from "lucide-react";
import type { CatalogFolder } from "../../types/CatalogFolder";
import type { FolderDeleteMode } from "../../services/CatalogFolderService";

interface Props {
  folder: CatalogFolder | null;
  childFolderCount: number;
  itemCount: number;
  saving: boolean;
  error?: string;
  onDelete: (mode: FolderDeleteMode) => void;
  onCancel: () => void;
}

export default function DeleteFolderModal({ folder, childFolderCount, itemCount, saving, error, onDelete, onCancel }: Props) {
  if (!folder) return null;

  const hasContent = childFolderCount > 0 || itemCount > 0;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-folder-title">
      <div className="modal catalog-modal">
        <h2 id="delete-folder-title"><Trash2 size={20} /> Map verwijderen</h2>
        <p className="catalog-modal__hint">
          {hasContent
            ? `"${folder.name}" bevat ${childFolderCount} ${childFolderCount === 1 ? "submap" : "submappen"} en ${itemCount} ${itemCount === 1 ? "catalogusitem" : "catalogusitems"}.`
            : `"${folder.name}" is leeg.`}
        </p>
        {error && <p className="catalog-modal__error">{error}</p>}
        <div className="catalog-delete-actions">
          {hasContent ? (
            <>
              <button type="button" className="danger-action" disabled={saving} onClick={() => onDelete("recursive")}>Map inclusief alle inhoud verwijderen</button>
              <button type="button" className="save-button" disabled={saving} onClick={() => onDelete("promote")}>Inhoud naar bovenliggende map verplaatsen</button>
            </>
          ) : (
            <button type="button" className="danger-action" disabled={saving} onClick={() => onDelete("recursive")}>Lege map verwijderen</button>
          )}
          <button type="button" className="cancel-button" onClick={onCancel}>Annuleren</button>
        </div>
      </div>
    </div>
  );
}
