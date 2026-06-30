import { Folder, MoreVertical } from "lucide-react";
import type { DragEvent } from "react";
import type { CSSProperties } from "react";
import type { CatalogFolder } from "../../types/CatalogFolder";

interface Props {
  folder: CatalogFolder;
  childFolderCount: number;
  itemCount: number;
  menuOpen: boolean;
  dropActive: boolean;
  onOpen: () => void;
  onToggleMenu: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
}

function hexToRgba(hex: string | undefined, alpha: number) {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return undefined;
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function CatalogFolderCard({
  folder,
  childFolderCount,
  itemCount,
  menuOpen,
  dropActive,
  onOpen,
  onToggleMenu,
  onRename,
  onMove,
  onDelete,
  onDragOver,
  onDragLeave,
  onDrop
}: Props) {
  const customColor = hexToRgba(folder.backgroundColor, 0.34);
  const cardStyle: CSSProperties | undefined = customColor
    ? {
      background: `linear-gradient(145deg, ${customColor}, rgba(5,17,32,.96))`,
      borderColor: hexToRgba(folder.backgroundColor, 0.5)
    }
    : undefined;

  return (
    <article
      className={`catalog-folder-card ${dropActive ? "drop-active" : ""}`}
      style={cardStyle}
      onDoubleClick={onOpen}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <button type="button" className="catalog-folder-card__main" onClick={onOpen} title={folder.name}>
        <span className="catalog-folder-card__icon">
          {folder.iconImage ? <img src={folder.iconImage} alt="" /> : <Folder size={24} />}
        </span>
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
