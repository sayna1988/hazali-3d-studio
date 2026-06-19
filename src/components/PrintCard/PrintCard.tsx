import { Pencil, Trash2 } from "lucide-react";
import type { Print } from "../../types/Print";

import "./PrintCard.css";

interface Props {
  print: Print;
  navigate: (path: string) => void;
  verwijderen: (id: number) => void;
  setSelectedPrint: (print: Print) => void;
  setShowEditModal: (value: boolean) => void;
}

export default function PrintCard({
  print,
  navigate,
  verwijderen,
  setSelectedPrint,
  setShowEditModal
}: Props) {
  return (
    <div
      className="print-card"
      onClick={() => navigate(`/prints/${print.id}`)}
    >
      <div className="print-card-top">

        <div className="print-card-thumb">

          {print.foto ? (
            <img
              src={print.foto}
              alt={print.naam}
            />
          ) : (
            "📦"
          )}

        </div>

        <div className="print-card-info">

          <h3>{print.naam}</h3>

          <p>{print.gewicht} g</p>

          <p>
            {print.uren}u {print.minuten}m
          </p>

        </div>

      </div>

      <div className="print-card-stats">

        <div>
          <span>Kostprijs</span>
          <strong>€{print.kostprijs.toFixed(2)}</strong>
        </div>

        <div>
          <span>Verkoop</span>
          <strong>€{print.verkoopprijs.toFixed(2)}</strong>
        </div>

        <div>
          <span>Winst</span>
          <strong>€{print.winst.toFixed(2)}</strong>
        </div>

      </div>

      <div className="print-card-actions">

        <button
          onClick={(e) => {

            e.stopPropagation();

            setSelectedPrint(print);

            setShowEditModal(true);

          }}
        >
          <Pencil size={18} />
        </button>

        <button
          onClick={(e) => {

            e.stopPropagation();

            if (print.id) {

              verwijderen(print.id);

            }

          }}
        >
          <Trash2 size={18} />
        </button>

      </div>

    </div>
  );
}