export type EanProduct = {
  name: string;
  brand: string;
  description: string;
  category: string;
  image: string;
  source: string;
};

export async function lookupEan(code: string): Promise<EanProduct | null> {
  const response = await fetch(`/api/ean?code=${encodeURIComponent(code)}`);

  if (response.status === 404) return null;
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(data?.error || "Productgegevens konden niet worden opgehaald.");
  }

  const data = await response.json() as { product?: EanProduct };
  return data.product ?? null;
}
