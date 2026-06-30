import { FolderPlus } from "lucide-react";
import { useState } from "react";

interface Props {
  open: boolean;
  parentName: string;
  error?: string;
  saving: boolean;
  onCreate: (name: string) => void;
  onCancel: () => void;
}

export default function CreateFolderModal({ open, parentName, error, saving, onCreate, onCancel }: Props) {
  const [name, setName] = useState("");

  if (!open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="create-folder-title">
      <form className="modal catalog-modal" onSubmit={(event) => { event.preventDefault(); onCreate(name); }}>
        <h2 id="create-folder-title"><FolderPlus size={20} /> Nieuwe map</h2>
        <p className="catalog-modal__hint">Aanmaken in {parentName}.</p>
        <div className="form-group">
          <label htmlFor="new-folder-name">Mapnaam</label>
          <input id="new-folder-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Bijv. Pokéballs" />
        </div>
        {error && <p className="catalog-modal__error">{error}</p>}
        <div className="modal-buttons">
          <button type="submit" className="save-button" disabled={saving}>{saving ? "Aanmaken..." : "Aanmaken"}</button>
          <button type="button" className="cancel-button" onClick={onCancel}>Annuleren</button>
        </div>
      </form>
    </div>
  );
}
