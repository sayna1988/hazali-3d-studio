import "./Card.css";
import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  title?: string;
  className?: string;
};

export default function Card({
  children,
  title,
  className = ""
}: CardProps) {

  return (

    <div className={`hz-card ${className}`}>

      {title && (
        <div className="hz-card-header">

          <h2>{title}</h2>

        </div>
      )}

      <div className="hz-card-body">

        {children}

      </div>

    </div>

  );

}