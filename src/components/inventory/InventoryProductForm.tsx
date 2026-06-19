import type { ChangeEvent } from "react";
import { ImagePlus, PackagePlus } from "lucide-react";
import "./InventoryProductForm.css";

interface Props {
  naam: string; setNaam: (value: string) => void; sku: string; setSku: (value: string) => void;
  voorraad: number; setVoorraad: (value: number) => void; minimumVoorraad: number; setMinimumVoorraad: (value: number) => void;
  kostprijs: number; setKostprijs: (value: number) => void; verkoopprijs: number; setVerkoopprijs: (value: number) => void;
  locatie: string; setLocatie: (value: string) => void; foto: string;
  uploadFoto: (event: ChangeEvent<HTMLInputElement>) => void; toevoegen: () => void; annuleren: () => void;
}

export default function InventoryProductForm(props: Props) {
  const { naam, setNaam, sku, setSku, voorraad, setVoorraad, minimumVoorraad, setMinimumVoorraad, kostprijs, setKostprijs, verkoopprijs, setVerkoopprijs, locatie, setLocatie, foto, uploadFoto, toevoegen, annuleren } = props;
  return <form className="inventory-form" onSubmit={(event) => { event.preventDefault(); toevoegen(); }}>
    <div className="inventory-form-heading"><span><PackagePlus size={22} /></span><div><h2 id="inventory-form-title">Nieuw product</h2><p>Voeg een verkoopklare print toe aan je inventaris.</p></div></div>
    <div className="inventory-form-content">
      <label className={`inventory-photo-field ${foto ? "has-photo" : ""}`}>{foto ? <img src={foto} alt="Productvoorbeeld" /> : <><ImagePlus size={27} /><strong>Productfoto</strong><span>PNG of JPG · klik om te kiezen</span></>}<input type="file" accept="image/*" onChange={uploadFoto} />{foto && <span className="inventory-photo-change">Foto wijzigen</span>}</label>
      <div className="inventory-form-grid">
        <label className="full"><span>Productnaam *</span><input autoFocus required placeholder="Bijv. Ribbed planter" value={naam} onChange={(e) => setNaam(e.target.value)} /></label>
        <label><span>SKU</span><input placeholder="Automatisch gegenereerd" value={sku} onChange={(e) => setSku(e.target.value)} /></label>
        <label><span>Locatie</span><input placeholder="Bijv. Stelling A2" value={locatie} onChange={(e) => setLocatie(e.target.value)} /></label>
        <label><span>Startvoorraad</span><input type="number" min="0" value={voorraad} onChange={(e) => setVoorraad(Number(e.target.value))} /></label>
        <label><span>Waarschuwen bij</span><input type="number" min="0" value={minimumVoorraad} onChange={(e) => setMinimumVoorraad(Number(e.target.value))} /></label>
        <label><span>Kostprijs</span><div className="price-input"><i>€</i><input type="number" min="0" step="0.01" value={kostprijs} onChange={(e) => setKostprijs(Number(e.target.value))} /></div></label>
        <label><span>Verkoopprijs</span><div className="price-input"><i>€</i><input type="number" min="0" step="0.01" value={verkoopprijs} onChange={(e) => setVerkoopprijs(Number(e.target.value))} /></div></label>
      </div>
    </div>
    <div className="inventory-form-actions"><button type="button" className="inventory-cancel" onClick={annuleren}>Annuleren</button><button type="submit" className="inventory-submit" disabled={!naam.trim()}><PackagePlus size={18} />Product toevoegen</button></div>
  </form>;
}
