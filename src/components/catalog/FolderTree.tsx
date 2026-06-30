import { Folder, FolderOpen } from "lucide-react";
import type { CatalogFolder } from "../../types/CatalogFolder";
import { sortFolders } from "../../services/CatalogFolderService";

interface Props {
  folders: CatalogFolder[];
  selectedFolderId: number | null;
  onSelect: (folderId: number | null) => void;
  disabledFolderIds?: Set<number>;
}

interface TreeNode {
  folder: CatalogFolder;
  depth: number;
}

function buildRows(folders: CatalogFolder[]) {
  const byParent = new Map<number | null, CatalogFolder[]>();
  folders.forEach((folder) => {
    const parentId = folder.parentId ?? null;
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), folder]);
  });
  byParent.forEach((items) => items.sort(sortFolders));

  const rows: TreeNode[] = [];
  const visited = new Set<number>();

  function visit(parentId: number | null, depth: number) {
    for (const folder of byParent.get(parentId) ?? []) {
      if (folder.id === undefined || visited.has(folder.id)) continue;
      visited.add(folder.id);
      rows.push({ folder, depth });
      visit(folder.id, depth + 1);
    }
  }

  visit(null, 0);
  return rows;
}

export default function FolderTree({ folders, selectedFolderId, onSelect, disabledFolderIds = new Set<number>() }: Props) {
  const rows = buildRows(folders);

  return (
    <div className="folder-tree" role="tree" aria-label="Mappenlijst">
      <button type="button" className={selectedFolderId === null ? "active" : ""} onClick={() => onSelect(null)}>
        <FolderOpen size={16} />
        <span>Catalogus hoofdmap</span>
      </button>
      {rows.map(({ folder, depth }) => {
        const id = folder.id;
        if (id === undefined) return null;
        const disabled = disabledFolderIds.has(id);
        return (
          <button
            type="button"
            key={id}
            className={selectedFolderId === id ? "active" : ""}
            style={{ paddingLeft: 12 + depth * 18 }}
            disabled={disabled}
            onClick={() => onSelect(id)}
            title={folder.name}
          >
            <Folder size={16} />
            <span>{folder.name}</span>
          </button>
        );
      })}
    </div>
  );
}
