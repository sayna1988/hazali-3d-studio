import "./InventoryProductCard.css";
import type { Inventory } from "../../types/Inventory";
import { Box, MapPin, Minus, MoreVertical, Plus, Trash2 } from "lucide-react";

interface Props { product: Inventory; onIncrease: (id: number) => void; onDecrease: (id: number) => void; onDelete: (id: number) => void; }
const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

export default function InventoryProductCard({ product, onIncrease, onDecrease, onDelete }: Props) {
  const voorraadWaarde = product.voorraad * product.verkoopprijs;
  const status = product.voorraad === 0 ? "op" : product.voorraad <= product.minimumVoorraad ? "laag" : "goed";
  return <article className={`inventory-card status-${status}`}>
    <div className="inventory-card-visual">
      {product.foto ? <img src={product.foto} className="inventory-image" alt={product.naam} /> : <div className="inventory-image-placeholder"><Box size={40} strokeWidth={1.4} /><span>Geen foto</span></div>}
      <span className={`inventory-status-badge ${status}`}><i />{status === "op" ? "Uitverkocht" : status === "laag" ? "Bijna op" : "Op voorraad"}</span>
      <details className="inventory-card-menu"><summary aria-label={`Acties voor ${product.naam}`}><MoreVertical size={19} /></summary><button onClick={() => onDelete(product.id!)}><Trash2 size={15} />Verwijderen</button></details>
    </div>
    <div className="inventory-card-body">
      <div className="inventory-card-heading"><div><h2>{product.naam}</h2><span className="inventory-sku">{product.sku}</span></div><strong>{euro.format(product.verkoopprijs)}</strong></div>
      <div className="inventory-card-meta"><span><MapPin size={14} />{product.locatie || "Geen locatie"}</span><span>Min. {product.minimumVoorraad}</span></div>
      <div className="inventory-stock-row"><div><span>Voorraad</span><strong>{product.voorraad} <small>stuks</small></strong></div><div className="inventory-stock-control"><button onClick={() => onDecrease(product.id!)} disabled={product.voorraad === 0} aria-label={`Voorraad van ${product.naam} verlagen`}><Minus size={16} /></button><span>{product.voorraad}</span><button onClick={() => onIncrease(product.id!)} aria-label={`Voorraad van ${product.naam} verhogen`}><Plus size={16} /></button></div></div>
      <div className="inventory-card-footer"><span>Totale verkoopwaarde</span><strong>{euro.format(voorraadWaarde)}</strong></div>
    </div>
  </article>;
}
