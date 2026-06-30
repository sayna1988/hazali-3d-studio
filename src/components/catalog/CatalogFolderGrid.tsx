import type { DragEvent } from "react";
import type { CatalogFolder } from "../../types/CatalogFolder";
import CatalogFolderCard from "./CatalogFolderCard";

interface FolderCounts {
  childFolderCount: number;
  itemCount: number;
}

interface Props {
  folders: CatalogFolder[];
  countsByFolderId: Record<number, FolderCounts>;
  openMenuFolderId: number | null;
  dropTargetFolderId: number | null;
  onToggleMenu: (folderId: number) => void;
  onOpen: (folderId: number) => void;
  onRename: (folder: CatalogFolder) => void;
  onMove: (folder: CatalogFolder) => void;
  onDelete: (folder: CatalogFolder) => void;
  onDragOverFolder: (event: DragEvent<HTMLElement>, folderId: number) => void;
  onDragLeaveFolder: (folderId: number) => void;
  onDropOnFolder: (event: DragEvent<HTMLElement>, folderId: number) => void;
}

export default function CatalogFolderGrid({
  folders,
  countsByFolderId,
  openMenuFolderId,
  dropTargetFolderId,
  onToggleMenu,
  onOpen,
  onRename,
  onMove,
  onDelete,
  onDragOverFolder,
  onDragLeaveFolder,
  onDropOnFolder
}: Props) {
  if (folders.length === 0) return null;

  return (
    <section className="catalog-folder-grid-section" aria-label="Mappen">
      <div className="catalog-folder-grid">
        {folders.map((folder) => {
          const id = folder.id;
          if (id === undefined) return null;
          const counts = countsByFolderId[id] ?? { childFolderCount: 0, itemCount: 0 };
          return (
            <CatalogFolderCard
              key={id}
              folder={folder}
              childFolderCount={counts.childFolderCount}
              itemCount={counts.itemCount}
              menuOpen={openMenuFolderId === id}
              dropActive={dropTargetFolderId === id}
              onToggleMenu={() => onToggleMenu(id)}
              onOpen={() => onOpen(id)}
              onRename={() => onRename(folder)}
              onMove={() => onMove(folder)}
              onDelete={() => onDelete(folder)}
              onDragOver={(event) => onDragOverFolder(event, id)}
              onDragLeave={() => onDragLeaveFolder(id)}
              onDrop={(event) => onDropOnFolder(event, id)}
            />
          );
        })}
      </div>
    </section>
  );
}
