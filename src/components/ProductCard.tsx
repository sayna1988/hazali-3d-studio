import { useEffect, useState } from "react";
import { db } from "../database/db";
import type { SettingsModel } from "../types/Settings";

export default function Calculator() {

  const [naam, setNaam] =
    useState("");

  const [gewicht, setGewicht] =
    useState(0);

  const [uren, setUren] =
    useState(0);

  const [minuten, setMinuten] =
    useState(0);

  const [filamenten, setFilamenten] =
    useState<any[]>([]);

  const [filamentId, setFilamentId] =
    useState<number>();

  const [marge, setMarge] =
    useState(60);
const [foto, setFoto] =
  useState("");

const [settings, setSettings] =
  useState<SettingsModel | null>(null);
function uploadFoto(
  event: React.ChangeEvent<HTMLInputElement>
) {

  const file =
    event.target.files?.[0];

  if (!file) return;

  const reader =
    new FileReader();

  reader.onload = () => {

    setFoto(
      reader.result as string
    );

  };

  reader.readAsDataURL(file);

}
  useEffect(() => {

    async function laden() {

const data =
  await db.filamenten.toArray();

const opgeslagenSettings =
  await db.settings.get(1);

if (opgeslagenSettings) {

  setSettings(opgeslagenSettings);

}

setFilamenten(data);

    }

    laden();

  }, []);

  const filament =
    filamenten.find(
      f => f.id === filamentId
    );

  const materiaalKosten =
    filament
      ? (
          gewicht /
          1000
        ) *
        filament.prijsPerKg
      : 0;

const stroomKosten =
settings
  ? (
      ((uren * 60) + minuten) / 60
    ) *
    (settings.printerVermogen / 1000) *
    settings.stroomPrijs
  : 0;

  const verpakking =
settings
  ? settings.verpakking
  : 0.30;

  const onderhoud =
settings
  ? settings.onderhoud
  : 0.10;

  const kostprijs =

    materiaalKosten +

    stroomKosten +

    verpakking +

    onderhoud;

  const verkoopprijsExcl =

    kostprijs *

    (
      1 +
      marge / 100
    );

 const verkoopprijsIncl =
verkoopprijsExcl *
(
  1 +
  (
    settings
      ? settings.btw
      : 21
  ) / 100
);

  const winst =

    verkoopprijsExcl -

    kostprijs;

  async function opslaan() {

    if (!naam) {

      alert(
        "Geef eerst een naam op."
      );

      return;

    }

await db.prints.add({

  naam,

  foto,

  bron3mf: "",

  aangemaaktOp:
    new Date().toISOString(),

  gewicht,

  uren,

  minuten,

  filamentId:

    filament?.id,

  filamentNaam:

    filament?.naam || "",

  filamentKleuren: [],

  filamentGewicht:

    gewicht,

  amsAfval: 0,

  materiaalKosten,

  stroomKosten,

  onderhoudKosten:

    onderhoud,

  verpakkingKosten:

    verpakking,

  overigeKosten: 0,

  platform: "Etsy",

  platformKosten: 6.5,

  btw:

    settings
      ? settings.btw
      : 21,

  gewensteMarge:

    marge,

  kostprijs,

  verkoopprijs:

    verkoopprijsExcl,

  winst

});

    if (filament) {

      await db.filamenten.update(

        filament.id,

        {
          voorraadGram:
            filament.voorraadGram -
            gewicht
        }

      );

    }

    alert(
      "Print opgeslagen"
    );

  }

  return (

    <div>

      <h1>
        Nieuwe Berekening
      </h1>

      <div className="form-grid">

        <input
          placeholder="Naam print"
          value={naam}
          onChange={(e)=>
            setNaam(
              e.target.value
            )
          }
        />

        <input
          type="number"
          placeholder="Gewicht (g)"
          value={gewicht}
          onChange={(e)=>
            setGewicht(
              Number(
                e.target.value
              )
            )
          }
        />

        <input
          type="number"
          placeholder="Uren"
          value={uren}
          onChange={(e)=>
            setUren(
              Number(
                e.target.value
              )
            )
          }
        />

        <input
          type="number"
          placeholder="Minuten"
          value={minuten}
          onChange={(e)=>
            setMinuten(
              Number(
                e.target.value
              )
            )
          }
        />

        <select
          value={filamentId}
          onChange={(e)=>
            setFilamentId(
              Number(
                e.target.value
              )
            )
          }
        >

          {

            filamenten.map((f)=>(

              <option
                key={f.id}
                value={f.id}
              >
                {f.naam}
              </option>

            ))

          }

        </select>
<input
  type="file"
  accept="image/*"
  onChange={uploadFoto}
/>
      </div>

      <div
        style={{
          marginTop:"20px"
        }}
      >

        <label>

          Marge:

          {" "}

          {marge}%

        </label>

        <input
          type="range"
          min="0"
          max="200"
          value={marge}
          onChange={(e)=>
            setMarge(
              Number(
                e.target.value
              )
            )
          }
        />

      </div>

      <div
        className="dashboard-panel"
      >

        <h2>
          Kostenoverzicht
        </h2>

        <br />

        <p>
          Materiaal:
          €{
            materiaalKosten.toFixed(2)
          }
        </p>

        <p>
          Stroom:
          €{
            stroomKosten.toFixed(2)
          }
        </p>

        <p>
          Verpakking:
          €0.30
        </p>

        <p>
          Onderhoud:
          €0.10
        </p>

        <hr
          style={{
            margin:"15px 0"
          }}
        />

        <h3>
          Kostprijs:
          €{
            kostprijs.toFixed(2)
          }
        </h3>

        <br />

        <h3>
          Verkoopprijs excl. BTW:
          €{
            verkoopprijsExcl.toFixed(2)
          }
        </h3>

        <h3>
          Verkoopprijs incl. BTW:
          €{
            verkoopprijsIncl.toFixed(2)
          }
        </h3>

        <br />

        <div
          className="profit-badge"
        >

          Winst:
          €{
            winst.toFixed(2)
          }

        </div>

      </div>

      <button
        className="save-button"
        onClick={opslaan}
      >

        Opslaan als Print

      </button>

    </div>

  );

}