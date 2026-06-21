export type InvoiceFilament = {
  id: string;
  selected: boolean;
  name: string;
  brand: string;
  material: string;
  color: string;
  quantity: number;
  gramsPerSpool: number;
  pricePerSpool: number;
  pricePerKg: number;
  lineTotal: number;
  confidence: number;
  notes: string;
};

export type InvoiceExtraction = {
  supplier: string;
  invoiceNumber: string;
  invoiceDate: string;
  currency: string;
  filaments: InvoiceFilament[];
  warnings: string[];
};

const MAX_FILE_SIZE = 3 * 1024 * 1024;
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Het bestand kon niet worden gelezen."));
    reader.readAsDataURL(file);
  });
}

async function prepareImage(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  if (file.size <= MAX_FILE_SIZE) return { dataUrl: await fileToDataUrl(file), mimeType: file.type };

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("De afbeelding kon niet worden verkleind.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", .82));
  if (!blob) throw new Error("De afbeelding kon niet worden verwerkt.");
  return { dataUrl: await fileToDataUrl(blob), mimeType: "image/jpeg" };
}

export async function extractInvoice(file: File, accessToken?: string): Promise<InvoiceExtraction> {
  const extension = file.name.toLowerCase().split(".").pop();
  const isPdf = file.type === "application/pdf" || extension === "pdf";
  const isImage = file.type.startsWith("image/") && ACCEPTED_TYPES.includes(file.type);
  if (!isPdf && !isImage) throw new Error("Gebruik een PDF-, JPG-, PNG- of WebP-bestand.");
  if (isPdf && file.size > MAX_FILE_SIZE) throw new Error("Een PDF mag maximaal 3 MB groot zijn.");

  const prepared = isImage
    ? await prepareImage(file)
    : { dataUrl: await fileToDataUrl(file), mimeType: "application/pdf" };
  const response = await fetch("/api/invoice", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      filename: file.name,
      mimeType: prepared.mimeType,
      dataUrl: prepared.dataUrl,
    }),
  });
  const data = await response.json().catch(() => null) as (InvoiceExtraction & { error?: string }) | null;
  if (!response.ok) throw new Error(data?.error || "De factuur kon niet worden geanalyseerd.");
  if (!data) throw new Error("De factuur leverde geen resultaat op.");
  return {
    ...data,
    filaments: (data.filaments ?? []).map((item, index) => ({
      ...item,
      id: `invoice-${Date.now()}-${index}`,
      selected: true,
    })),
  };
}
