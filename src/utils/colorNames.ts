type Rgb = readonly [number, number, number];
type PaletteColor = { name: string; hex: `#${string}`; aliases?: readonly string[] };

// Perceptuele referenties voor filamenttinten. Hierdoor worden helderheid en
// verzadiging meegewogen en vallen metalen niet terug naar geel of oranje.
const PALETTE: readonly PaletteColor[] = [
  { name: "Zwart", hex: "#111318", aliases: ["black", "jet black"] },
  { name: "Antraciet", hex: "#34383f", aliases: ["anthracite", "charcoal"] },
  { name: "Donkergrijs", hex: "#555b66", aliases: ["dark grey", "dark gray"] },
  { name: "Grijs", hex: "#8b95a5", aliases: ["grey", "gray"] },
  { name: "Zilver", hex: "#c0c0c0", aliases: ["silver", "metallic silver"] },
  { name: "Lichtgrijs", hex: "#d7dbe0", aliases: ["light grey", "light gray"] },
  { name: "Wit", hex: "#f4f5f7", aliases: ["white"] },
  { name: "Gebroken wit", hex: "#f2eadf", aliases: ["off white", "ivory", "ivoor"] },
  { name: "Naturel", hex: "#e7dcc5", aliases: ["natural", "nature", "unbleached"] },
  { name: "Beige", hex: "#d8c39a", aliases: ["sand", "zand"] },
  { name: "Crème", hex: "#ead9aa", aliases: ["cream", "creme"] },
  { name: "Geel", hex: "#f6d32d", aliases: ["yellow"] },
  { name: "Citroengeel", hex: "#e9ed45", aliases: ["lemon", "lemon yellow"] },
  { name: "Neongeel", hex: "#dfff00", aliases: ["neon yellow", "fluorescent yellow"] },
  { name: "Mosterdgeel", hex: "#c49a20", aliases: ["mustard", "mustard yellow"] },
  { name: "Goud", hex: "#ffd700", aliases: ["gold", "metallic gold"] },
  { name: "Oudgoud", hex: "#d4af37", aliases: ["old gold", "antique gold"] },
  { name: "Champagne", hex: "#d6bd8a", aliases: ["champagne gold"] },
  { name: "Roségoud", hex: "#b76e79", aliases: ["rose gold", "rosegold", "rose-goud"] },
  { name: "Koper", hex: "#b87333", aliases: ["copper", "metallic copper"] },
  { name: "Brons", hex: "#cd7f32", aliases: ["bronze", "metallic bronze"] },
  { name: "Bruin", hex: "#7a4b2a", aliases: ["brown"] },
  { name: "Donkerbruin", hex: "#4b2e20", aliases: ["dark brown", "chocolate", "chocolade"] },
  { name: "Terracotta", hex: "#c65d3b", aliases: ["terra cotta"] },
  { name: "Oranje", hex: "#f47b20", aliases: ["orange"] },
  { name: "Koraal", hex: "#ff6f61", aliases: ["coral"] },
  { name: "Perzik", hex: "#f5a97f", aliases: ["peach"] },
  { name: "Rood", hex: "#e53935", aliases: ["red"] },
  { name: "Donkerrood", hex: "#8f1d21", aliases: ["dark red", "bordeaux", "burgundy"] },
  { name: "Roze", hex: "#ec70a1", aliases: ["pink"] },
  { name: "Lichtroze", hex: "#f5b6cd", aliases: ["light pink", "baby pink"] },
  { name: "Neonroze", hex: "#ff3cac", aliases: ["neon pink", "hot pink"] },
  { name: "Magenta", hex: "#d92f9d", aliases: ["fuchsia"] },
  { name: "Paars", hex: "#8247b8", aliases: ["purple"] },
  { name: "Violet", hex: "#6546d7", aliases: ["violet"] },
  { name: "Lavendel", hex: "#b69dde", aliases: ["lavender"] },
  { name: "Donkerblauw", hex: "#173f6d", aliases: ["dark blue", "navy", "marineblauw"] },
  { name: "Blauw", hex: "#3478d4", aliases: ["blue"] },
  { name: "Koningsblauw", hex: "#2455c3", aliases: ["royal blue"] },
  { name: "Lichtblauw", hex: "#74b9e8", aliases: ["light blue", "sky blue", "hemelsblauw"] },
  { name: "Cyaan", hex: "#20bfe3", aliases: ["cyan"] },
  { name: "Turquoise", hex: "#24b6a6", aliases: ["turquoise", "aqua"] },
  { name: "Petrol", hex: "#167c80", aliases: ["teal", "petrol blue"] },
  { name: "Mintgroen", hex: "#75d6b0", aliases: ["mint", "mint green"] },
  { name: "Groen", hex: "#2ca65a", aliases: ["green"] },
  { name: "Limoengroen", hex: "#82c91e", aliases: ["lime", "lime green"] },
  { name: "Neongroen", hex: "#39ff14", aliases: ["neon green", "fluorescent green"] },
  { name: "Olijfgroen", hex: "#78844b", aliases: ["olive", "olive green"] },
  { name: "Donkergroen", hex: "#185b3b", aliases: ["dark green", "forest green", "bosgroen"] },
  { name: "Transparant", hex: "#dce9ec", aliases: ["transparent", "clear", "doorzichtig"] },
] as const;

