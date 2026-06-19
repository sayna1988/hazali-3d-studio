import "./QuickActions.css";
import Card from "../ui/Card/Card";

import {
  PlusCircle,
  Package,
  Boxes,
  Calculator
} from "lucide-react";

import { useNavigate } from "react-router-dom";

export default function QuickActions() {

  const navigate =
    useNavigate();

  return (

    <Card title="Snelle acties">

  <div className="quick-actions-grid">

        <button
          className="quick-action-card"
          onClick={() =>
            navigate("/calculator")
          }
        >

          <Calculator size={28} />

          <h3>
            Nieuwe berekening
          </h3>

          <p>
            Bereken direct de kostprijs van een nieuwe print.
          </p>

        </button>

        <button
          className="quick-action-card"
          onClick={() =>
            navigate("/prints")
          }
        >

          <Package size={28} />

          <h3>
            Mijn prints
          </h3>

          <p>
            Bekijk en beheer al je opgeslagen prints.
          </p>

        </button>

        <button
          className="quick-action-card"
          onClick={() =>
            navigate("/filamenten")
          }
        >

          <Boxes size={28} />

          <h3>
            Filamenten
          </h3>

          <p>
            Beheer je filamentvoorraad en prijzen.
          </p>

        </button>

        <button
          className="quick-action-card"
          onClick={() =>
            navigate("/calculator")
          }
        >

          <PlusCircle size={28} />

          <h3>
            Nieuwe print
          </h3>

          <p>
            Start direct met een nieuwe printberekening.
          </p>

        </button>

      </div>

    </Card>

  );

}