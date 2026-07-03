import "./Sidebar.css";

import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";

import {
  LayoutDashboard,
  Package,
  Boxes,
  ImagePlus,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import { getAppIconPath, getStoredAppIconVariant, normalizeAppIconVariant } from "../../utils/appIcon";

export default function Sidebar() {

  const { session, signOut } = useAuth();
  const [logoSrc, setLogoSrc] = useState(() => getAppIconPath(getStoredAppIconVariant()));

  useEffect(() => {
    function updateLogo(event?: Event) {
      const variant = event instanceof CustomEvent
        ? normalizeAppIconVariant(event.detail?.variant)
        : getStoredAppIconVariant();
      setLogoSrc(getAppIconPath(variant));
    }

    window.addEventListener("hazali:app-icon-changed", updateLogo);
    window.addEventListener("storage", updateLogo);
    return () => {
      window.removeEventListener("hazali:app-icon-changed", updateLogo);
      window.removeEventListener("storage", updateLogo);
    };
  }, []);

  return (

    <aside className="sidebar">

      <img
        src={logoSrc}
        alt="Hazali"
        className="logo-image"
      />

      <nav>

        <NavLink to="/" end className={({ isActive }) => isActive ? "active" : ""}>
          <LayoutDashboard size={16}/>
          Dashboard
        </NavLink>

        <NavLink to="/prints" className={({ isActive }) => isActive ? "active" : ""}>
          <Package size={16}/>
          Catalogus
        </NavLink>

        <NavLink to="/filamenten" className={({ isActive }) => isActive ? "active" : ""}>
          <Boxes size={16}/>
          Filamenten
        </NavLink>

        <NavLink to="/productfoto" className={({ isActive }) => isActive ? "active" : ""}>
          <ImagePlus size={16}/>
          Productfoto
        </NavLink>

      </nav>

      <button className="sidebar-account" onClick={signOut} title="Uitloggen">
        <span>{session?.user.email}</span><LogOut size={16}/>
      </button>


    </aside>

  );

}