const normalizeName = (value: string) => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const paletteByName = new Map<string, PaletteColor>();
for (const color of PALETTE) {
  paletteByName.set(normalizeName(color.name), color);
  for (const alias of color.aliases ?? []) paletteByName.set(normalizeName(alias), color);
}

function normalizeHex(value: string) {
  const trimmed = value.trim();
  const short = trimmed.match(/^#([0-9a-f]{3})$/i);
  if (short) return `#${[...short[1]].map((part) => part + part).join("")}`.toLowerCase();
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed.toLowerCase() : null;
}

function rgb(value: string): Rgb | null {
  const hex = normalizeHex(value);
  if (!hex) return null;
  const number = Number.parseInt(hex.slice(1), 16);
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

function oklab([red, green, blue]: Rgb) {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  };
  const r = linear(red), g = linear(green), b = linear(blue);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b);
  const m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b);
  const s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [
    .2104542553 * l + .793617785 * m - .0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + .4505937099 * s,
    .0259040371 * l + .7827717662 * m - .808675766 * s,
  ] as const;
}

const paletteLab = PALETTE.map((color) => ({ color, lab: oklab(rgb(color.hex)!) }));

function nearestColor(value: string) {
  const input = rgb(value);
  if (!input) return null;
  const lab = oklab(input);
  let nearest = paletteLab[0];
  let shortest = Number.POSITIVE_INFINITY;
  for (const candidate of paletteLab) {
    const distance = Math.hypot(
      (lab[0] - candidate.lab[0]) * .85,
      (lab[1] - candidate.lab[1]) * 1.12,
      (lab[2] - candidate.lab[2]) * 1.12,
    );
    if (distance < shortest) { shortest = distance; nearest = candidate; }
  }
  return nearest.color;
}

export function colorName(value: string) {
  if (!value?.trim()) return "Onbekend";
  const named = paletteByName.get(normalizeName(value));
  if (named) return named.name;
  return nearestColor(value)?.name ?? value;
}

export function safeColor(value: string) {
  const hex = normalizeHex(value);
  if (hex) return hex;
  return paletteByName.get(normalizeName(value))?.hex ?? "#64748b";
}

export function colorsMatch(detectedColor: string, storedColor: string) {
  if (normalizeName(colorName(detectedColor)) === normalizeName(colorName(storedColor))) return true;
  const detectedRgb = rgb(safeColor(detectedColor));
  const storedRgb = rgb(safeColor(storedColor));
  if (!detectedRgb || !storedRgb) return false;
  const a = oklab(detectedRgb), b = oklab(storedRgb);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < .105;
}
