import "./Sidebar.css";

import { NavLink } from "react-router-dom";

import {
  LayoutDashboard,
  PlusCircle,
  Package,
  Boxes,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";

export default function Sidebar() {

  const { session, signOut } = useAuth();

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

      </nav>

      <button className="sidebar-account" onClick={signOut} title="Uitloggen">
        <span>{session?.user.email}</span><LogOut size={16}/>
      </button>


    </aside>

  );

}
