import { db } from "../database/db";

export async function loadPrints() {
  return await db.prints.toArray();
}

export async function deletePrint(id: number) {
  return await db.prints.delete(id);
}

export async function savePrint(print: any) {

  const kostprijs =
    Number(print.materiaalKosten || 0) +
    Number(print.stroomKosten || 0) +
    Number(print.onderhoudKosten || 0) +
    Number(print.verpakkingKosten || 0) +
    Number(print.overigeKosten || 0);

  const winst =
    Number(print.verkoopprijs || 0) -
    kostprijs;

  return await db.prints.update(
    print.id,
    {
      ...print,
      kostprijs,
      winst
    }
  );

}