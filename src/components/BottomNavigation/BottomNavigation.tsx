import "./BottomNavigation.css";

import { NavLink } from "react-router-dom";

import {
  House,
  Package,
  Boxes,
  Settings
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

        <span>Catalogus</span>

      </NavLink>

      <NavLink to="/filamenten">

        <Boxes size={22} />

        <span>Filament</span>

      </NavLink>

      <NavLink to="/instellingen">

        <Settings size={22} />

        <span>Instellingen</span>

      </NavLink>

    </nav>

  );

}
