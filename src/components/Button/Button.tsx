import "./Button.css";
import type { ReactNode, MouseEventHandler } from "react";

type ButtonProps = {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  variant?: "primary" | "secondary" | "danger";
  icon?: ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
};

export default function Button({
  children,
  onClick,
  variant = "primary",
  icon,
  type = "button",
  disabled = false,
  className = ""
}: ButtonProps) {

  return (

    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`hz-button ${variant} ${className}`}
    >

      {icon && (
        <span className="hz-button-icon">
          {icon}
        </span>
      )}

      <span>
        {children}
      </span>

    </button>

  );

}