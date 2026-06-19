import "./Page.css";

import TopBar from "../TopBar/TopBar";

interface Props {

  title: string;

  subtitle?: string;

  children: React.ReactNode;

}

export default function Page({

  title,

  subtitle,

  children

}: Props) {

  return (

    <div className="page">

      <TopBar
        title={title}
        subtitle={subtitle}
      />

      <div className="page-content">

        {children}

      </div>

    </div>

  );

}