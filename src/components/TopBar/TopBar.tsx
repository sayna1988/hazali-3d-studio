import "./TopBar.css";

interface Props {
  title: string;
  subtitle?: string;
}

export default function TopBar({
  title,
  subtitle
}: Props) {

  return (

    <header className="topbar">

      <div>

        <h1>{title}</h1>

        {subtitle && (
          <p>{subtitle}</p>
        )}

      </div>

     

    </header>

  );

}