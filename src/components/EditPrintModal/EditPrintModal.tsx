import "./EditPrintModal.css";

interface Props {

  open: boolean;

  print: any;

  setPrint: (printData: any) => void;

  onSave: () => void;

  onCancel: () => void;

}

export default function EditPrintModal({

  open,

  print,

  setPrint,

  onSave,

  onCancel

}: Props) {

  if (!open || !print) {

    return null;

  }

  return (

    <div className="modal-overlay">

      <div className="modal">

        <h2>

          Print bewerken

        </h2>

        <div className="form-group">

          <label>

            Naam

          </label>

          <input

            value={print.naam}

            onChange={(e)=>

              setPrint({

                ...print,

                naam: e.target.value

              })

            }

          />

        </div>

        <div className="form-group">

          <label>

            Gewicht (g)

          </label>

          <input

            type="number"

            value={print.gewicht}

            onChange={(e)=>

              setPrint({

                ...print,

                gewicht: Number(
                  e.target.value
                )

              })

            }

          />

        </div>

        <div className="form-group">

          <label>

            Verkoopprijs (€)

          </label>

          <input

            type="number"

            step="0.01"

            value={print.verkoopprijs}

            onChange={(e)=>

              setPrint({

                ...print,

                verkoopprijs: Number(
                  e.target.value
                )

              })

            }

          />

        </div>

        <div className="modal-buttons">

          <button

            className="save-button"

            onClick={onSave}

          >

            Opslaan

          </button>

          <button

            className="cancel-button"

            onClick={onCancel}

          >

            Annuleren

          </button>

        </div>

      </div>

    </div>

  );

}