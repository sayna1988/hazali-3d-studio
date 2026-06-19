import { Upload } from "lucide-react";
import "./PrintHeader.css";

interface Props {
  onImport: () => void;
  onImportChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  importing?: boolean;
}

export default function PrintHeader({

  onImport,
  onImportChange,
  importing = false

}: Props) {

  return (

    <div className="prints-header">

      <div>

        <h1>

          Mijn Prints

        </h1>

        <p className="page-subtitle">

          Overzicht van al je opgeslagen prints.

        </p>

      </div>

      <div
        style={{
          display: "flex",
          gap: "10px"
        }}
      >

        <button
          className="filter-button"
          onClick={onImport}
          disabled={importing}
        >

          <Upload size={16} />

          {importing ? "3MF analyseren…" : "Importeer 3MF"}

        </button>

        <button
          className="new-print-button"
        >

          + Nieuwe print

        </button>

        <input

          id="import3mf"

          type="file"

          accept=".3mf"

          multiple

          hidden

          onChange={onImportChange}

        />

      </div>

    </div>

  );

}
