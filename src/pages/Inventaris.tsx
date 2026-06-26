import "./InventarisNext.css";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import {
  AlertTriangle,
  Boxes,
  CircleDollarSign,
  Grid2X2,
  List,
  Minus,
  PackageCheck,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X
} from "lucide-react";
import { db } from "../database/db";
import type { Inventory } from "../types/Inventory";
import InventoryForm from "../components/inventory/InventoryProductForm";
import InventoryCard from "../components/inventory/InventoryProductCard";
import { createInventory, deleteInventory, loadInventory, updateInventory } from "../services/InventoryService";

type Filter = "alles" | "laag" | "op";
type Sortering = "nieuwste" | "naam" | "voorraad-laag" | "waarde-hoog";
type Weergave = "tabel" | "grid";

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

function voorraadStatus(product: Inventory) {
  if (product.voorraad === 0) return "op";
  if (product.voorraad <= product.minimumVoorraad) return "laag";
  return "goed";
}

export default function Inventaris() {
  const [naam, setNaam] = useState("");
  const [sku, setSku] = useState("");
  const [voorraad, setVoorraad] = useState(1);
  const [minimumVoorraad, setMinimumVoorraad] = useState(2);
  const [kostprijs, setKostprijs] = useState(0);
  const [verkoopprijs, setVerkoopprijs] = useState(0);
  const [locatie, setLocatie] = useState("");
  const [foto, setFoto] = useState("");
  const [producten, setProducten] = useState<Inventory[]>([]);
  const [zoeken, setZoeken] = useState("");
  const [filter, setFilter] = useState<Filter>("alles");
  const [sortering, setSortering] = useState<Sortering>("nieuwste");
  const [weergave, setWeergave] = useState<Weergave>(() =>
    window.localStorage.getItem("inventaris-weergave") === "tabel" ? "tabel" : "grid"
  );
  const [formulierOpen, setFormulierOpen] = useState(false);

  function uploadFoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function laden() {
    setProducten(await loadInventory());
  }

  useEffect(() => {
    let actief = true;
    void loadInventory().then((items) => { if (actief) setProducten(items); });
    const verversNaSync = () => { void db.inventory.toArray().then(setProducten); };
    window.addEventListener("hazali:inventory-synced", verversNaSync);
    return () => {
      actief = false;
      window.removeEventListener("hazali:inventory-synced", verversNaSync);
    };
  }, []);

  useEffect(() => {
    if (!formulierOpen) return;
    const sluit = (event: KeyboardEvent) => event.key === "Escape" && setFormulierOpen(false);
    window.addEventListener("keydown", sluit);
    return () => window.removeEventListener("keydown", sluit);
  }, [formulierOpen]);

  useEffect(() => {
    window.localStorage.setItem("inventaris-weergave", weergave);
  }, [weergave]);

  function resetFormulier() {
    setNaam("");
    setSku("");
    setVoorraad(1);
    setMinimumVoorraad(2);
    setKostprijs(0);
    setVerkoopprijs(0);
    setLocatie("");
    setFoto("");
  }

  async function toevoegen() {
    if (!naam.trim()) return;
    await createInventory({
      naam: naam.trim(),
      foto,
      sku: sku.trim() || `HZ-${Date.now().toString().slice(-6)}`,
      voorraad: Math.max(0, voorraad),
      minimumVoorraad: Math.max(0, minimumVoorraad),
      kostprijs: Math.max(0, kostprijs),
      verkoopprijs: Math.max(0, verkoopprijs),
      locatie: locatie.trim(),
      aangemaaktOp: new Date().toISOString()
    });
    resetFormulier();
    setFormulierOpen(false);
    await laden();
  }

  async function pasVoorraadAan(id: number, verschil: number) {
    const product = await db.inventory.get(id);
    if (!product) return;
    await updateInventory(id, { voorraad: Math.max(0, product.voorraad + verschil) });
    await laden();
  }

  async function verwijderen(id: number) {
    if (!confirm("Weet je zeker dat je dit product wilt verwijderen?")) return;
    await deleteInventory(id);
    await laden();
  }

  const stats = useMemo(() => {
    const totaleStuks = producten.reduce((totaal, item) => totaal + item.voorraad, 0);
    const verkoopwaarde = producten.reduce((totaal, item) => totaal + item.voorraad * item.verkoopprijs, 0);
    const lageVoorraad = producten.filter((item) => item.voorraad <= item.minimumVoorraad).length;
    return { totaleStuks, verkoopwaarde, lageVoorraad };
  }, [producten]);

  const zichtbareProducten = useMemo(() => {
    const term = zoeken.toLocaleLowerCase("nl").trim();
    return producten.filter((product) => {
      const match = [product.naam, product.sku, product.locatie].join(" ").toLocaleLowerCase("nl").includes(term);
      if (filter === "op") return match && product.voorraad === 0;
      if (filter === "laag") return match && product.voorraad > 0 && product.voorraad <= product.minimumVoorraad;
      return match;
    }).sort((a, b) => {
      if (sortering === "naam") return a.naam.localeCompare(b.naam, "nl");
      if (sortering === "voorraad-laag") return a.voorraad - b.voorraad;
      if (sortering === "waarde-hoog") return b.voorraad * b.verkoopprijs - a.voorraad * a.verkoopprijs;
      return b.aangemaaktOp.localeCompare(a.aangemaaktOp);
    });
  }, [producten, zoeken, filter, sortering]);

  return (
    <div className="inventory-page">
      <header className="inventory-hero">
        <div>
          <span className="inventory-eyebrow">Productbeheer</span>
          <h1>Inventaris</h1>
          <p>Alles wat klaarstaat om verkocht te worden, helder op een plek.</p>
        </div>
      </header>

      <section className="inventory-stats" aria-label="Inventarisoverzicht">
        <article className="inventory-stat-card"><span className="inventory-stat-icon blue"><Boxes size={20} /></span><div><span>Producten</span><strong>{producten.length}</strong></div><small>{stats.totaleStuks} stuks op voorraad</small></article>
        <article className="inventory-stat-card"><span className="inventory-stat-icon green"><CircleDollarSign size={20} /></span><div><span>Verkoopwaarde</span><strong>{euro.format(stats.verkoopwaarde)}</strong></div><small>Potentiele omzet</small></article>
        <article className={`inventory-stat-card ${stats.lageVoorraad > 0 ? "needs-attention" : ""}`}><span className="inventory-stat-icon orange"><AlertTriangle size={20} /></span><div><span>Aandacht nodig</span><strong>{stats.lageVoorraad}</strong></div><small>{stats.lageVoorraad ? "Onder minimumvoorraad" : "Alles is op niveau"}</small></article>
      </section>

      <section className="inventory-workspace">
        <div className="inventory-toolbar">
          <div className="inventory-search"><Search size={18} /><input value={zoeken} onChange={(event) => setZoeken(event.target.value)} placeholder="Zoek op product, SKU of locatie..." aria-label="Inventaris doorzoeken" />{zoeken && <button onClick={() => setZoeken("")} aria-label="Zoekopdracht wissen"><X size={16} /></button>}</div>
          <div className="inventory-filter-group" aria-label="Filter op voorraadstatus">{(["alles", "laag", "op"] as Filter[]).map((optie) => <button key={optie} className={filter === optie ? "active" : ""} onClick={() => setFilter(optie)}>{optie === "alles" ? "Alles" : optie === "laag" ? "Bijna op" : "Uitverkocht"}</button>)}</div>
          <label className="inventory-sort"><SlidersHorizontal size={16} /><select value={sortering} onChange={(event) => setSortering(event.target.value as Sortering)} aria-label="Inventaris sorteren"><option value="nieuwste">Nieuwste eerst</option><option value="naam">Naam A-Z</option><option value="voorraad-laag">Voorraad: laag-hoog</option><option value="waarde-hoog">Waarde: hoog-laag</option></select></label>
          <div className="inventory-view-switcher" role="group" aria-label="Inventarisweergave">
            <button type="button" className={weergave === "tabel" ? "active" : ""} aria-pressed={weergave === "tabel"} onClick={() => setWeergave("tabel")} title="Tabelweergave"><List size={17} /><span>Tabel</span></button>
            <button type="button" className={weergave === "grid" ? "active" : ""} aria-pressed={weergave === "grid"} onClick={() => setWeergave("grid")} title="Gridweergave"><Grid2X2 size={16} /><span>Grid</span></button>
          </div>
        </div>

        <div className="inventory-results-row"><div><strong>{zichtbareProducten.length}</strong><span>{zichtbareProducten.length === 1 ? " product" : " producten"}</span></div>{producten.length > 0 && <span>Live bijgewerkt</span>}</div>

        {zichtbareProducten.length > 0 ? (
          weergave === "grid" ? (
            <div className="inventory-grid">{zichtbareProducten.map((product) => <InventoryCard key={product.id} product={product} onIncrease={(id) => pasVoorraadAan(id, 1)} onDecrease={(id) => pasVoorraadAan(id, -1)} onDelete={verwijderen} />)}</div>
          ) : (
            <div className="inventory-table-wrap">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Status</th>
                    <th>Locatie</th>
                    <th>Voorraad</th>
                    <th>VK-prijs</th>
                    <th>Waarde</th>
                    <th aria-label="Acties" />
                  </tr>
                </thead>
                <tbody>
                  {zichtbareProducten.map((product) => {
                    const status = voorraadStatus(product);
                    const voorraadWaarde = product.voorraad * product.verkoopprijs;
                    return (
                      <tr key={product.id}>
                        <td>
                          <div className="inventory-table-product">
                            {product.foto ? <img src={product.foto} alt={product.naam} /> : <span className="inventory-table-placeholder"><Boxes size={18} /></span>}
                            <div><strong>{product.naam}</strong><span>{product.sku}</span></div>
                          </div>
                        </td>
                        <td><span className={`inventory-status-badge inventory-table-status ${status}`}><i />{status === "op" ? "Uitverkocht" : status === "laag" ? "Bijna op" : "Op voorraad"}</span></td>
                        <td>{product.locatie || "Geen locatie"}</td>
                        <td>
                          <div className="inventory-table-stock">
                            <button onClick={() => pasVoorraadAan(product.id!, -1)} disabled={product.voorraad === 0} aria-label={`Voorraad van ${product.naam} verlagen`}><Minus size={15} /></button>
                            <strong>{product.voorraad}</strong>
                            <button onClick={() => pasVoorraadAan(product.id!, 1)} aria-label={`Voorraad van ${product.naam} verhogen`}><Plus size={15} /></button>
                            <span>min. {product.minimumVoorraad}</span>
                          </div>
                        </td>
                        <td>{euro.format(product.verkoopprijs)}</td>
                        <td><strong className="inventory-table-value">{euro.format(voorraadWaarde)}</strong></td>
                        <td><button className="inventory-table-delete" onClick={() => verwijderen(product.id!)} aria-label={`${product.naam} verwijderen`}><Trash2 size={16} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="inventory-empty"><span><PackageCheck size={30} /></span><h2>{producten.length === 0 ? "Je inventaris is nog leeg" : "Geen producten gevonden"}</h2><p>{producten.length === 0 ? "Voeg je eerste verkoopklare print toe en houd vanaf hier je voorraad bij." : "Probeer een andere zoekterm of pas je filter aan."}</p>{producten.length === 0 ? <button onClick={() => setFormulierOpen(true)}><Plus size={17} />Eerste product toevoegen</button> : <button onClick={() => { setZoeken(""); setFilter("alles"); }}>Filters wissen</button>}</div>
        )}
      </section>

      {formulierOpen && <div className="inventory-modal-backdrop" onMouseDown={() => setFormulierOpen(false)}><div className="inventory-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-form-title" onMouseDown={(event) => event.stopPropagation()}><button className="inventory-modal-close" onClick={() => setFormulierOpen(false)} aria-label="Sluiten"><X size={20} /></button><InventoryForm naam={naam} setNaam={setNaam} sku={sku} setSku={setSku} voorraad={voorraad} setVoorraad={setVoorraad} minimumVoorraad={minimumVoorraad} setMinimumVoorraad={setMinimumVoorraad} kostprijs={kostprijs} setKostprijs={setKostprijs} verkoopprijs={verkoopprijs} setVerkoopprijs={setVerkoopprijs} locatie={locatie} setLocatie={setLocatie} foto={foto} uploadFoto={uploadFoto} toevoegen={toevoegen} annuleren={() => setFormulierOpen(false)} /></div></div>}
    </div>
  );
}
