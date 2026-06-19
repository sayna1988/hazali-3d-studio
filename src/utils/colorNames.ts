const palette = [
  ["Rood", "#E53935"], ["Donkerrood", "#8B1E1E"], ["Oranje", "#F57C00"],
  ["Geel", "#FDD835"], ["Limoengroen", "#8BC34A"], ["Groen", "#2EAD64"],
  ["Donkergroen", "#176B3A"], ["Turquoise", "#20BFA9"], ["Cyaan", "#20BDEB"],
  ["Lichtblauw", "#64B5F6"], ["Blauw", "#2878D0"], ["Donkerblauw", "#173B73"],
  ["Paars", "#7E57C2"], ["Magenta", "#D13CA4"], ["Roze", "#F48FB1"],
  ["Bruin", "#795548"], ["Beige", "#D8C39A"], ["Goud", "#C9A227"],
  ["Zilver", "#AEB6BF"]
] as const;

const rgb = (hex: string) => {
  const match = hex.match(/^#([0-9a-f]{6})$/i);
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const;
};

export function colorName(hex: string) {
  const value = rgb(hex);
  if (!value) return hex || "Onbekend";
  const [red, green, blue] = value;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const brightness = (maximum + minimum) / 2;
  const saturation = maximum === minimum ? 0 : (maximum - minimum) / (255 - Math.abs(maximum + minimum - 255));

  if (saturation < .12) {
    if (brightness < 35) return "Zwart";
    if (brightness < 90) return "Donkergrijs";
    if (brightness < 175) return "Grijs";
    if (brightness < 235) return "Lichtgrijs";
    return "Wit";
  }

  let nearest: (typeof palette)[number] = palette[0];
  let distance = Number.POSITIVE_INFINITY;
  for (const candidate of palette) {
    const candidateRgb = rgb(candidate[1])!;
    const difference = Math.hypot(red - candidateRgb[0], green - candidateRgb[1], blue - candidateRgb[2]);
    if (difference < distance) { nearest = candidate; distance = difference; }
  }
  return nearest[0];
}

export function safeColor(hex: string) {
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#64748b";
}

const namedColors: Record<string, string> = {
  zwart: "#191B20", wit: "#F4F5F7", rood: "#EF4444", blauw: "#3B82F6",
  groen: "#22C55E", geel: "#FACC15", oranje: "#F97316", paars: "#A855F7",
  grijs: "#8B95A5", roze: "#EC4899", naturel: "#E7DCC5", beige: "#D8C39A"
};

const normalizeName = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f\s_-]/g, "");

export function colorsMatch(detectedHex: string, storedColor: string) {
  const detectedName = normalizeName(colorName(detectedHex));
  const storedName = normalizeName(storedColor);
  if (detectedName === storedName) return true;
  const storedHex = /^#[0-9a-f]{6}$/i.test(storedColor) ? storedColor : namedColors[storedColor.trim().toLowerCase()];
  const detectedRgb = rgb(detectedHex);
  const storedRgb = storedHex ? rgb(storedHex) : null;
  return Boolean(detectedRgb && storedRgb && colorDistance(detectedRgb, storedRgb) < 48);
}

function colorDistance(a: readonly number[], b: readonly number[]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
