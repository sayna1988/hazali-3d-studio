import "./InventoryCard.css";
import type { Inventory } from "../../types/Inventory";

interface Props {

  product: Inventory;

  onIncrease: (id: number) => void;

  onDecrease: (id: number) => void;

  onDelete: (id: number) => void;

}

export default function InventoryCard({

  product,

  onIncrease,

  onDecrease,

  onDelete

}: Props) {

  const voorraadWaarde =
    product.voorraad *
    product.verkoopprijs;

  return (

    <div className="inventory-card">

      {product.foto && (

        <img
          src={product.foto}
          className="inventory-image"
          alt={product.naam}
        />

      )}

      <div className="inventory-card-body">

        <h2>{product.naam}</h2>

        <p className="inventory-sku">
          {product.sku}
        </p>

        <div className="inventory-info">

          <span>

            📦 {product.voorraad} stuks

          </span>

          <span>

            💰 €{product.verkoopprijs.toFixed(2)}

          </span>

        </div>

<div className="inventory-stock">

  <button
    className="stock-button"
    onClick={() => onDecrease(product.id!)}
  >
    −
  </button>

  <span className="stock-value">

    {product.voorraad}

  </span>

  <button
    className="stock-button"
    onClick={() => onIncrease(product.id!)}
  >
    +
  </button>

</div>
<div className="inventory-actions">

  <button
    className="delete-button"
    onClick={() => onDelete(product.id!)}
  >

    Verwijderen

  </button>

</div>
        <div className="inventory-footer">

          <strong>

            €{voorraadWaarde.toFixed(2)}

          </strong>

          <span>

            voorraadwaarde

          </span>

        </div>

      </div>

    </div>

  );

}