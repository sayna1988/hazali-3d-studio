import type { ChangeEvent } from "react";

import "./InventoryForm.css";

interface Props {

  naam: string;
  setNaam: (value: string) => void;

  sku: string;
  setSku: (value: string) => void;

  voorraad: number;
  setVoorraad: (value: number) => void;

  kostprijs: number;
  setKostprijs: (value: number) => void;

  verkoopprijs: number;
  setVerkoopprijs: (value: number) => void;

  locatie: string;
  setLocatie: (value: string) => void;

  uploadFoto: (
    event: ChangeEvent<HTMLInputElement>
  ) => void;

  toevoegen: () => void;

}

export default function InventoryForm({

  naam,
  setNaam,

  sku,
  setSku,

  voorraad,
  setVoorraad,

  kostprijs,
  setKostprijs,

  verkoopprijs,
  setVerkoopprijs,

  locatie,
  setLocatie,

  uploadFoto,

  toevoegen

}: Props) {

  return (

    <div className="dashboard-panel">

      <h2>

        Nieuw product

      </h2>

      <div className="form-grid">

        <input
          placeholder="Naam"
          value={naam}
          onChange={(e)=>
            setNaam(e.target.value)
          }
        />

        <input
          placeholder="SKU"
          value={sku}
          onChange={(e)=>
            setSku(e.target.value)
          }
        />

        <input
          type="number"
          placeholder="Voorraad"
          value={voorraad}
          onChange={(e)=>
            setVoorraad(
              Number(e.target.value)
            )
          }
        />

        <input
          type="number"
          placeholder="Kostprijs"
          value={kostprijs}
          onChange={(e)=>
            setKostprijs(
              Number(e.target.value)
            )
          }
        />

        <input
          type="number"
          placeholder="Verkoopprijs"
          value={verkoopprijs}
          onChange={(e)=>
            setVerkoopprijs(
              Number(e.target.value)
            )
          }
        />

        <input
          placeholder="Locatie"
          value={locatie}
          onChange={(e)=>
            setLocatie(e.target.value)
          }
        />

        <input
          type="file"
          accept="image/*"
          onChange={uploadFoto}
        />

      </div>

      <button
        className="save-button"
        onClick={toevoegen}
      >

        Product toevoegen

      </button>

    </div>

  );

}