import "./Button.css";

import type { ReactNode } from "react";

interface Props {

  children: ReactNode;

  onClick?: () => void;

  type?: "button" | "submit";

  variant?: "primary" | "secondary" | "danger";

  fullWidth?: boolean;

  disabled?: boolean;

}

export default function Button({

  children,

  onClick,

  type = "button",

  variant = "primary",

  fullWidth = false,

  disabled = false

}: Props) {

  return (

    <button

      type={type}

      disabled={disabled}

      onClick={onClick}

      className={`
        ui-button
        ${variant}
        ${fullWidth ? "full-width" : ""}
      `}

    >

      {children}

    </button>

  );

}