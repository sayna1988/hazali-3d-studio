import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../database/db";
import { savePrint } from "../services/PrintService";
import type { Print } from "../types/Print";
import type { Filament } from "../types/Filament";
import { colorName, colorsMatch, safeColor } from "../utils/colorNames";


import {
  ArrowLeft,
  Clock3,
  Euro,
  FileText,
  Package,
  TrendingUp,
  Image as ImageIcon,
  Download,
  Save,
  CheckCircle2,
  XCircle
} from "lucide-react";

export default function PrintDetails() {

  const { id } = useParams();

  const navigate =
    useNavigate();

  const [printData, setPrintData] =
    useState<Print | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [filamentVoorraad, setFilamentVoorraad] = useState<Filament[]>([]);
  const [opmerkingOpslaan, setOpmerkingOpslaan] = useState(false);
  const [opmerkingOpgeslagen, setOpmerkingOpgeslagen] = useState(false);

  useEffect(() => {

    async function laden() {

      try {

        setLoading(true);

        if (!id) {

          setPrintData(null);

          return;

        }

        const [data, voorraad] = await Promise.all([
          db.prints.get(Number(id)),
          db.filamenten.toArray()
        ]);

        setFilamentVoorraad(voorraad);

        setPrintData(
          data || null
        );

      }

      finally {

        setLoading(false);

      }

    }

    laden();

  }, [id]);

  async function slaOpmerkingOp() {
    if (!printData?.id) return;
    setOpmerkingOpslaan(true);
    try {
      await savePrint({ ...printData, opmerkingen: printData.opmerkingen ?? "" });
      setOpmerkingOpgeslagen(true);
    } finally {
      setOpmerkingOpslaan(false);
    }
  }

  const margin =
    useMemo(() => {

      if (
        !printData ||
        !printData.verkoopprijs
      ) {

        return 0;

      }

      return Math.round(

        (
          Number(
            printData.winst || 0
          ) /

          Number(
            printData.verkoopprijs || 1
          )

        ) * 100

      );

    }, [printData]);

  function formatDate(
    value?: string
  ) {

    if (!value)
      return "Onbekend";

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return "Onbekend";

    }

    return new Intl.DateTimeFormat(
      "nl-NL",
      {
        day: "2-digit",
        month: "long",
        year: "numeric"
      }
    ).format(date);

  }

  if (loading) {

    return (

      <div
        style={{
          padding: "32px"
        }}
      >

        <h1>
          Print laden...
        </h1>

      </div>

    );

  }

  if (!printData) {

    return (

      <div
        style={{
          padding: "32px"
        }}
      >

        <button
          className="save-button"
          onClick={() =>
            navigate("/prints")
          }
          style={{
            marginBottom: "24px"
          }}
        >

          <ArrowLeft
            size={16}
          />

          Terug naar prints

        </button>

        <div className="dashboard-panel">

          <h1>
            Print niet gevonden
          </h1>

          <p className="page-subtitle">

            Deze print bestaat niet meer
            of kon niet worden geladen.

          </p>

        </div>

      </div>

    );

  }

 const filamentKleuren: string[] =
  Array.isArray(
    printData?.filamentKleuren
  )
    ? printData.filamentKleuren
    : [];
  return (

    <div
      style={{
        padding: "32px"
      }}
    >

      <button
        className="save-button"
        onClick={() =>
          navigate("/prints")
        }
        style={{
          marginBottom: "24px"
        }}
      >

        <ArrowLeft
          size={16}
        />

        Terug naar prints

      </button>

      <div
        className="dashboard-panel"
      >

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "220px 1fr",
            gap: "24px"
          }}
        >

          <div
            style={{
              width: "220px",
              height: "220px",
              borderRadius: "22px",
              overflow: "hidden",
              background:
                "linear-gradient(145deg,#0D1A2B,#09111D)",
              border:
                "1px solid rgba(0,148,255,.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >

            {

              printData.foto

                ? (

                  <img
                    src={
                      printData.foto
                    }
                    alt={
                      printData.naam
                    }
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit:
                        "cover"
                    }}
                  />

                )

                : (

                  <ImageIcon
                    size={72}
                    color="#8CA0BD"
                  />

                )

            }

          </div>

          <div>

            <h1>

              {printData.naam}

            </h1>

            <p
              className="page-subtitle"
            >

              Bronbestand:

              {" "}

              {

                printData.bron3mf ||
                "Handmatig"

              }

            </p>

            {printData.bronBestand && (
              <button
                className="filter-button"
                style={{ marginTop: "16px" }}
                onClick={() => {
                  const bestand = printData.bronBestand;
                  if (!bestand) return;
                  const url = URL.createObjectURL(bestand);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = printData.bron3mf || `${printData.naam}.3mf`;
                  link.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download size={16} /> Origineel 3MF downloaden
              </button>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(4,1fr)",
                gap: "24px",
                marginTop: "24px"
              }}
            >

              <div>

                <Package
                  size={16}
                  color="#0094FF"
                />

                <h4>
                  Gewicht
                </h4>

                <h2>

                  {

                    printData.gewicht

                  } g

                </h2>

              </div>

              <div>

                <Clock3
                  size={16}
                  color="#0094FF"
                />

                <h4>
                  Printtijd
                </h4>

                <h2>

                  {

                    printData.uren

                  }u

                  {" "}

                  {

                    printData.minuten

                  }m

                </h2>

              </div>

              <div>

                <Euro
                  size={16}
                  color="#0094FF"
                />

                <h4>
                  Kostprijs
                </h4>

                <h2>

                  €

                  {

                    Number(
                      printData.kostprijs || 0
                    ).toFixed(2)

                  }

                </h2>

              </div>

              <div>

                <TrendingUp
                  size={16}
                  color="#0094FF"
                />

                <h4>
                  Winst
                </h4>

                <h2>

                  €

                  {

                    Number(
                      printData.winst || 0
                    ).toFixed(2)

                  }

                </h2>

              </div>

            </div>

          </div>

        </div>

      </div>

      <div
        style={{
          marginTop: "24px",
          display: "grid",
          gridTemplateColumns:
            "1.2fr .8fr",
          gap: "24px"
        }}
      >

        <div
          className="dashboard-panel"
        >

          <h2>
            Details
          </h2>

<div className="details-list">

  <div className="detail-line">

    <span>Materiaal</span>

    <strong>
      €
      {Number(
        printData.materiaalKosten || 0
      ).toFixed(2)}
    </strong>

  </div>

  <div className="detail-line">

    <span>Stroom</span>

    <strong>
      €
      {Number(
        printData.stroomKosten || 0
      ).toFixed(2)}
    </strong>

  </div>

  <div className="detail-line">

    <span>Onderhoud</span>

    <strong>
      €
      {Number(
        printData.onderhoudKosten || 0
      ).toFixed(2)}
    </strong>

  </div>

  <div className="detail-line">

    <span>Verpakking</span>

    <strong>
      €
      {Number(
        printData.verpakkingKosten || 0
      ).toFixed(2)}
    </strong>

  </div>

  <div className="detail-line">

    <span>Overige kosten</span>

    <strong>
      €
      {Number(
        printData.overigeKosten || 0
      ).toFixed(2)}
    </strong>

  </div>

  <hr />

  <div className="detail-line">

    <span>Totale kostprijs</span>

    <strong>
      €
      {Number(
        printData.kostprijs || 0
      ).toFixed(2)}
    </strong>

  </div>

</div>

        </div>

        <div
          className="dashboard-panel"
        >

          <h2>
            Filamenten
          </h2>

          {

            filamentKleuren.length > 0

              ? (

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "10px"
                  }}
                >

                  {

                    filamentKleuren.map(
                      (
                        kleur,
                        index
                      ) => {
                        const voorraadGram = filamentVoorraad
                          .filter((filament) => colorsMatch(kleur, filament.kleur))
                          .reduce((totaal, filament) => totaal + filament.voorraadGram, 0);
                        const opVoorraad = voorraadGram > 0;
                        return (

                        <div
                          key={index}
                          title={kleur}
                          style={{
                            padding: "11px 14px",
                            borderRadius:
                              "12px",
                            background:
                              "rgba(0,148,255,.12)",
                            border:
                              "1px solid rgba(0,148,255,.2)"
                          }}
                        >

                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", background: safeColor(kleur), border: "1px solid rgba(255,255,255,.45)" }} />
                            <strong>{colorName(kleur)}</strong>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 7, color: opVoorraad ? "#6ee7b7" : "#fca5a5", fontSize: 12 }}>
                            {opVoorraad ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                            {opVoorraad ? `Op voorraad · ${voorraadGram.toLocaleString("nl-NL")} g` : "Niet op voorraad"}
                          </div>

                        </div>

                        );
                      }
                    )

                  }

                </div>

              )

              : (

                <p className="page-subtitle">

                  Er zijn nog geen
                  filamentkleuren gekoppeld
                  aan deze print.

                </p>

              )

          }

          <div
            style={{
              marginTop: "24px"
            }}
          >

            <div
              style={{
                display: "flex",
                gap: "10px",
                alignItems:
                  "center"
              }}
            >

              <FileText
                size={16}
                color="#0094FF"
              />

              <strong>
                Opmerking
              </strong>

            </div>

            <textarea
              value={printData.opmerkingen ?? ""}
              onChange={(event) => {
                setPrintData({ ...printData, opmerkingen: event.target.value });
                setOpmerkingOpgeslagen(false);
              }}
              placeholder="Schrijf hier je aantekeningen over deze print…"
              rows={4}
              style={{
                width: "100%", marginTop: 12, resize: "vertical", minHeight: 100,
                padding: "12px 14px", borderRadius: 10, color: "var(--text-primary)",
                background: "rgba(5,15,30,.65)", border: "1px solid rgba(0,148,255,.25)", outline: "none"
              }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 10 }}>
              <span style={{ color: opmerkingOpgeslagen ? "#6ee7b7" : "var(--text-muted)", fontSize: 12 }}>
                {opmerkingOpgeslagen ? "Aantekening opgeslagen" : "Wordt lokaal bij deze print bewaard"}
              </span>
              <button className="save-button" type="button" disabled={opmerkingOpslaan} onClick={slaOpmerkingOp}>
                <Save size={15} /> {opmerkingOpslaan ? "Opslaan…" : "Opslaan"}
              </button>
            </div>

          </div>

        </div>

      </div>

      <div
        style={{
          marginTop: "24px"
        }}
        className="dashboard-panel"
      >

        <h2>
          Projectinformatie
        </h2>

        <div
          className="details-grid"
        >

          <div>

            <label>
              Bestandsnaam
            </label>

            <div>

              {
                printData.bron3mf
              }

            </div>

          </div>

          <div>

            <label>
              Filament
            </label>

            <div>

              {
                printData.filamentNaam
              }

            </div>

          </div>

          <div>

            <label>
              Gewicht
            </label>

            <div>

              {
                printData.gewicht
              } g

            </div>

          </div>

          <div>

            <label>
              Printtijd
            </label>

            <div>

              {
                printData.uren
              }u {" "}
              {
                printData.minuten
              }m

            </div>

          </div>

          <div>

            <label>
              Importdatum
            </label>

            <div>

              {
                formatDate(
                  printData.aangemaaktOp
                )
              }

            </div>

          </div>

          <div>

            <label>
              Winstmarge
            </label>

            <div>

              {margin}%

            </div>

          </div>

          {[
            ["Printer", printData.printerNaam],
            ["Slicer", printData.slicer],
            ["Laaghoogte", printData.laaghoogte && `${printData.laaghoogte} mm`],
            ["Aantal lagen", printData.aantalLagen],
            ["Nozzle", printData.nozzleDiameter && `${printData.nozzleDiameter} mm`],
            ["Filamentlengte", printData.filamentLengteMeter && `${Number(printData.filamentLengteMeter).toFixed(2)} m`],
            ["Kleurbron", printData.kleurBron === "3mf-metadata" ? "3MF-metadata" : printData.kleurBron === "preview" ? "Preview-analyse" : undefined],
            ["Modelvolume", printData.modelVolumeCm3 && `${printData.modelVolumeCm3} cm³`],
            ["Modelafmetingen", printData.afmetingen && `${printData.afmetingen.x} × ${printData.afmetingen.y} × ${printData.afmetingen.z} mm`],
            ["Objecten", printData.objectAantal],
            ["Platen", printData.plateAantal],
            ["Bestandsgrootte", printData.bestandsGrootte && `${(printData.bestandsGrootte / 1024 / 1024).toFixed(2)} MB`]
          ].filter(([, value]) => value).map(([label, value]) => (
            <div key={String(label)}><label>{label}</label><div>{value}</div></div>
          ))}

        </div>

      </div>

      {(printData.importWaarschuwingen?.length ?? 0) > 0 && (
        <div className="dashboard-panel" style={{ marginTop: "24px", borderColor: "rgba(245,158,11,.3)" }}>
          <h2>Importcontrole</h2>
          <p className="page-subtitle" style={{ marginTop: "8px" }}>Niet iedere slicer stopt dezelfde gegevens in een 3MF. Controleer daarom deze punten:</p>
          <ul style={{ margin: "16px 0 0 20px", color: "#fcd34d" }}>
            {(printData.importWaarschuwingen ?? []).map((warning: string, index: number) => <li key={index}>{warning}</li>)}
          </ul>
        </div>
      )}

    </div>

  );

}
