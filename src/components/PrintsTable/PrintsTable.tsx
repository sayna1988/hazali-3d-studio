import { useEffect, useRef, useState } from "react";
import { Check, Layers3, Minus, PackagePlus, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import "./PrintsTable.css";
import type { Print } from "../../types/Print";
import { colorName, safeColor } from "../../utils/colorNames";

interface Props {
  prints: Print[];
  catalogusVoorraad: Record<number, number>;
  navigate: (path: string) => void;
  verwijderen: (id: number) => void;
  setSelectedPrint: (printData: Print) => void;
  setShowEditModal: (value: boolean) => void;
  toggleSplitPrint: (printData: Print, checked: boolean) => void;
  voegUitgeprinteExemplarenToe: (printData: Print, aantal: number) => Promise<void>;
  geselecteerdePrintIds: number[];
  alleZichtbarePrintsGeselecteerd: boolean;
  enkeleZichtbarePrintsGeselecteerd: boolean;
  togglePrintSelectie: (id: number, checked: boolean) => void;
  toggleZichtbarePrints: (checked: boolean) => void;
}

function printFilamenten(print: Print) {
  return print.filamenten?.length
    ? print.filamenten
    : (print.filamentKleuren ?? []).map((kleur) => ({ kleur, gewicht: 0, uren: 0, minuten: 0 }));
}

export default function PrintsTable({
  prints,
  catalogusVoorraad,
  navigate,
  verwijderen,
  setSelectedPrint,
  setShowEditModal,
  toggleSplitPrint,
  voegUitgeprinteExemplarenToe,
  geselecteerdePrintIds,
  alleZichtbarePrintsGeselecteerd,
  enkeleZichtbarePrintsGeselecteerd,
  togglePrintSelectie,
  toggleZichtbarePrints
}: Props) {
  const [aantallen, setAantallen] = useState<Record<number, number>>({});
  const [bezigMet, setBezigMet] = useState<number | null>(null);
  const [toegevoegd, setToegevoegd] = useState<number | null>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = !alleZichtbarePrintsGeselecteerd && enkeleZichtbarePrintsGeselecteerd;
    }
  }, [alleZichtbarePrintsGeselecteerd, enkeleZichtbarePrintsGeselecteerd]);

  function wijzigAantal(id: number, verschil: number) {
    setAantallen((huidig) => ({ ...huidig, [id]: Math.max(1, (huidig[id] ?? 1) + verschil) }));
  }

  async function voegToe(print: Print) {
    if (print.id === undefined) return;
    setBezigMet(print.id);
    try {
      await voegUitgeprinteExemplarenToe(print, aantallen[print.id] ?? 1);
      setAantallen((huidig) => ({ ...huidig, [print.id!]: 1 }));
      setToegevoegd(print.id);
      window.setTimeout(() => setToegevoegd((id) => id === print.id ? null : id), 1800);
    } finally {
      setBezigMet(null);
    }
  }

  return (
    <div className="prints-table-container">
      <table className="prints-table">
        <thead>
          <tr>
            <th className="select-column">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={alleZichtbarePrintsGeselecteerd}
                onChange={(event) => toggleZichtbarePrints(event.target.checked)}
                aria-label="Alle zichtbare prints selecteren"
              />
            </th>
            <th>Naam</th>
            <th>Gewicht</th>
            <th>Tijd</th>
            <th>Kleuren / tijd</th>
            <th>Split</th>
            <th>Kostprijs</th>
            <th>Verkoopprijs</th>
            <th>Winst</th>
            <th>Uitgeprint</th>
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
              <td className="select-column" onClick={(event) => event.stopPropagation()}>
                {p.id !== undefined && (
                  <input
                    type="checkbox"
                    checked={geselecteerdePrintIds.includes(p.id)}
                    onChange={(event) => togglePrintSelectie(p.id!, event.target.checked)}
                    aria-label={`${p.naam} selecteren`}
                  />
                )}
              </td>

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

              <td>{p.uren}u {p.minuten}m</td>

              <td>
                {printFilamenten(p).length > 0 ? (
                  <div className="color-time-list">
                    {printFilamenten(p).map((filament, index) => (
                      <span key={`${filament.kleur}-${index}`} title={colorName(filament.kleur)}>
                        <i style={{ background: safeColor(filament.kleur) }} />
                        {p.splitPrint && <>{filament.uren || 0}u {filament.minuten || 0}m</>}
                      </span>
                    ))}
                  </div>
                ) : <span className="table-empty">-</span>}
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

              <td className="profit-cell">
                €{Number(p.winst || 0).toFixed(2)}
              </td>

              <td>
                {p.id !== undefined && (
                  <div className="printed-quantity" onClick={(event) => event.stopPropagation()}>
                    <span className="catalog-stock">{catalogusVoorraad[p.id] ?? 0} in catalogus</span>
                    <div className="printed-quantity-actions">
                      <div className="quantity-stepper">
                        <button type="button" onClick={() => wijzigAantal(p.id!, -1)} aria-label="Aantal verlagen"><Minus size={13} /></button>
                        <input type="number" min="1" value={aantallen[p.id] ?? 1} onChange={(event) => setAantallen((huidig) => ({ ...huidig, [p.id!]: Math.max(1, Number(event.target.value) || 1) }))} aria-label={`Aantal uitgeprinte exemplaren van ${p.naam}`} />
                        <button type="button" onClick={() => wijzigAantal(p.id!, 1)} aria-label="Aantal verhogen"><Plus size={13} /></button>
                      </div>
                      <button className={`add-to-catalog ${toegevoegd === p.id ? "added" : ""}`} type="button" disabled={bezigMet === p.id} onClick={() => void voegToe(p)}>
                        {toegevoegd === p.id ? <Check size={15} /> : <PackagePlus size={15} />}
                        {toegevoegd === p.id ? "Toegevoegd" : "Toevoegen"}
                      </button>
                    </div>
                  </div>
                )}
              </td>

              <td>
                <div className="action-buttons">
                  <button
                    className="icon-button"
                    aria-label={`${p.naam} bewerken`}
                    title="Print bewerken"
                    onClick={(event) => {
                      event.stopPropagation();
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
                    onClick={(event) => {
                      event.stopPropagation();

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
