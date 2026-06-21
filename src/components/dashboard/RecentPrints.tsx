import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card/Card";

import "./RecentPrints.css";

import { db } from "../../database/db";
import type { Print } from "../../types/Print";
import { withoutSourceFile } from "../../services/PrintService";

export default function RecentPrints() {

  const navigate =
    useNavigate();

  const [prints, setPrints] =
    useState<Print[]>([]);

  useEffect(() => {

    async function laden() {

      const data =
        await db.prints
          .orderBy("id")
          .reverse()
          .limit(5)
          .toArray();

      setPrints(data.map(withoutSourceFile));

    }

    laden();

  }, []);

  return (

    <Card title="Laatste prints">

      {

        prints.length === 0

        ? (

          <p>
            Nog geen prints gevonden.
          </p>

        )

        : (

          <div className="recent-prints-list">

            {

              prints.map((print) => (

                <div

                  key={print.id}

                  className="recent-print"

                  onClick={() =>
                    navigate(`/prints/${print.id}`)
                  }

                >

                  <div className="recent-print-image">

                    {

                      print.foto

                      ? (

                        <img
                          src={print.foto}
                          alt={print.naam}
                        />

                      )

                      : "📦"

                    }

                  </div>

                  <div className="recent-print-info">

                    <h3>
                      {print.naam}
                    </h3>

                    <span>

                      €

                      {Number(
                        print.verkoopprijs
                      ).toFixed(2)}

                    </span>

                  </div>

                </div>

              ))

            }

          </div>

        )

      }

    </Card>

  );

}
