import { Search, Filter } from "lucide-react";
import "./PrintToolbar.css";

interface Props {

  zoekterm: string;
  setZoekterm: (value: string) => void;

  sortering: string;
  setSortering: (value: string) => void;

}

export default function PrintToolbar({

  zoekterm,
  setZoekterm,
  sortering,
  setSortering

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

      <button
        className="filter-button"
      >

        <Filter size={16}/>

        Filter

      </button>

    </div>

  );

}