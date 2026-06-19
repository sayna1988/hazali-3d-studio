import { useEffect, useState } from "react";
import { db } from "../database/db";
import type { SettingsModel } from "../types/Settings";
import { berekenPrint } from "../services/CalculationService";
import type { Filament } from "../types/Filament";
import { createPrint } from "../services/PrintService";

export default function Calculator() {

    const [foto,setFoto] =
  useState("");

  const [naam, setNaam] =
    useState("");

  const [gewicht, setGewicht] =
    useState(0);

  const [uren, setUren] =
    useState(0);

  const [minuten, setMinuten] =
    useState(0);

  const [filamenten, setFilamenten] =
  useState<Filament[]>([]);

  const [filamentId, setFilamentId] =
    useState<number>();

  const [marge, setMarge] =
    useState(60);

const [settings,
  setSettings] =
  useState<SettingsModel | null>(
    null
  );
  
    function uploadFoto(
  event: React.ChangeEvent<HTMLInputElement>
){

  const file =
    event.target.files?.[0];

  if(!file) return;

  const reader =
    new FileReader();

  reader.onload = () => {

    setFoto(
      reader.result as string
    );

  };

  reader.readAsDataURL(
    file
  );

}
  useEffect(() => {

    
    
    async function laden() {

      const data =
        await db.filamenten.toArray();
const opgeslagenSettings =
  await db.settings.get(1);

if (opgeslagenSettings) {

  setSettings(
    opgeslagenSettings
  );

}
      setFilamenten(data);

      if (data.length > 0) {
        setFilamentId(data[0].id);
      }

    }

    laden();

  }, []);

  const filament: Filament | undefined =
  filamenten.find(
    f => f.id === filamentId
  );

  
  const berekening = berekenPrint(

  gewicht,

  uren,

  minuten,

  marge,

  filament,

  settings

);
const {

  materiaalKosten,

  stroomKosten,

  verpakkingKosten,

  onderhoudKosten,

  kostprijs,

  verkoopprijs,

  verkoopprijsIncl,

  winst

} = berekening;
async function opslaan() {

  if (!naam) {

    alert("Geef eerst een naam op.");

    return;

  }

    await createPrint({

      naam,

      foto,
      
      aangemaaktOp: new Date().toISOString(),
      
      gewicht,

      uren,

      minuten,

      filamentNaam: filament?.naam || "",
      
      filamentKleuren: [],

      filamentId: filament?.id,

      filamentGewicht: gewicht,

      amsAfval: 0,

      kostprijs,

      materiaalKosten,

        stroomKosten,

        onderhoudKosten,

        verpakkingKosten,

        overigeKosten: 0,

        platform: "Etsy",

        platformKosten:

settings
  ? settings.platformKosten
  : 6.5,

        btw:

settings
  ? settings.btw
  : 21,

        gewensteMarge: marge,
      verkoopprijs,

      winst

    });

    if (filament) {

      await db.filamenten.update(
  filament.id!,
  {
    voorraadGram:
      filament.voorraadGram -
      gewicht
  }
);

    }
setNaam("");
setGewicht(0);
setUren(0);
setMinuten(0);
setFoto("");
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
<p>

Printer:

{" "}

{

settings
? settings.printerNaam
: "Onbekend"

}

</p>

<br />
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
            verkoopprijs.toFixed(2)
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
