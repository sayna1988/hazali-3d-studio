import "./Card.css";

interface Props {

  title?: string;

  children: React.ReactNode;

  className?: string;

}

export default function Card({

  title,

  children,

  className = ""

}: Props) {

  return (

    <section
      className={`card ${className}`}
    >

      {

        title && (

          <div className="card-header">

            <h2>
              {title}
            </h2>

          </div>

        )

      }

      <div className="card-body">

        {children}

      </div>

    </section>

  );

}