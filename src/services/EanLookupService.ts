export type EanProduct = {
  name: string;
  brand: string;
  description: string;
  category: string;
  image: string;
  source: string;
  price?: number;
};

export type EanCandidate = {
  kind: "product" | "web";
  title: string;
  source: string;
  url: string;
  snippet?: string;
  product?: EanProduct;
};

async function responseData(response: Response) {
  const data = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(data?.error || "Productgegevens konden niet worden opgehaald.");
  return data;
}

export async function searchEan(code: string): Promise<EanCandidate[]> {
  const response = await fetch(`/api/ean?code=${encodeURIComponent(code)}`);
  const data = await responseData(response) as { candidates?: EanCandidate[] };
  return data.candidates ?? [];
}

export async function scrapeEanCandidate(code: string, url: string): Promise<EanProduct> {
  const response = await fetch(`/api/ean?code=${encodeURIComponent(code)}&url=${encodeURIComponent(url)}`);
  const data = await responseData(response) as { product?: EanProduct };
  if (!data.product) throw new Error("Geen productgegevens gevonden.");
  return data.product;
}
