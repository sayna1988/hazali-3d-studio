import { Folder, MoreVertical } from "lucide-react";
import type { CatalogFolder } from "../../types/CatalogFolder";

interface Props {
  folder: CatalogFolder;
  childFolderCount: number;
  itemCount: number;
  menuOpen: boolean;
  onOpen: () => void;
  onToggleMenu: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}

export default function CatalogFolderCard({
  folder,
  childFolderCount,
  itemCount,
  menuOpen,
  onOpen,
  onToggleMenu,
  onRename,
  onMove,
  onDelete
}: Props) {
  return (
    <article className="catalog-folder-card" onDoubleClick={onOpen}>
      <button type="button" className="catalog-folder-card__main" onClick={onOpen} title={folder.name}>
        <span className="catalog-folder-card__icon"><Folder size={24} /></span>
        <span className="catalog-folder-card__text">
          <strong>{folder.name}</strong>
          <small>{childFolderCount} {childFolderCount === 1 ? "submap" : "submappen"} · {itemCount} {itemCount === 1 ? "item" : "items"}</small>
        </span>
      </button>
      <div className="catalog-folder-card__menu">
        <button type="button" aria-label={`Menu voor ${folder.name}`} title="Mapacties" onClick={(event) => { event.stopPropagation(); onToggleMenu(); }}>
          <MoreVertical size={18} />
        </button>
        {menuOpen && (
          <div className="catalog-folder-card__menu-panel" role="menu">
            <button type="button" role="menuitem" onClick={onOpen}>Openen</button>
            <button type="button" role="menuitem" onClick={onRename}>Hernoemen</button>
            <button type="button" role="menuitem" onClick={onMove}>Verplaatsen</button>
            <button type="button" role="menuitem" className="danger" onClick={onDelete}>Verwijderen</button>
          </div>
        )}
      </div>
    </article>
  );
}
