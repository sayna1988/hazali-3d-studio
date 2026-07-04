import JSZip from "jszip";

export interface ParsedFilament {
  kleur: string;
  gewicht: number;
  lengteMeter?: number;
  materiaal?: string;
  uren?: number;
  minuten?: number;
}

export interface Parsed3MF {
  naam: string;
  gewicht: number;
  uren: number;
  minuten: number;
  filamenten: ParsedFilament[];
  filamentKleuren: string[];
  kleurBron: "3mf-metadata" | "preview" | "geen";
  filamentNaam: string;
  thumbnail?: string;
  printerNaam?: string;
  slicer?: string;
  laaghoogte?: number;
  aantalLagen?: number;
  nozzleDiameter?: number;
  filamentLengteMeter?: number;
  modelVolumeCm3?: number;
  afmetingen?: { x: number; y: number; z: number };
  objectAantal?: number;
  plateAantal?: number;
  bestandsGrootte?: number;
  metadataBronnen: string[];
  waarschuwingen: string[];
  splitPrint: boolean;
  splitPrintBron?: "3mf";
}

const attributes = (tag: string) => Object.fromEntries(
  [...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map((match) => [match[1].toLowerCase(), match[2]])
);

// Mesh XML expands many times beyond the compressed 3MF size. Keeping very large
// model files as strings (and then copying them into `combined`) can exhaust the
// browser tab before the next file in a batch is reached.
const MAX_MODEL_XML_BYTES = 16 * 1024 * 1024;
const MAX_METADATA_FILE_BYTES = 16 * 1024 * 1024;
const MAX_METADATA_TOTAL_BYTES = 48 * 1024 * 1024;

function uncompressedSize(file: JSZip.JSZipObject) {
  return (file as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
}

function splitPlateFilaments(documents: Array<{ name: string; text: string }>) {
  const perColor = new Map<string, { gewicht: number; lengteMeter: number; seconds: number; materiaal?: string }>();
  let usablePlates = 0;
  for (const { text } of documents.filter((doc) => /slice_info|plate.*\.config/i.test(doc.name))) {
    for (const plateMatch of text.matchAll(/<plate\b([^>]*)>([\s\S]*?)<\/plate>/gi)) {
      const plateText = plateMatch[2];
      const plateAttrs = attributes(plateMatch[1]);
      const filamentTags = [...plateText.matchAll(/<filament\b([^>]*)\/?\s*>/gi)]
        .map((match) => attributes(match[1]))
        .filter((attrs) => numberValue(attrs.used_g ?? attrs.weight ?? attrs.filament_weight));
      if (filamentTags.length !== 1) continue;
      const filament = filamentTags[0];
      const kleur = cleanColor(filament.color ?? filament.colour ?? filament.filament_color ?? "");
      if (!/^#[0-9a-f]{6}$/i.test(kleur)) continue;
      const seconds = secondsFromText(
        plateAttrs.prediction ?? plateAttrs.print_time ??
        valuesForKeys(plateText, ["prediction", "print_time", "estimated_print_time"])[0]
      );
      const current = perColor.get(kleur) ?? { gewicht: 0, lengteMeter: 0, seconds: 0 };
      current.gewicht += numberValue(filament.used_g ?? filament.weight ?? filament.filament_weight) ?? 0;
      current.lengteMeter += (numberValue(filament.used_m) ?? 0) + (numberValue(filament.used_mm) ?? 0) / 1000;
      current.seconds += seconds;
      current.materiaal ??= filament.type ?? filament.material;
      perColor.set(kleur, current);
      usablePlates += 1;
    }
  }
  return usablePlates > 1 && perColor.size > 1
    ? perColor
    : new Map<string, { gewicht: number; lengteMeter: number; seconds: number; materiaal?: string }>();
}

function usedFilamentColors(documents: Array<{ name: string; text: string }>) {
  const colors: string[] = [];
  for (const { text } of documents.filter((doc) => /slice_info|plate.*\.config/i.test(doc.name))) {
    for (const match of text.matchAll(/<filament\b([^>]*)\/?\s*>/gi)) {
      const filament = attributes(match[1]);
      const used = numberValue(filament.used_g ?? filament.weight ?? filament.filament_weight)
        ?? numberValue(filament.used_m)
        ?? numberValue(filament.used_mm);
      if (!used || used <= 0) continue;
      const color = cleanColor(filament.color ?? filament.colour ?? filament.filament_color ?? "");
      if (/^#[0-9a-f]{6}$/i.test(color) && !colors.includes(color)) colors.push(color);
    }
  }
  return colors;
}

const numberValue = (value?: string | null) => {
  if (!value) return undefined;
  const parsed = Number(value.replace(",", ".").match(/-?\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const cleanColor = (value: string) => {
  const color = value.trim().replace(/^0x/i, "#");
  if (/^#[0-9a-f]{8}$/i.test(color)) return color.slice(0, 7);
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : color;
};

const valuesForKeys = (text: string, keys: string[]) => {
  const found: string[] = [];
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`(?:key|name|type)=["']${escaped}["'][^>]*?value=["']([^"']+)["']`, "gi"),
      new RegExp(`(?:key|name|type)=["']${escaped}["'][^>]*>([^<]+)`, "gi"),
      new RegExp(`["']${escaped}["']\\s*:\\s*(?:["']([^"']*)["']|([^,}\\]\r\n]+))`, "gi"),
      new RegExp(`^\\s*${escaped}\\s*=\\s*([^\\r\\n]+)`, "gim")
    ];
    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text))) {
        const value = (match[1] ?? match[2] ?? match[3] ?? "").trim();
        if (value) found.push(value.replace(/^['"]|['"]$/g, ""));
      }
    }
  }
  return found;
};

const listValue = (values: string[]) => values.flatMap((value) => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
  } catch {
    return value.split(/[;,]/).map((part) => part.trim()).filter(Boolean);
  }
});

const uniqueValues = <T,>(values: T[]) => values.filter((value, index, list) => list.indexOf(value) === index);

function jsonValuesForKeys(documents: Array<{ name: string; text: string }>, keys: string[]) {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const found: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (wanted.has(key.toLowerCase())) {
        if (Array.isArray(child)) found.push(...child.map(String));
        else if (child !== null && typeof child !== "object") found.push(String(child));
      }
      visit(child);
    }
  };
  for (const document of documents) {
    if (!/\.json$|project_settings\.config$/i.test(document.name) && !/^\s*(?:\[|\{)/.test(document.text)) continue;
    try { visit(JSON.parse(document.text)); } catch { /* Niet ieder .config-bestand is JSON. */ }
  }
  return found;
}

function usedFilamentIndexes(documents: Array<{ name: string; text: string }>, colorCount: number) {
  if (colorCount < 2) return [];
  const indexKeys = ["extruder", "extruder_id", "filament_id", "filament_index"];
  const relevantDocuments = documents.filter((doc) => /model_settings|slice_info|plate.*\.config|\.model$/i.test(doc.name));
  if (!relevantDocuments.length) return [];
  const text = relevantDocuments.map((doc) => doc.text).join("\n");
  const attributeValues = [...text.matchAll(/\b(?:extruder|extruder_id|filament_id|filament_index)\s*=\s*["'](\d+)["']/gi)]
    .map((match) => match[1]);
  const values = [
    ...jsonValuesForKeys(relevantDocuments, indexKeys),
    ...listValue(valuesForKeys(text, indexKeys)),
    ...attributeValues
  ];
  const numbers = uniqueValues(values.map(numberValue).filter((value): value is number => value !== undefined && Number.isInteger(value) && value >= 0));
  if (!numbers.length) return [];
  const oneBased = numbers.every((value) => value >= 1 && value <= colorCount);
  return numbers
    .map((value) => oneBased ? value - 1 : value)
    .filter((index) => index >= 0 && index < colorCount);
}

const colorDistance = (a: [number, number, number], b: [number, number, number]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

async function previewColors(blob?: Blob): Promise<string[]> {
  if (!blob || typeof document === "undefined") return [];
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Preview kon niet worden gelezen"));
      element.src = url;
    });
    const maximum = 180;
    const scale = Math.min(1, maximum / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return [];
    context.drawImage(image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    const bins = new Map<string, { rgb: [number, number, number]; count: number; score: number }>();
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] < 160) continue;
      const rgb: [number, number, number] = [pixels[index], pixels[index + 1], pixels[index + 2]];
      const max = Math.max(...rgb), min = Math.min(...rgb);
      const light = (max + min) / 510;
      if (light < .035 || light > .985) continue;
      const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
      const quantized = rgb.map((channel) => Math.min(255, Math.round(channel / 24) * 24)) as [number, number, number];
      const key = quantized.join(",");
      const current = bins.get(key) ?? { rgb: quantized, count: 0, score: 0 };
      current.count += 1;
      current.score += .25 + saturation * 1.75;
      bins.set(key, current);
    }
    const minimumPixels = Math.max(4, width * height * .0015);
    const selected: Array<[number, number, number]> = [];
    for (const candidate of [...bins.values()].filter((item) => item.count >= minimumPixels).sort((a, b) => b.score - a.score)) {
      if (selected.every((color) => colorDistance(color, candidate.rgb) > 58)) selected.push(candidate.rgb);
      if (selected.length === 5) break;
    }
    return selected.map((rgb) => `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase()}`);
  } catch {
    return [];
  } finally {
    URL.revokeObjectURL(url);
  }
}

const secondsFromText = (value?: string) => {
  if (!value) return 0;
  const direct = numberValue(value);
  if (/^\s*\d+(?:\.\d+)?\s*$/.test(value)) return direct ?? 0;
  const days = numberValue(value.match(/([\d.]+)\s*d/i)?.[1]) ?? 0;
  const hours = numberValue(value.match(/([\d.]+)\s*h/i)?.[1]) ?? 0;
  const minutes = numberValue(value.match(/([\d.]+)\s*m(?!s)/i)?.[1]) ?? 0;
  const seconds = numberValue(value.match(/([\d.]+)\s*s/i)?.[1]) ?? 0;
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
};

async function asDataUrl(blob?: Blob) {
  if (!blob) return "";
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function geometryFromModels(models: string[]) {
  let totalVolumeMm3 = 0;
  let objectAantal = 0;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  let vertexAantal = 0;
  for (const xml of models) {
    const unit = xml.match(/<model\b[^>]*\bunit=["']([^"']+)/i)?.[1]?.toLowerCase() ?? "millimeter";
    const scale = unit === "inch" ? 25.4 : unit === "micron" ? 0.001 : unit === "centimeter" ? 10 : unit === "meter" ? 1000 : 1;
    const objectMatches = [...xml.matchAll(/<object\b[^>]*>([\s\S]*?)<\/object>/gi)];
    for (const object of objectMatches) {
      const mesh = object[1].match(/<mesh\b[^>]*>([\s\S]*?)<\/mesh>/i)?.[1];
      if (!mesh) continue;
      objectAantal += 1;
      const vertices = [...mesh.matchAll(/<vertex\b[^>]*\bx=["']([^"']+)["'][^>]*\by=["']([^"']+)["'][^>]*\bz=["']([^"']+)["']/gi)]
        .map((m) => [Number(m[1]) * scale, Number(m[2]) * scale, Number(m[3]) * scale] as [number, number, number]);
      for (const [x, y, z] of vertices) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
        vertexAantal += 1;
      }
      let signed = 0;
      for (const triangle of mesh.matchAll(/<triangle\b[^>]*\bv1=["'](\d+)["'][^>]*\bv2=["'](\d+)["'][^>]*\bv3=["'](\d+)["']/gi)) {
        const a = vertices[Number(triangle[1])], b = vertices[Number(triangle[2])], c = vertices[Number(triangle[3])];
        if (!a || !b || !c) continue;
        signed += a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
      }
      totalVolumeMm3 += Math.abs(signed / 6);
    }
  }
  const dimensions = vertexAantal ? {
    x: maxX - minX,
    y: maxY - minY,
    z: maxZ - minZ
  } : undefined;
  return { volumeCm3: totalVolumeMm3 / 1000, dimensions, objectAantal };
}

export async function parse3MF(file: File): Promise<Parsed3MF> {
  if (!/\.3mf$/i.test(file.name)) throw new Error("Selecteer een geldig .3mf-bestand.");
  const zip = await JSZip.loadAsync(file);
  const names = Object.keys(zip.files);
  const textNames = names.filter((name) => /\.(?:xml|config|json|txt)$/i.test(name));
  const documents: Array<{ name: string; text: string }> = [];
  let metadataBytes = 0;
  let overgeslagenMetadata = 0;
  for (const name of textNames) {
    const entry = zip.files[name];
    const size = uncompressedSize(entry);
    if ((size !== undefined && size > MAX_METADATA_FILE_BYTES) || metadataBytes + (size ?? 0) > MAX_METADATA_TOTAL_BYTES) {
      overgeslagenMetadata += 1;
      continue;
    }
    const text = await entry.async("text");
    metadataBytes += text.length * 2;
    if (metadataBytes > MAX_METADATA_TOTAL_BYTES) {
      overgeslagenMetadata += 1;
      break;
    }
    documents.push({ name, text });
  }
  const combined = documents.map((doc) => doc.text).join("\n");
  const models: string[] = [];
  let geometrieOvergeslagen = false;
  for (const name of names.filter((entryName) => /\.model$/i.test(entryName))) {
    const entry = zip.files[name];
    const size = uncompressedSize(entry);
    if (size === undefined || size > MAX_MODEL_XML_BYTES) {
      geometrieOvergeslagen = true;
      continue;
    }
    models.push(await entry.async("text"));
  }
  const geometry = geometryFromModels(models);
  const splitFilaments = splitPlateFilaments(documents);
  const usedColors = usedFilamentColors(documents);
  const sources = names.filter((name) => /Metadata|Auxiliaries|\.model$/i.test(name));

  const weights = valuesForKeys(combined, ["total_weight", "total filament weight [g]", "filament used [g]", "filament_weight", "used_filament", "weight"])
    .map(numberValue).filter((v): v is number => v !== undefined && v > 0);
  const lengths = valuesForKeys(combined, ["total filament length [mm]", "filament used [mm]", "filament_length", "used_filament_length"])
    .map(numberValue).filter((v): v is number => v !== undefined && v > 0);
  // `default_filament_colour` is a filament-profile fallback in Bambu/MakerWorld
  // 3MFs and can be present even when that color is not used for the print.
  const colorKeys = ["filament_colour", "filament_color", "filament_colors", "extruder_colour", "extruder_color"];
  const metadataColors = [
    ...jsonValuesForKeys(documents, colorKeys),
    ...listValue(valuesForKeys(combined, colorKeys))
  ].map(cleanColor).filter((color) => /^#[0-9A-F]{6}$/i.test(color));
  const indexedMetadataColors = uniqueValues(usedFilamentIndexes(documents, metadataColors.length)
    .map((index) => metadataColors[index])
    .filter((color): color is string => Boolean(color)));
  const materialKeys = ["filament_type", "material", "filament_settings_id"];
  const materials = [
    ...jsonValuesForKeys(documents, materialKeys),
    ...listValue(valuesForKeys(combined, materialKeys))
  ].map((value) => value.replace(/^\[?["']|["']?\]?$/g, "").trim())
    .filter((value, index, list) => value && !["[", "]", "{", "}"].some((character) => value.includes(character)) && list.indexOf(value) === index);
  const timeValues = valuesForKeys(combined, ["prediction", "print_time", "estimated_print_time", "normal mode", "total_time"]);
  const seconds = Math.max(0, ...timeValues.map(secondsFromText));
  const title = valuesForKeys(combined, ["Title", "title", "name"])[0];
  const app = valuesForKeys(combined, ["Application", "application", "slicer"])[0];
  const printer = valuesForKeys(combined, ["printer_model", "printer_settings_id", "printer_name", "printer"])[0];
  const layerHeight = numberValue(valuesForKeys(combined, ["layer_height", "layer height"])[0]);
  const layerCount = numberValue(valuesForKeys(combined, ["layer_count", "total_layer_number", "total layers"])[0]);
  const nozzle = numberValue(listValue(valuesForKeys(combined, ["nozzle_diameter", "nozzle diameter"]))[0]);
  const plateIds = new Set(valuesForKeys(combined, ["plate_id", "plate_index"]));
  const plateImages = names.filter((name) => /(?:plate|top)[_-]?\d+\.png$/i.test(name));
  const thumbnailName = names.find((name) => /Metadata\/(?:plate|top)_1\.png$/i.test(name))
    ?? names.find((name) => /thumbnail.*\.(?:png|jpe?g)$/i.test(name))
    ?? plateImages[0];
  const thumbnailFile = thumbnailName ? zip.file(thumbnailName) : null;
  const thumbnailBlob = thumbnailFile ? await thumbnailFile.async("blob") : undefined;
  const thumbnail = await asDataUrl(thumbnailBlob);
  const uniqueMetadataColors = indexedMetadataColors.length ? indexedMetadataColors : uniqueValues(metadataColors);
  const fallbackColors = usedColors.length || uniqueMetadataColors.length ? [] : await previewColors(thumbnailBlob);
  const colors = usedColors.length ? usedColors : uniqueMetadataColors.length ? uniqueMetadataColors : fallbackColors;
  const kleurBron: Parsed3MF["kleurBron"] = usedColors.length || uniqueMetadataColors.length ? "3mf-metadata" : fallbackColors.length ? "preview" : "geen";

  let weight = weights[0] ?? 0;
  const warnings: string[] = [];
  if (geometrieOvergeslagen) warnings.push("De geometrieberekening is overgeslagen om te voorkomen dat dit grote 3MF-bestand het browsergeheugen uitput.");
  if (overgeslagenMetadata) warnings.push(`${overgeslagenMetadata} uitzonderlijk groot metadatabestand is overgeslagen om het browsergeheugen te beschermen.`);
  if (!weight && geometry.volumeCm3 > 0) {
    weight = geometry.volumeCm3 * 1.24;
    warnings.push("Gewicht is geschat uit het modelvolume (PLA-dichtheid, zonder rekening met infill). ");
  }
  if (!seconds) warnings.push("De 3MF bevat geen bruikbare schatting van de printtijd.");
  if (kleurBron === "preview") warnings.push("De 3MF bevatte geen kleurmetadata; kleuren zijn benaderd op basis van de preview-afbeelding.");
  if (!colors.length) warnings.push("Er zijn geen filamentkleuren in het bestand of de preview gevonden.");
  const filamentColors = splitFilaments.size ? [...splitFilaments.keys()] : colors;
  const filamenten = filamentColors.map((kleur, index) => {
    const split = splitFilaments.get(kleur);
    return {
      kleur,
      gewicht: split?.gewicht ?? (filamentColors.length === 1 ? weight : 0),
      materiaal: split?.materiaal ?? materials[index] ?? materials[0],
      lengteMeter: split?.lengteMeter || (lengths[index] ? lengths[index] / 1000 : undefined),
      uren: split ? Math.floor(split.seconds / 3600) : undefined,
      minuten: split ? Math.round((split.seconds % 3600) / 60) : undefined
    };
  });
  if (splitFilaments.size) {
    weight = [...splitFilaments.values()].reduce((sum, item) => sum + item.gewicht, 0) || weight;
  }
  const splitSeconds = [...splitFilaments.values()].reduce((sum, item) => sum + item.seconds, 0);
  const totalSeconds = splitSeconds || seconds;

  return {
    naam: (title && title.length < 150 ? title : file.name.replace(/\.3mf$/i, "")),
    gewicht: Math.round(weight * 100) / 100,
    uren: Math.floor(totalSeconds / 3600),
    minuten: Math.round((totalSeconds % 3600) / 60),
    filamenten,
    filamentKleuren: filamentColors,
    kleurBron,
    filamentNaam: materials.join(" / ") || "Onbekend",
    thumbnail,
    printerNaam: printer,
    slicer: app,
    laaghoogte: layerHeight,
    aantalLagen: layerCount,
    nozzleDiameter: nozzle,
    filamentLengteMeter: lengths.length ? lengths.reduce((sum, value) => sum + value, 0) / 1000 : undefined,
    modelVolumeCm3: geometry.volumeCm3 ? Math.round(geometry.volumeCm3 * 100) / 100 : undefined,
    afmetingen: geometry.dimensions ? Object.fromEntries(Object.entries(geometry.dimensions).map(([key, value]) => [key, Math.round(value * 100) / 100])) as { x: number; y: number; z: number } : undefined,
    objectAantal: geometry.objectAantal || undefined,
    plateAantal: Math.max(plateIds.size, plateImages.length, 1),
    bestandsGrootte: file.size,
    metadataBronnen: sources,
    waarschuwingen: warnings,
    splitPrint: splitFilaments.size > 0,
    splitPrintBron: splitFilaments.size > 0 ? "3mf" : undefined
  };
}
