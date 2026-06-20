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

  const delta = maximum - minimum;
  let hue = 0;
  if (delta) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;

  if (hue < 15 || hue >= 345) return brightness < 105 ? "Donkerrood" : brightness > 205 ? "Roze" : "Rood";
  if (hue < 42) return brightness < 95 ? "Bruin" : "Oranje";
  if (hue < 68) return saturation < .45 ? "Goud" : "Geel";
  if (hue < 95) return "Limoengroen";
  if (hue < 155) return brightness < 90 ? "Donkergroen" : "Groen";
  if (hue < 180) return "Turquoise";
  if (hue < 200) return "Cyaan";
  if (hue < 250) return brightness < 95 ? "Donkerblauw" : brightness > 205 ? "Lichtblauw" : "Blauw";
  if (hue < 295) return "Paars";
  if (hue < 335) return "Magenta";
  return "Roze";
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
