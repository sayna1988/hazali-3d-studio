import "./DashboardStats.css";
import {
  Package,
  Euro,
  TrendingUp,
  Percent
} from "lucide-react";
import StatCard from "../ui/StatCard/StatCard";


interface Props {
  aantalPrints: number;
  omzet: number;
  winst: number;
  marge: number;
}

export default function DashboardStats({

  aantalPrints,
  omzet,
  winst,
  marge

}: Props) {

  return (
      <div className="dashboard-stats">

  <StatCard

    icon={
      <Package size={22}/>
    }

    title="TOTAAL PRINTS"

    value={aantalPrints}

    subtitle="↑ +3 deze week"

  />

  <StatCard

    icon={
      <Euro size={22}/>
    }

    title="TOTALE OMZET"

    value={`€${omzet.toFixed(2)}`}

  />

  <StatCard

    icon={
      <TrendingUp size={22}/>
    }

    title="TOTALE WINST"

    value={`€${winst.toFixed(2)}`}

  />

  <StatCard

    icon={
      <Percent size={22}/>
    }

    title="GEM. MARGE"

    value={`${marge.toFixed(0)}%`}

  />

</div>
  );

}