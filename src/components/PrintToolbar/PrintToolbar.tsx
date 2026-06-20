import { Search, Tag } from "lucide-react";
import "./PrintToolbar.css";

interface Props {

  zoekterm: string;
  setZoekterm: (value: string) => void;

  sortering: string;
  setSortering: (value: string) => void;
  tags: string[];
  geselecteerdeTag: string;
  setGeselecteerdeTag: (value: string) => void;

}

export default function PrintToolbar({

  zoekterm,
  setZoekterm,
  sortering,
  setSortering,
  tags,
  geselecteerdeTag,
  setGeselecteerdeTag

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

      <select

        className="sort-select"

        value={sortering}

        onChange={(e)=>

          setSortering(
            e.target.value
          )

        }

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

      <div className="tag-filter-wrapper">
        <Tag size={16} aria-hidden="true" />
        <select className="sort-select tag-filter" value={geselecteerdeTag} onChange={(event) => setGeselecteerdeTag(event.target.value)} aria-label="Filter op tag">
          <option value="">Alle tags</option>
          {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
        </select>
      </div>

    </div>

  );

}
