import "./Sidebar.css";

import { NavLink } from "react-router-dom";

import {
  LayoutDashboard,
  PlusCircle,
  Package,
  Printer,
  Boxes,
} from "lucide-react";

export default function Sidebar() {

  return (

    <aside className="sidebar">

      <img
        src="/logo.png"
        alt="Hazali"
        className="logo-image"
      />

      <nav>

        <NavLink to="/" end className={({ isActive }) => isActive ? "active" : ""}>
          <LayoutDashboard size={16}/>
          Dashboard
        </NavLink>

        <NavLink to="/inventaris" className={({ isActive }) => isActive ? "active" : ""}>
          <PlusCircle size={16}/>
          Inventaris
        </NavLink>

        <NavLink to="/prints" className={({ isActive }) => isActive ? "active" : ""}>
          <Package size={16}/>
          Catalogus
        </NavLink>

        <NavLink to="/filamenten" className={({ isActive }) => isActive ? "active" : ""}>
          <Boxes size={16}/>
          Filamenten
        </NavLink>

        <NavLink to="/mijn-printer" className={({ isActive }) => isActive ? "active" : ""}>
          <Printer size={16}/>
          Mijn Printer
        </NavLink>

      </nav>


    </aside>

  );

}
