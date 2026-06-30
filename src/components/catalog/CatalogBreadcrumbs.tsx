import { ArrowLeft, ChevronRight } from "lucide-react";
import type { CatalogFolder } from "../../types/CatalogFolder";

interface Props {
  path: CatalogFolder[];
  onNavigate: (folderId: number | null) => void;
}

export default function CatalogBreadcrumbs({ path, onNavigate }: Props) {
  const currentParentId = path.length > 1 ? path[path.length - 2].id ?? null : null;
  const inFolder = path.length > 0;

  return (
    <nav className="catalog-breadcrumbs" aria-label="Cataloguspad">
      <button type="button" className="catalog-back-button" onClick={() => onNavigate(currentParentId)} disabled={!inFolder} title="Een map omhoog">
        <ArrowLeft size={16} />
        <span>Terug</span>
      </button>
      <ol>
        <li>
          <button type="button" onClick={() => onNavigate(null)}>Catalogus</button>
        </li>
        {path.map((folder) => (
          <li key={folder.id}>
            <ChevronRight size={15} aria-hidden="true" />
            <button type="button" onClick={() => onNavigate(folder.id ?? null)} title={folder.name}>{folder.name}</button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
