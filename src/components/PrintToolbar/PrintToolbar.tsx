import { ArrowUpDown, ChevronDown, FileDown, FolderPlus, Grid2X2, List, Search } from "lucide-react";
import "./PrintToolbar.css";

interface Props {

  zoekterm: string;
  setZoekterm: (value: string) => void;
  zoekBereik: "current" | "global";
  setZoekBereik: (value: "current" | "global") => void;

  sortering: string;
  setSortering: (value: string) => void;
  weergave: "tabel" | "grid";
  setWeergave: (value: "tabel" | "grid") => void;
  onExport: () => void;
  exportBezig: boolean;
  onCreateFolder: () => void;

}

export default function PrintToolbar({

  zoekterm,
  setZoekterm,
  zoekBereik,
  setZoekBereik,
  sortering,
  setSortering,
  weergave,
  setWeergave,
  onExport,
  exportBezig,
  onCreateFolder

}: Props) {

  return (

    <div className="prints-toolbar">

      <div className="search-wrapper">

        <Search
          size={18}
          className="search-icon"
        />

        <input

          className="prints-search"

          placeholder="Zoek prints..."

          value={zoekterm}

          onChange={(e)=>

            setZoekterm(
              e.target.value
            )

          }

        />

      </div>

      <div className="search-scope" role="group" aria-label="Zoekbereik">
        <button type="button" className={zoekBereik === "current" ? "active" : ""} aria-pressed={zoekBereik === "current"} onClick={() => setZoekBereik("current")}>Huidige map</button>
        <button type="button" className={zoekBereik === "global" ? "active" : ""} aria-pressed={zoekBereik === "global"} onClick={() => setZoekBereik("global")}>Alles</button>
      </div>

      <label className="toolbar-select toolbar-select--sort">
        <ArrowUpDown size={16} aria-hidden="true" />
        <select
          className="sort-select"
          value={sortering}
          onChange={(e)=>
            setSortering(
              e.target.value
            )
          }
          aria-label="Sorteer prints"
        >
          <option value="nieuwste">
            Nieuwste eerst
          </option>

          <option value="oudste">
            Oudste eerst
          </option>

          <option value="naam-az">
            Naam A-Z
          </option>

          <option value="naam-za">
            Naam Z-A
          </option>

          <option value="handmatig">
            Handmatige volgorde
          </option>

          <option value="winst">
            Hoogste winst
          </option>

          <option value="verkoopprijs">
            Hoogste vk-prijs
          </option>
        </select>
        <ChevronDown size={16} aria-hidden="true" />
      </label>

      <div className="view-switcher" role="group" aria-label="Catalogusweergave">
        <button type="button" className={weergave === "tabel" ? "active" : ""} aria-pressed={weergave === "tabel"} onClick={() => setWeergave("tabel")} title="Tabelweergave">
          <List size={17} />
          <span>Tabel</span>
        </button>
        <button type="button" className={weergave === "grid" ? "active" : ""} aria-pressed={weergave === "grid"} onClick={() => setWeergave("grid")} title="Gridweergave">
          <Grid2X2 size={16} />
          <span>Grid</span>
        </button>
      </div>

      <button type="button" className="catalog-export-button" onClick={onExport} disabled={exportBezig}>
        <FileDown size={16} />
        <span>{exportBezig ? "Exporteren..." : "Export PDF"}</span>
      </button>

      <button type="button" className="catalog-export-button catalog-new-folder-toolbar" onClick={onCreateFolder}>
        <FolderPlus size={16} />
        <span>Nieuwe map</span>
      </button>

    </div>

  );

}
