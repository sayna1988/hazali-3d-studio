import { ArrowUpDown, ChevronDown, Grid2X2, List, Search, Tag } from "lucide-react";
import "./PrintToolbar.css";

interface Props {

  zoekterm: string;
  setZoekterm: (value: string) => void;

  sortering: string;
  setSortering: (value: string) => void;
  tagRanking: Array<{ tag: string; aantal: number }>;
  geselecteerdeTag: string;
  setGeselecteerdeTag: (value: string) => void;
  weergave: "tabel" | "grid";
  setWeergave: (value: "tabel" | "grid") => void;

}

export default function PrintToolbar({

  zoekterm,
  setZoekterm,
  sortering,
  setSortering,
  tagRanking,
  geselecteerdeTag,
  setGeselecteerdeTag,
  weergave,
  setWeergave

}: Props) {

  return (

    <>
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

          <option value="winst">
            Hoogste winst
          </option>

          <option value="verkoopprijs">
            Hoogste verkoopprijs
          </option>
        </select>
        <ChevronDown size={16} aria-hidden="true" />
      </label>

      <label className="toolbar-select toolbar-select--tag">
        <Tag size={16} aria-hidden="true" />
        <select className="sort-select tag-filter" value={geselecteerdeTag} onChange={(event) => setGeselecteerdeTag(event.target.value)} aria-label="Filter op tag">
          <option value="">Alle tags</option>
          {tagRanking.map(({ tag, aantal }) => <option key={tag} value={tag}>{tag} ({aantal})</option>)}
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

    </div>

    <section className="tag-ranking" aria-labelledby="tag-ranking-title">
      <div className="tag-ranking__heading">
        <div>
          <Tag size={17} aria-hidden="true" />
          <strong id="tag-ranking-title">Meest gebruikte tags</strong>
        </div>
        <span>{tagRanking.length} {tagRanking.length === 1 ? "tag" : "tags"}</span>
      </div>
      {tagRanking.length > 0 ? (
        <div className="tag-ranking__list">
          {tagRanking.map(({ tag, aantal }) => (
            <button
              type="button"
              key={tag}
              className={geselecteerdeTag === tag ? "active" : ""}
              aria-pressed={geselecteerdeTag === tag}
              onClick={() => setGeselecteerdeTag(geselecteerdeTag === tag ? "" : tag)}
            >
              <span className="tag-ranking__name">{tag}</span>
              <span className="tag-ranking__count">{aantal}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="tag-ranking__empty">Nog geen tags toegevoegd.</p>
      )}
    </section>
    </>

  );

}
