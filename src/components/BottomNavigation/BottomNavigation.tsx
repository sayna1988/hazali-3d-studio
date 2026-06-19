import "./BottomNavigation.css";

import { NavLink } from "react-router-dom";

import {
  House,
  Package,
  PlusCircle,
 Boxes,
  Printer
} from "lucide-react";

export default function BottomNavigation() {

  return (

    <nav className="bottom-navigation">

      <NavLink to="/">

        <House size={22} />

        <span>Home</span>

      </NavLink>

      <NavLink to="/prints">

        <Package size={22} />

        <span>Prints</span>

      </NavLink>

      <NavLink
        to="/calculator"
        className="fab-button"
      >

        <PlusCircle size={34} />

      </NavLink>

      <NavLink to="/filamenten">

        <Boxes size={22} />

        <span>Filament</span>

      </NavLink>

      <NavLink to="/mijn-printer">

        <Printer size={22} />

        <span>Printer</span>

      </NavLink>

    </nav>

  );

}
