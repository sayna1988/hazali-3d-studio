import "./EditPrintModal.css";
import type { Print } from "../../types/Print";
import { colorName, safeColor } from "../../utils/colorNames";

type PrintFilament = NonNullable<Print["filamenten"]>[number];

interface Props {

  open: boolean;

  print: Print | null;

  setPrint: (printData: Print) => void;

  onSave: () => void;

  onCancel: () => void;

}

export default function EditPrintModal({

  open,

  print,

  setPrint,

  onSave,

  onCancel

}: Props) {

  const updateFilament = (index: number, field: "gewicht" | "uren" | "minuten", value: number) => {
    if (!print) return;
    const filamenten: PrintFilament[] = [...(print.filamenten ?? print.filamentKleuren.map((kleur) => ({ kleur, gewicht: 0 })))];
    filamenten[index] = { ...filamenten[index], [field]: Math.max(0, value) };
    const gewicht = filamenten.reduce((sum, item) => sum + Number(item.gewicht || 0), 0);
    const totalMinutes = filamenten.reduce((sum, item) => sum + Number(item.uren || 0) * 60 + Number(item.minuten || 0), 0);
    setPrint({ ...print, filamenten, gewicht, filamentGewicht: gewicht, uren: Math.floor(totalMinutes / 60), minuten: totalMinutes % 60 });
  };

  if (!open || !print) {

    return null;

  }

  return (

    <div className="modal-overlay">

      <div className="modal">

        <h2>

          Print bewerken

        </h2>

        <div className="form-group">

          <label>

            Naam

          </label>

          <input

            value={print.naam}

            onChange={(e)=>

              setPrint({

                ...print,

                naam: e.target.value

              })

            }

          />

        </div>

        <div className="form-group">

          <label>

            Gewicht (g)

          </label>

          <input

            type="number"

            value={print.gewicht}

            onChange={(e)=>

              setPrint({

                ...print,

                gewicht: Number(
                  e.target.value
                )

              })

            }

          />

        </div>

        <div className="form-group">

          <label>

            Verkoopprijs (€)

          </label>

          <input

            type="number"

            step="0.01"

            value={print.verkoopprijs}

            onChange={(e)=>

              setPrint({

                ...print,

                verkoopprijs: Number(
                  e.target.value
                )

              })

            }

          />

        </div>

        <div className="form-group">
          <label>Tags voor deze print</label>
          <input
            value={(print.tags ?? []).join(", ")}
            placeholder="Bijv. klantorder, decoratie, spoed"
            onChange={(event) => setPrint({
              ...print,
              tags: Array.from(new Set(
                event.target.value.split(",").map((tag: string) => tag.trim()).filter(Boolean)
              ))
            })}
          />
          <small className="tag-help">Scheid meerdere tags met een komma.</small>
        </div>

        <label className="split-toggle">
          <input
            type="checkbox"
            checked={Boolean(print.splitPrint)}
            onChange={(event) => setPrint({
              ...print,
              splitPrint: event.target.checked,
              splitPrintBron: event.target.checked ? "handmatig" : undefined
            })}
          />
          <span><strong>Split print</strong><small>Elke kleur wordt op een aparte plaat geprint.</small></span>
        </label>

        {print.splitPrint && (
          <div className="split-filaments">
            <div className="split-filaments-heading">
              <strong>Gegevens per kleur</strong>
              {print.splitPrintBron === "3mf" && <span>Automatisch uit 3MF</span>}
            </div>
            {(print.filamenten ?? print.filamentKleuren.map((kleur): PrintFilament => ({ kleur, gewicht: 0 }))).map((filament, index) => (
              <div className="split-filament-card" key={`${filament.kleur}-${index}`}>
                <div className="split-color-name"><i style={{ background: safeColor(filament.kleur) }} />{colorName(filament.kleur)}</div>
                <label>Gewicht (g)<input type="number" min="0" step="0.01" value={filament.gewicht || 0} onChange={(e) => updateFilament(index, "gewicht", Number(e.target.value))} /></label>
                <label>Uren<input type="number" min="0" value={filament.uren || 0} onChange={(e) => updateFilament(index, "uren", Number(e.target.value))} /></label>
                <label>Minuten<input type="number" min="0" max="59" value={filament.minuten || 0} onChange={(e) => updateFilament(index, "minuten", Number(e.target.value))} /></label>
              </div>
            ))}
          </div>
        )}

        <div className="modal-buttons">

          <button

            className="save-button"

            onClick={onSave}

          >

            Opslaan

          </button>

          <button

            className="cancel-button"

            onClick={onCancel}

          >

            Annuleren

          </button>

        </div>

      </div>

    </div>

  );

}
