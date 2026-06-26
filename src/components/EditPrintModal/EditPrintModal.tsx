import "./EditPrintModal.css";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Print } from "../../types/Print";
import type { Filament } from "../../types/Filament";
import { filamentColorLabel, filamentColorValue, filamentOptionLabel } from "../../utils/filamentColor";

type PrintFilament = NonNullable<Print["filamenten"]>[number];

interface Props {

  open: boolean;

  print: Print | null;

  filamentVoorraad?: Filament[];

  setPrint: (printData: Print) => void;

  onSave: (tags: string[]) => void;

  onCancel: () => void;

}

export default function EditPrintModal({

  open,

  print,

  filamentVoorraad = [],

  setPrint,

  onSave,

  onCancel

}: Props) {

  const [tagsInput, setTagsInput] = useState((print?.tags ?? []).join(", "));

  const parsedTags = () => Array.from(new Set(
    tagsInput.split(",").map((tag) => tag.trim()).filter(Boolean)
  ));

  const currentFilaments = (): PrintFilament[] => print
    ? (print.filamenten ?? print.filamentKleuren.map((kleur) => ({ kleur, gewicht: 0 })))
    : [];

  const setFilaments = (filamenten: PrintFilament[]) => {
    if (!print) return;
    const gewicht = filamenten.reduce((sum, item) => sum + Number(item.gewicht || 0), 0);
    const totalMinutes = filamenten.reduce((sum, item) => sum + Number(item.uren || 0) * 60 + Number(item.minuten || 0), 0);
    setPrint({
      ...print,
      filamenten,
      filamentKleuren: filamenten.map((item) => item.kleur),
      gewicht: gewicht || print.gewicht,
      filamentGewicht: gewicht || print.filamentGewicht,
      uren: totalMinutes ? Math.floor(totalMinutes / 60) : print.uren,
      minuten: totalMinutes ? totalMinutes % 60 : print.minuten,
      splitPrintBron: "handmatig"
    });
  };

  const updateFilament = (index: number, field: "gewicht" | "uren" | "minuten", value: number) => {
    if (!print) return;
    const filamenten: PrintFilament[] = [...currentFilaments()];
    filamenten[index] = { ...filamenten[index], [field]: Math.max(0, value) };
    setFilaments(filamenten);
  };

  const updateFilamentColor = (index: number, kleur: string) => {
    const filamenten = [...currentFilaments()];
    filamenten[index] = { ...filamenten[index], kleur: kleur.toUpperCase(), filamentId: undefined, filamentNaam: undefined };
    setFilaments(filamenten);
  };

  const updateFilamentName = (index: number, kleurNaam: string) => {
    const filamenten = [...currentFilaments()];
    filamenten[index] = { ...filamenten[index], kleurNaam };
    setFilaments(filamenten);
  };

  const linkFilament = (index: number, filamentId: string) => {
    const filamenten = [...currentFilaments()];
    const voorraadFilament = filamentVoorraad.find((item) => String(item.id) === filamentId);
    if (!voorraadFilament) {
      filamenten[index] = { ...filamenten[index], filamentId: undefined, filamentNaam: undefined };
      setFilaments(filamenten);
      return;
    }
    filamenten[index] = {
      ...filamenten[index],
      filamentId: voorraadFilament.id,
      filamentNaam: filamentOptionLabel(voorraadFilament),
      kleur: filamentColorValue(voorraadFilament.kleur).toUpperCase(),
      kleurNaam: filamentColorLabel(voorraadFilament.kleur, voorraadFilament.kleurNaam),
      materiaal: voorraadFilament.type,
    };
    setFilaments(filamenten);
  };

  const removeFilament = (index: number) => setFilaments(currentFilaments().filter((_, itemIndex) => itemIndex !== index));

  const addFilament = () => setFilaments([...currentFilaments(), { kleur: "#64748B", gewicht: 0, uren: 0, minuten: 0 }]);

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

            VK-prijs (€)

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
            value={tagsInput}
            placeholder="Bijv. klantorder, decoratie, spoed"
            onChange={(event) => setTagsInput(event.target.value)}
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

        <div className="split-filaments">
            <div className="split-filaments-heading">
              <strong>Kleuren en gegevens</strong>
              {print.splitPrintBron === "3mf" && <span>Automatisch uit 3MF</span>}
            </div>
            {currentFilaments().map((filament, index) => (
              <div className="split-filament-card" key={`${filament.kleur}-${index}`}>
                <div className="split-color-control">
                  <input type="color" value={filamentColorValue(filament.kleur)} aria-label={`Kleur ${index + 1} kiezen`} onChange={(event) => updateFilamentColor(index, event.target.value)} />
                  <div>
                    <strong>{filamentColorLabel(filament.kleur, filament.kleurNaam)}</strong>
                    <input className="color-hex-input" value={filament.kleur} maxLength={7} aria-label={`Hexcode kleur ${index + 1}`} onChange={(event) => updateFilamentColor(index, event.target.value)} />
                  </div>
                </div>
                <label>Kleurnaam<input value={filament.kleurNaam ?? ""} placeholder={filamentColorLabel(filament.kleur)} onChange={(e) => updateFilamentName(index, e.target.value)} /></label>
                <label className="split-filament-link">Voorraadkleur<select value={filament.filamentId ?? ""} onChange={(e) => linkFilament(index, e.target.value)}><option value="">Niet gekoppeld</option>{filamentVoorraad.map((item) => <option key={item.id} value={item.id}>{filamentOptionLabel(item)}</option>)}</select></label>
                <label>Gewicht (g)<input type="number" min="0" step="0.01" value={filament.gewicht || 0} onChange={(e) => updateFilament(index, "gewicht", Number(e.target.value))} /></label>
                <label>Uren<input type="number" min="0" value={filament.uren || 0} onChange={(e) => updateFilament(index, "uren", Number(e.target.value))} /></label>
                <label>Minuten<input type="number" min="0" max="59" value={filament.minuten || 0} onChange={(e) => updateFilament(index, "minuten", Number(e.target.value))} /></label>
                <button type="button" className="remove-filament-button" aria-label={`${filamentColorLabel(filament.kleur, filament.kleurNaam)} verwijderen`} title="Kleur verwijderen" onClick={() => removeFilament(index)}><Trash2 size={16} /></button>
              </div>
            ))}
            <button type="button" className="add-filament-button" onClick={addFilament}><Plus size={16} /> Kleur toevoegen</button>
          </div>

        <div className="modal-buttons">

          <button

            className="save-button"

            onClick={() => onSave(parsedTags())}

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
