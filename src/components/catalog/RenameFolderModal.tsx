import { Folder, ImagePlus, Pencil, X } from "lucide-react";
import { useState } from "react";
import type { CatalogFolder } from "../../types/CatalogFolder";
import type { FolderUpdateInput } from "../../services/CatalogFolderService";

interface Props {
  folder: CatalogFolder | null;
  error?: string;
  saving: boolean;
  onRename: (input: FolderUpdateInput) => void;
  onCancel: () => void;
}

export default function RenameFolderModal({ folder, error, saving, onRename, onCancel }: Props) {
  const [name, setName] = useState(folder?.name ?? "");
  const [backgroundColor, setBackgroundColor] = useState(folder?.backgroundColor ?? "#1f9cff");
  const [useCustomColor, setUseCustomColor] = useState(Boolean(folder?.backgroundColor));
  const [iconImage, setIconImage] = useState(folder?.iconImage ?? "");

  if (!folder) return null;

  function uploadIcon(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setIconImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="rename-folder-title">
      <form
        className="modal catalog-modal"
        onSubmit={(event) => {
          event.preventDefault();
          onRename({
            name,
            backgroundColor: useCustomColor ? backgroundColor : undefined,
            iconImage: iconImage || undefined
          });
        }}
      >
        <h2 id="rename-folder-title"><Pencil size={20} /> Map aanpassen</h2>
        <div className="form-group">
          <label htmlFor="rename-folder-name">Mapnaam</label>
          <input id="rename-folder-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="folder-customizer">
          <label className="folder-color-toggle">
            <input type="checkbox" checked={useCustomColor} onChange={(event) => setUseCustomColor(event.target.checked)} />
            Achtergrondkleur gebruiken
          </label>
          <label className="folder-color-picker">
            <span>Kleur</span>
            <input type="color" value={backgroundColor} disabled={!useCustomColor} onChange={(event) => setBackgroundColor(event.target.value)} />
          </label>
          <div className="folder-icon-picker">
            <span>Icoonafbeelding</span>
            <div className="folder-icon-preview" aria-label="Mapicoon preview">
              {iconImage ? <img src={iconImage} alt="" /> : <Folder size={22} />}
            </div>
            <label className="folder-image-button">
              <ImagePlus size={15} />
              Afbeelding kiezen
              <input type="file" accept="image/*" hidden onChange={(event) => uploadIcon(event.target.files?.[0])} />
            </label>
            {iconImage && (
              <button type="button" className="folder-image-clear" onClick={() => setIconImage("")}>
                <X size={15} />
                Verwijderen
              </button>
            )}
          </div>
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
