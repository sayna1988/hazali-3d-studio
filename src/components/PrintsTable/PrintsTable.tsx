import { Layers3, Pencil, Tag, Trash2 } from "lucide-react";
import "./PrintsTable.css";
import type { Print } from "../../types/Print";
import { colorName, safeColor } from "../../utils/colorNames";

interface Props {
  prints: Print[];
  navigate: (path: string) => void;
  verwijderen: (id: number) => void;
  setSelectedPrint: (printData: Print) => void;
  setShowEditModal: (value: boolean) => void;
  toggleSplitPrint: (printData: Print, checked: boolean) => void;
}

export default function PrintsTable({
  prints,
  navigate,
  verwijderen,
  setSelectedPrint,
  setShowEditModal,
  toggleSplitPrint
}: Props) {

  return (

    <div className="prints-table-container">

      <table className="prints-table">

        <thead>
          <tr>
            <th>Naam</th>
            <th>Gewicht</th>
            <th>Kleuren</th>
            <th>Tijd</th>
            <th>Tijd per kleur</th>
            <th>Split</th>
            <th>Kostprijs</th>
            <th>Verkoopprijs</th>
            <th>Winstmarge</th>
            <th>Winst</th>
            <th>Acties</th>
          </tr>
        </thead>

        <tbody>

          {prints.length === 0 && (

            <tr>
              <td colSpan={11}>
                Geen prints gevonden.
              </td>
            </tr>

          )}

          {prints.map((p) => (

            <tr
              key={p.id}
              className="clickable-row"
              onClick={() => {
                if (p.id !== undefined) {
                  navigate(`/prints/${p.id}`);
                }
              }}
            >

              <td>
                <div className="print-name-cell">

                  <div className="print-thumb">
                    {p.foto ? (
                      <img
                        src={p.foto}
                        alt={p.naam}
                      />
                    ) : (
                      "📦"
                    )}
                  </div>

                  <div className="print-title-and-tags">
                    <span>{p.naam}</span>
                    {p.splitPrint && <span className="split-print-badge"><Layers3 size={12} /> Split print</span>}
                    {(p.tags?.length ?? 0) > 0 && (
                      <div className="print-tags">
                        {p.tags!.map((tag) => <span key={tag}>{tag}</span>)}
                      </div>
                    )}
                    <button
                      type="button"
                      className="manage-tags-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedPrint({ ...p });
                        setShowEditModal(true);
                      }}
                    >
                      <Tag size={12} />
                      {(p.tags?.length ?? 0) > 0 ? "Tags beheren" : "Tag toevoegen"}
                    </button>
                  </div>

                </div>
              </td>

              <td>
                <div>{Number(p.gewicht || 0).toLocaleString("nl-NL", { maximumFractionDigits: 2 })} g</div>
              </td>

              <td>
                {p.filamentKleuren?.length > 0 ? <div className="filament-swatches table-color-list">
                  {p.filamentKleuren.slice(0, 3).map((kleur, index) => <span className="filament-color" key={`${kleur}-${index}`} title={kleur}>
                    <i style={{ background: safeColor(kleur) }} />{colorName(kleur)}
                  </span>)}
                  {p.filamentKleuren.length > 3 && <small>+{p.filamentKleuren.length - 3}</small>}
                </div> : <span className="table-empty">–</span>}
              </td>

              <td>{p.uren}u {p.minuten}m</td>

              <td>
                {p.splitPrint && (p.filamenten?.length ?? 0) > 0 ? (
                  <div className="color-time-list">
                    {p.filamenten!.map((filament, index) => (
                      <span key={`${filament.kleur}-${index}`} title={colorName(filament.kleur)}>
                        <i style={{ background: safeColor(filament.kleur) }} />
                        {filament.uren || 0}u {filament.minuten || 0}m
                      </span>
                    ))}
                  </div>
                ) : <span className="table-empty">–</span>}
              </td>

              <td>
                <label className="table-split-toggle" title="Split print in- of uitschakelen" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={Boolean(p.splitPrint)}
                    aria-label={`${p.naam} als split print markeren`}
                    onChange={(event) => toggleSplitPrint(p, event.target.checked)}
                  />
                  <Layers3 size={15} />
                </label>
              </td>

              <td>
                €{Number(p.kostprijs || 0).toFixed(2)}
              </td>

              <td>
                €{Number(p.verkoopprijs || 0).toFixed(2)}
              </td>

              <td className="margin-cell">
                {p.verkoopprijs > 0
                  ? Math.round((p.winst / p.verkoopprijs) * 100)
                  : 0
                }%
              </td>

              <td className="profit-cell">
                €{Number(p.winst || 0).toFixed(2)}
              </td>

              <td>
                <div className="action-buttons">

                  <button
                    className="icon-button"
                    aria-label={`${p.naam} bewerken`}
                    title="Print bewerken"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPrint({ ...p });
                      setShowEditModal(true);
                    }}
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    className="delete-icon"
                    aria-label={`${p.naam} verwijderen`}
                    title="Print verwijderen"
                    onClick={(e) => {
                      e.stopPropagation();

                      if (p.id !== undefined) {
                        verwijderen(p.id);
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>

                </div>
              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  );

}
