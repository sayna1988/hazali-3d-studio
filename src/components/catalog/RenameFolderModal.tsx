import { Pencil } from "lucide-react";
import { useState } from "react";
import type { CatalogFolder } from "../../types/CatalogFolder";

interface Props {
  folder: CatalogFolder | null;
  error?: string;
  saving: boolean;
  onRename: (name: string) => void;
  onCancel: () => void;
}

export default function RenameFolderModal({ folder, error, saving, onRename, onCancel }: Props) {
  const [name, setName] = useState("");

  if (!folder) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="rename-folder-title">
      <form className="modal catalog-modal" onSubmit={(event) => { event.preventDefault(); onRename(name); }}>
        <h2 id="rename-folder-title"><Pencil size={20} /> Map hernoemen</h2>
        <div className="form-group">
          <label htmlFor="rename-folder-name">Mapnaam</label>
          <input id="rename-folder-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        {error && <p className="catalog-modal__error">{error}</p>}
        <div className="modal-buttons">
          <button type="submit" className="save-button" disabled={saving}>{saving ? "Opslaan..." : "Opslaan"}</button>
          <button type="button" className="cancel-button" onClick={onCancel}>Annuleren</button>
        </div>
      </form>
    </div>
  );
}
