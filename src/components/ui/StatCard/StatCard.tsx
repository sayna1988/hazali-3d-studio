import "./StatCard.css";

import type { ReactNode } from "react";

interface Props {

  icon: ReactNode;

  title: string;

  value: string | number;

  subtitle?: string;

}

export default function StatCard({

  icon,

  title,

  value,

  subtitle

}: Props) {

  return (

    <div className="stat-card">

      <div className="stat-icon">

        {icon}

      </div>

      <div className="stat-title">

        {title}

      </div>

      <div className="stat-value">

        {value}

      </div>

      {

        subtitle && (

          <div className="stat-subtitle">

            {subtitle}

          </div>

        )

      }

    </div>

  );

}