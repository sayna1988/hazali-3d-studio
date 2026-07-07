import "./ProductFotoGenerator.css";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, DragEvent } from "react";
import {
  Download,
  ImagePlus,
  LoaderCircle,
  SlidersHorizontal,
  Sparkles,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import Page from "../components/Page/Page";

const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1350;
const DEFAULT_TEXT = "Wing\nBall";
const LOGO_SRC = "/logo.png";

type Rgb = {
  r: number;
  g: number;
  b: number;
};

type Hsl = {
  h: number;
  s: number;
  l: number;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Palette = {
  primary: Rgb;
  secondary: Rgb;
  dark: Rgb;
  light: Rgb;
};

type ImageAnalysis = {
  crop: Rect;
  palette: Palette;
};

type PaletteStyle = CSSProperties & {
  "--generator-primary": string;
  "--generator-secondary": string;
};

const DEFAULT_PALETTE: Palette = {
  primary: { r: 20, g: 148, b: 255 },
  secondary: { r: 172, g: 138, b: 96 },
  dark: { r: 8, g: 18, b: 32 },
  light: { r: 245, g: 248, b: 250 },
};

export default function ProductFotoGenerator() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  const [productFileName, setProductFileName] = useState("");
  const [draftText, setDraftText] = useState(DEFAULT_TEXT);
  const [generatedText, setGeneratedText] = useState(DEFAULT_TEXT);
  const [isDragging, setIsDragging] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [message, setMessage] = useState("Klaar voor een productfoto.");
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);

  useEffect(() => {
    return () => {
      if (productImageUrl) URL.revokeObjectURL(productImageUrl);
    };
  }, [productImageUrl]);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext("2d", { alpha: false });
      if (!context) {
        setMessage("Canvas wordt niet ondersteund in deze browser.");
        return;
      }

      setIsRendering(true);

      try {
        const [productImage, logoImage] = await Promise.all([
          productImageUrl ? loadImage(productImageUrl) : Promise.resolve<HTMLImageElement | null>(null),
          loadImage(LOGO_SRC),
        ]);

        if (cancelled) return;

        const analysis = productImage
          ? analyseProductImage(productImage)
          : {
              crop: { x: 0, y: 0, width: 1, height: 1 },
              palette: DEFAULT_PALETTE,
            };

        setPalette(analysis.palette);
        renderProductPhoto(context, {
          text: generatedText,
          productImage,
          logoImage,
          analysis,
        });
        setMessage(productImage ? "Instagram-afbeelding gegenereerd." : "Kies een productfoto om te starten.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Afbeelding genereren is mislukt.");
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    }

    void render();

    return () => {
      cancelled = true;
    };
  }, [generatedText, productImageUrl]);

  const paletteStyle = useMemo<PaletteStyle>(() => ({
    "--generator-primary": rgbToCss(palette.primary),
    "--generator-secondary": rgbToCss(palette.secondary),
  }), [palette]);

  const hasPendingText = draftText !== generatedText;

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function selectFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Kies een JPG, PNG of WebP afbeelding.");
      return;
    }

    setProductFileName(file.name);
    setProductImageUrl(URL.createObjectURL(file));
    setMessage("Productfoto geladen.");
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files[0]);
  }

  function generateImage() {
    setGeneratedText(normalizeInputText(draftText));
  }

  function clearProductImage() {
    setProductImageUrl(null);
    setProductFileName("");
    setMessage("Productfoto verwijderd.");
  }

  function downloadImage() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) {
        setMessage("Download voorbereiden is mislukt.");
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${slugify(generatedText)}-instagram.jpg`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    }, "image/jpeg", 0.94);
  }

  return (
    <Page title="Productfoto" subtitle="Instagram output in 1080 x 1350 met vaste Hazali branding.">
      <div className="product-generator" style={paletteStyle}>
        <section className="product-generator__controls" aria-label="Productfoto generator">
          <div className="product-generator__panel">
            <div className="product-generator__panel-header">
              <span><ImagePlus size={17} /> Productfoto</span>
              {productImageUrl && (
                <button type="button" onClick={clearProductImage} aria-label="Productfoto verwijderen">
                  <X size={17} />
                </button>
              )}
            </div>

            <button
              type="button"
              className={`product-generator__dropzone${isDragging ? " is-dragging" : ""}`}
              onClick={openFilePicker}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false);
              }}
              onDrop={handleDrop}
            >
              <span><Upload size={22} /></span>
              <strong>{productFileName || "Kies productfoto"}</strong>
              <small>JPG, PNG of WebP</small>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileInput}
            />
          </div>

          <div className="product-generator__panel">
            <div className="product-generator__panel-header">
              <span><SlidersHorizontal size={17} /> Tekst</span>
            </div>

            <label className="product-generator__field">
              <span>Titeltekst</span>
              <textarea
                value={draftText}
                rows={3}
                maxLength={48}
                onChange={(event) => setDraftText(event.target.value)}
                placeholder="Bijv. Wing Ball"
              />
            </label>

            <div className="product-generator__swatches" aria-label="Gevonden productkleuren">
              <span style={{ background: rgbToCss(palette.primary) }} />
              <span style={{ background: rgbToCss(palette.secondary) }} />
              <span style={{ background: rgbToCss(palette.dark) }} />
            </div>

            <button
              type="button"
              className="product-generator__generate"
              onClick={generateImage}
              disabled={isRendering}
            >
              {isRendering ? <LoaderCircle size={18} className="product-generator__spinner" /> : <WandSparkles size={18} />}
              Genereer afbeelding
            </button>
          </div>
        </section>

        <section className="product-generator__preview-panel" aria-label="Voorbeeld">
          <div className="product-generator__preview-top">
            <span><Sparkles size={16} /> Instagram staand</span>
            <button type="button" onClick={downloadImage} disabled={isRendering}>
              <Download size={17} />
              Download JPG
            </button>
          </div>

          <div className="product-generator__preview-frame">
            <canvas ref={canvasRef} width={OUTPUT_WIDTH} height={OUTPUT_HEIGHT} />
          </div>

          <div className="product-generator__status" aria-live="polite">
            <span>{hasPendingText ? "Tekst gewijzigd; genereer opnieuw." : message}</span>
            <strong>1080 x 1350</strong>
          </div>
        </section>
      </div>
    </Page>
  );
}

function normalizeInputText(value: string) {
  return value.trim() || "Nieuw product";
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Afbeelding kon niet worden geladen."));
    image.src = src;
  });
}

function renderProductPhoto(
  context: CanvasRenderingContext2D,
  options: {
    text: string;
    productImage: HTMLImageElement | null;
    logoImage: HTMLImageElement;
    analysis: ImageAnalysis;
  },
) {
  context.clearRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  drawBackground(context, options.analysis.palette);
  drawDecorations(context, options.analysis.palette);
  drawHeadline(context, options.text, options.analysis.palette);

  if (options.productImage) {
    drawProduct(context, options.productImage, options.analysis);
  } else {
    drawEmptyProductSlot(context, options.analysis.palette);
  }

  drawForegroundHighlights(context, options.analysis.palette);
  drawLogo(context, options.logoImage);
}

function drawBackground(context: CanvasRenderingContext2D, palette: Palette) {
  const headlineAccent = pickHeadlineAccent(palette);
  const supportAccent = pickSupportAccent(palette, headlineAccent);
  const gradient = context.createLinearGradient(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  gradient.addColorStop(0, rgbToCss(mix(palette.light, supportAccent, 0.18)));
  gradient.addColorStop(0.34, "#f8f4ed");
  gradient.addColorStop(0.62, "#ffffff");
  gradient.addColorStop(1, rgbToCss(mix(palette.light, headlineAccent, 0.16)));
  context.fillStyle = gradient;
  context.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

  drawRibbon(context, supportAccent, 76, 0.72, (pathContext) => {
    pathContext.moveTo(-72, -28);
    pathContext.bezierCurveTo(42, 92, 78, 190, 174, 320);
  });
  drawRibbon(context, headlineAccent, 22, 0.82, (pathContext) => {
    pathContext.moveTo(18, -34);
    pathContext.bezierCurveTo(82, 68, 116, 160, 206, 276);
  });
  drawRibbon(context, headlineAccent, 48, 0.76, (pathContext) => {
    pathContext.moveTo(1118, 400);
    pathContext.bezierCurveTo(928, 622, 944, 880, 1118, 1090);
  });
  drawRibbon(context, supportAccent, 28, 0.72, (pathContext) => {
    pathContext.moveTo(1138, 500);
    pathContext.bezierCurveTo(980, 708, 1004, 914, 1140, 1068);
  });

  const spotlight = context.createRadialGradient(OUTPUT_WIDTH / 2, 640, 40, OUTPUT_WIDTH / 2, 650, 720);
  spotlight.addColorStop(0, "rgba(255, 255, 255, 0.98)");
  spotlight.addColorStop(0.45, "rgba(255, 255, 255, 0.64)");
  spotlight.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = spotlight;
  context.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

  const vignette = context.createRadialGradient(OUTPUT_WIDTH / 2, 690, 260, OUTPUT_WIDTH / 2, 690, 850);
  vignette.addColorStop(0, "rgba(255, 255, 255, 0)");
  vignette.addColorStop(1, rgbToRgba(palette.dark, 0.16));
  context.fillStyle = vignette;
  context.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

  drawSoftCircle(context, 62, 560, 15, "rgba(255, 255, 255, 0.56)");
  drawSoftCircle(context, 96, 638, 8, "rgba(255, 255, 255, 0.72)");
  drawSoftCircle(context, 848, 88, 20, "rgba(255, 255, 255, 0.24)");
  drawSoftCircle(context, 1018, 334, 15, "rgba(255, 255, 255, 0.46)");
  drawSoftCircle(context, 980, 580, 8, rgbToRgba(headlineAccent, 0.28));

  const floorY = 1068;
  const floorGradient = context.createLinearGradient(0, floorY - 150, 0, OUTPUT_HEIGHT);
  floorGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
  floorGradient.addColorStop(0.34, "rgba(255, 255, 255, 0.84)");
  floorGradient.addColorStop(1, "rgba(225, 218, 208, 0.92)");
  context.fillStyle = floorGradient;
  context.fillRect(0, floorY - 150, OUTPUT_WIDTH, OUTPUT_HEIGHT - floorY + 150);

  const floorShine = context.createLinearGradient(0, floorY, OUTPUT_WIDTH, floorY);
  floorShine.addColorStop(0, "rgba(255, 255, 255, 0)");
  floorShine.addColorStop(0.5, rgbToRgba(headlineAccent, 0.26));
  floorShine.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.strokeStyle = floorShine;
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(42, floorY);
  context.quadraticCurveTo(OUTPUT_WIDTH / 2, floorY - 18, OUTPUT_WIDTH - 42, floorY);
  context.stroke();
}

function drawDecorations(context: CanvasRenderingContext2D, palette: Palette) {
  const headlineAccent = pickHeadlineAccent(palette);
  const supportAccent = pickSupportAccent(palette, headlineAccent);

  context.save();
  context.strokeStyle = rgbToRgba(headlineAccent, 0.28);
  context.lineWidth = 5;
  context.beginPath();
  context.ellipse(520, 760, 320, 430, -0.24, Math.PI * 1.12, Math.PI * 1.92);
  context.stroke();

  context.strokeStyle = "rgba(255, 255, 255, 0.72)";
  context.lineWidth = 3;
  context.beginPath();
  context.ellipse(604, 760, 420, 385, 0.64, Math.PI * 0.92, Math.PI * 1.88);
  context.stroke();

  context.strokeStyle = rgbToRgba(headlineAccent, 0.2);
  context.beginPath();
  context.ellipse(562, 768, 396, 478, 0.2, Math.PI * 1.08, Math.PI * 1.72);
  context.stroke();
  context.restore();

  drawPennant(context, 176, 418, 122, 36, supportAccent, 1);
  drawPennant(context, 262, 386, 112, 30, headlineAccent, 1);
  drawPennant(context, 904, 420, 122, 36, supportAccent, -1);
  drawPennant(context, 816, 386, 112, 30, headlineAccent, -1);

  context.save();
  drawSpark(context, 130, 300, 24, headlineAccent);
  drawSpark(context, 996, 226, 16, headlineAccent);
  drawSpark(context, 470, 410, 12, supportAccent);
  context.restore();
}

function drawHeadline(context: CanvasRenderingContext2D, text: string, palette: Palette) {
  const lines = createHeadlineLines(text);
  const headlineAccent = pickHeadlineAccent(palette);
  const startY = lines.length === 1 ? 230 : lines.length === 2 ? 180 : 150;
  const lineGap = lines.length === 1 ? 0 : lines.length === 2 ? 148 : 116;

  lines.forEach((line, index) => {
    const maxWidth = index === 0 ? 900 : 760;
    const startSize = lines.length > 2 ? 132 : index === 0 ? 178 : 166;
    const minSize = lines.length > 2 ? 58 : 70;
    const fontSize = fitText(context, line, maxWidth, startSize, minSize);
    const y = startY + index * lineGap;
    drawStyledHeadlineLine(context, line, OUTPUT_WIDTH / 2, y, fontSize, index, palette, headlineAccent);
  });
}

function drawStyledHeadlineLine(
  context: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  fontSize: number,
  lineIndex: number,
  palette: Palette,
  headlineAccent: Rgb,
) {
  context.save();
  context.font = `900 ${fontSize}px Arial, Helvetica, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";

  context.shadowColor = "rgba(5, 10, 18, 0.36)";
  context.shadowBlur = 22;
  context.shadowOffsetY = 18;
  context.strokeStyle = rgbToRgba(palette.dark, 0.98);
  context.lineWidth = Math.max(16, fontSize * 0.24);
  context.strokeText(line, x + 7, y + 13);

  context.shadowColor = "transparent";
  context.strokeStyle = "rgba(255, 249, 226, 0.95)";
  context.lineWidth = Math.max(10, fontSize * 0.14);
  context.strokeText(line, x, y);

  context.strokeStyle = rgbToRgba(palette.dark, 0.98);
  context.lineWidth = Math.max(9, fontSize * 0.09);
  context.strokeText(line, x, y + 4);

  const fill = context.createLinearGradient(0, y - fontSize / 2, 0, y + fontSize / 2);
  if (lineIndex === 0) {
    fill.addColorStop(0, rgbToCss(mix(headlineAccent, { r: 255, g: 255, b: 255 }, 0.58)));
    fill.addColorStop(0.46, rgbToCss(headlineAccent));
    fill.addColorStop(1, rgbToCss(mix(headlineAccent, palette.dark, 0.26)));
  } else {
    fill.addColorStop(0, "#ffffff");
    fill.addColorStop(0.62, "#f4f1ea");
    fill.addColorStop(1, "#c9c3b7");
  }
  context.fillStyle = fill;
  context.fillText(line, x, y);

  context.globalAlpha = lineIndex === 0 ? 0.24 : 0.34;
  context.fillStyle = "#ffffff";
  context.fillText(line, x - 5, y - Math.max(15, fontSize * 0.17));
  context.restore();
}

function drawProduct(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  analysis: ImageAnalysis,
) {
  const cutout = createProductCutout(image, analysis.crop, 820, 660);
  const productX = (OUTPUT_WIDTH - cutout.width) / 2;
  const productBottom = 1122;
  const productY = productBottom - cutout.height;
  const centerX = productX + cutout.width / 2;

  context.save();
  const shadowGradient = context.createRadialGradient(centerX, productBottom + 16, 20, centerX, productBottom + 16, 310);
  shadowGradient.addColorStop(0, "rgba(12, 18, 28, 0.34)");
  shadowGradient.addColorStop(0.56, "rgba(12, 18, 28, 0.13)");
  shadowGradient.addColorStop(1, "rgba(12, 18, 28, 0)");
  context.fillStyle = shadowGradient;
  context.beginPath();
  context.ellipse(centerX, productBottom + 16, Math.min(310, cutout.width * 0.52), 54, 0, 0, Math.PI * 2);
  context.fill();

  context.shadowColor = "rgba(12, 18, 28, 0.3)";
  context.shadowBlur = 38;
  context.shadowOffsetY = 20;
  context.drawImage(cutout, productX, productY);
  context.restore();

  context.save();
  context.globalAlpha = 0.16;
  context.translate(productX, productBottom + 14);
  context.scale(1, -0.28);
  context.drawImage(cutout, 0, -cutout.height);
  context.restore();

  const reflection = context.createLinearGradient(0, productBottom - 10, 0, productBottom + 150);
  reflection.addColorStop(0, "rgba(255, 255, 255, 0.36)");
  reflection.addColorStop(0.52, "rgba(255, 255, 255, 0.16)");
  reflection.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = reflection;
  context.beginPath();
  context.ellipse(centerX, productBottom + 62, Math.min(290, cutout.width * 0.46), 42, 0, 0, Math.PI * 2);
  context.fill();
}

function drawEmptyProductSlot(context: CanvasRenderingContext2D, palette: Palette) {
  const headlineAccent = pickHeadlineAccent(palette);
  context.save();
  context.strokeStyle = rgbToRgba(headlineAccent, 0.52);
  context.lineWidth = 5;
  context.setLineDash([16, 16]);
  roundRect(context, 292, 610, 496, 360, 38);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = "rgba(255, 255, 255, 0.64)";
  roundRect(context, 326, 646, 428, 288, 30);
  context.fill();
  context.fillStyle = rgbToCss(headlineAccent);
  context.font = "800 36px Arial, Helvetica, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("Productfoto", OUTPUT_WIDTH / 2, 790);
  context.restore();
}

function drawLogo(context: CanvasRenderingContext2D, logo: HTMLImageElement) {
  const size = 164;
  const x = OUTPUT_WIDTH - size - 34;
  const y = OUTPUT_HEIGHT - size - 26;

  context.save();
  context.drawImage(logo, x, y, size, size);
  context.restore();
}

function drawForegroundHighlights(context: CanvasRenderingContext2D, palette: Palette) {
  const headlineAccent = pickHeadlineAccent(palette);
  context.save();
  context.globalAlpha = 0.7;
  drawSpark(context, 826, 1068, 12, headlineAccent);
  drawSpark(context, 738, 1110, 9, { r: 255, g: 255, b: 255 });
  drawSoftCircle(context, 202, 1116, 6, rgbToRgba(headlineAccent, 0.3));
  context.restore();
}

function drawSpark(context: CanvasRenderingContext2D, x: number, y: number, size: number, color: Rgb) {
  context.save();
  context.translate(x, y);
  context.fillStyle = rgbToCss(color);
  context.strokeStyle = "rgba(255, 255, 255, 0.72)";
  context.lineWidth = Math.max(1, size * 0.08);
  context.beginPath();
  context.moveTo(0, -size);
  context.quadraticCurveTo(size * 0.18, -size * 0.18, size, 0);
  context.quadraticCurveTo(size * 0.18, size * 0.18, 0, size);
  context.quadraticCurveTo(-size * 0.18, size * 0.18, -size, 0);
  context.quadraticCurveTo(-size * 0.18, -size * 0.18, 0, -size);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

function drawRibbon(
  context: CanvasRenderingContext2D,
  color: Rgb,
  lineWidth: number,
  alpha: number,
  drawPath: (pathContext: CanvasRenderingContext2D) => void,
) {
  context.save();
  context.globalAlpha = alpha;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = lineWidth;
  context.strokeStyle = rgbToCss(color);
  context.beginPath();
  drawPath(context);
  context.stroke();
  context.restore();
}

function drawPennant(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: Rgb,
  direction: 1 | -1,
) {
  context.save();
  context.translate(x, y);
  context.scale(direction, 1);
  const gradient = context.createLinearGradient(0, -height, width, height);
  gradient.addColorStop(0, rgbToCss(mix(color, { r: 255, g: 255, b: 255 }, 0.34)));
  gradient.addColorStop(1, rgbToCss(mix(color, { r: 0, g: 0, b: 0 }, 0.18)));
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(0, 0);
  context.quadraticCurveTo(width * 0.42, -height * 0.74, width, -height * 0.46);
  context.lineTo(width * 0.68, height * 0.08);
  context.quadraticCurveTo(width * 0.3, height * 0.24, 0, 0);
  context.closePath();
  context.fill();
  context.restore();
}

function drawSoftCircle(context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  context.save();
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function pickHeadlineAccent(palette: Palette): Rgb {
  const candidates = [palette.primary, palette.secondary].map((color) => normalizeDisplayColor(color, 0.42, 0.55));
  return candidates.sort((a, b) => accentScore(b) - accentScore(a))[0] ?? DEFAULT_PALETTE.primary;
}

function pickSupportAccent(palette: Palette, headlineAccent: Rgb): Rgb {
  const candidates = [palette.primary, palette.secondary]
    .map((color) => normalizeDisplayColor(color, 0.38, 0.5))
    .sort((a, b) => colorDistance(b, headlineAccent) - colorDistance(a, headlineAccent));

  return candidates.find((color) => colorDistance(color, headlineAccent) > 28) ??
    normalizeDisplayColor(shiftHue(headlineAccent, 32), 0.38, 0.5);
}

function accentScore(color: Rgb) {
  const hsl = rgbToHsl(color);
  const warmGoldBonus = hsl.h >= 28 && hsl.h <= 64 ? 88 : 0;
  const warmBonus = hsl.h <= 24 || hsl.h >= 340 ? 28 : 0;
  return brightness(color) * 0.68 + hsl.s * 110 + warmGoldBonus + warmBonus;
}

function analyseProductImage(image: HTMLImageElement): ImageAnalysis {
  const sampleWidth = 420;
  const sampleHeight = Math.max(1, Math.round((image.naturalHeight / image.naturalWidth) * sampleWidth));
  const { canvas, context } = createCanvas(sampleWidth, sampleHeight, true);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const background = sampleBorderColor(imageData);
  const smallCrop = detectProductBox(imageData, background);
  const scaleX = image.naturalWidth / canvas.width;
  const scaleY = image.naturalHeight / canvas.height;

  const crop = {
    x: clamp(Math.round(smallCrop.x * scaleX), 0, image.naturalWidth - 1),
    y: clamp(Math.round(smallCrop.y * scaleY), 0, image.naturalHeight - 1),
    width: clamp(Math.round(smallCrop.width * scaleX), 1, image.naturalWidth),
    height: clamp(Math.round(smallCrop.height * scaleY), 1, image.naturalHeight),
  };

  return {
    crop,
    palette: extractPalette(imageData, smallCrop, background),
  };
}

function createProductCutout(
  image: HTMLImageElement,
  crop: Rect,
  maxWidth: number,
  maxHeight: number,
) {
  const scale = Math.min(maxWidth / crop.width, maxHeight / crop.height);
  const width = Math.max(1, Math.round(crop.width * scale));
  const height = Math.max(1, Math.round(crop.height * scale));
  const { canvas, context } = createCanvas(width, height, true);
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);

  const imageData = context.getImageData(0, 0, width, height);
  const background = sampleBorderColor(imageData);
  const bgBrightness = brightness(background);
  const bgSaturation = rgbToHsl(background).s;

  for (let index = 0; index < imageData.data.length; index += 4) {
    const pixel = {
      r: imageData.data[index],
      g: imageData.data[index + 1],
      b: imageData.data[index + 2],
    };
    const distance = colorDistance(pixel, background);
    const contrast = Math.abs(brightness(pixel) - bgBrightness);
    const saturationLift = rgbToHsl(pixel).s - bgSaturation;
    const darkLift = (130 - brightness(pixel)) / 120;
    const confidence = Math.max(
      (distance - 22) / 58,
      (contrast - 18) / 60,
      saturationLift / 0.28,
      darkLift,
    );

    if (confidence < 0.16) {
      imageData.data[index + 3] = 0;
    } else if (confidence < 0.62) {
      imageData.data[index + 3] = Math.round(imageData.data[index + 3] * smoothstep(0.16, 0.62, confidence));
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

function detectProductBox(imageData: ImageData, background: Rgb): Rect {
  const { width, height, data } = imageData;
  const bgBrightness = brightness(background);
  const bgSaturation = rgbToHsl(background).s;
  const mask = new Uint8Array(width * height);
  const rowCounts = new Uint16Array(height);
  let foregroundPixels = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dataIndex = (y * width + x) * 4;
      if (data[dataIndex + 3] < 24) continue;

      const pixel = { r: data[dataIndex], g: data[dataIndex + 1], b: data[dataIndex + 2] };
      const pixelBrightness = brightness(pixel);
      const pixelSaturation = rgbToHsl(pixel).s;
      const distance = colorDistance(pixel, background);
      const isForeground =
        distance > 42 ||
        Math.abs(pixelBrightness - bgBrightness) > 38 ||
        pixelSaturation > Math.max(0.16, bgSaturation + 0.1) ||
        pixelBrightness < 92;

      if (isForeground) {
        mask[y * width + x] = 1;
        rowCounts[y] += 1;
        foregroundPixels += 1;
      }
    }
  }

  if (foregroundPixels < width * height * 0.01) return fallbackCrop(width, height);

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let usedPixels = 0;

  for (let y = Math.floor(height * 0.04); y < Math.floor(height * 0.94); y += 1) {
    if (rowCounts[y] > width * 0.66) continue;

    for (let x = Math.floor(width * 0.04); x < Math.floor(width * 0.96); x += 1) {
      if (!mask[y * width + x]) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      usedPixels += 1;
    }
  }

  if (usedPixels < foregroundPixels * 0.12 || minX >= maxX || minY >= maxY) {
    return fallbackCrop(width, height);
  }

  const boxWidth = maxX - minX + 1;
  const boxHeight = maxY - minY + 1;
  const padding = Math.round(Math.max(boxWidth, boxHeight) * 0.16);

  return {
    x: clamp(minX - padding, 0, width - 1),
    y: clamp(minY - padding, 0, height - 1),
    width: clamp(boxWidth + padding * 2, 1, width),
    height: clamp(boxHeight + padding * 2, 1, height),
  };
}

function extractPalette(imageData: ImageData, crop: Rect, background: Rgb): Palette {
  const { width, height, data } = imageData;
  const startX = Math.max(0, Math.floor(crop.x));
  const startY = Math.max(0, Math.floor(crop.y));
  const endX = Math.min(width, Math.ceil(crop.x + crop.width));
  const endY = Math.min(height, Math.ceil(crop.y + crop.height));
  const buckets = new Map<string, { color: Rgb; score: number; count: number }>();
  let dark = { r: 10, g: 20, b: 35 };
  let darkestScore = -1;

  for (let y = startY; y < endY; y += 3) {
    for (let x = startX; x < endX; x += 3) {
      const index = (y * width + x) * 4;
      if (data[index + 3] < 40) continue;

      const color = { r: data[index], g: data[index + 1], b: data[index + 2] };
      const hsl = rgbToHsl(color);
      const colorBrightness = brightness(color);
      const distance = colorDistance(color, background);

      if (distance < 18 && colorBrightness > 145 && hsl.s < 0.12) continue;
      if (colorBrightness > 238 && hsl.s < 0.1) continue;

      const darkScore = (255 - colorBrightness) + hsl.s * 80;
      if (darkScore > darkestScore && colorBrightness < 120) {
        darkestScore = darkScore;
        dark = color;
      }

      if (hsl.s < 0.18) continue;
      if (colorBrightness < 34 || colorBrightness > 244) continue;

      const bucket = `${Math.round(color.r / 24)}-${Math.round(color.g / 24)}-${Math.round(color.b / 24)}`;
      const centeredLightness = 1 - Math.abs(hsl.l - 0.52);
      const warmAccentLift = hsl.h >= 24 && hsl.h <= 68 ? 0.55 : hsl.h <= 18 || hsl.h >= 342 ? 0.24 : 0;
      const score = Math.max(1, hsl.s * 4 + distance / 120 + centeredLightness * 1.5 + warmAccentLift);
      const current = buckets.get(bucket);
      if (current) {
        current.color = {
          r: (current.color.r * current.count + color.r) / (current.count + 1),
          g: (current.color.g * current.count + color.g) / (current.count + 1),
          b: (current.color.b * current.count + color.b) / (current.count + 1),
        };
        current.score += score;
        current.count += 1;
      } else {
        buckets.set(bucket, { color, score, count: 1 });
      }
    }
  }

  const rankedColors = Array.from(buckets.values())
    .sort((a, b) => b.score - a.score)
    .map((item) => normalizeDisplayColor(item.color));

  const primary = rankedColors[0] ?? DEFAULT_PALETTE.primary;
  const primaryHue = rgbToHsl(primary).h;
  const secondary = rankedColors.find((color) => hueDistance(rgbToHsl(color).h, primaryHue) > 25) ??
    normalizeDisplayColor(shiftHue(primary, 34), 0.38, 0.5);

  return {
    primary,
    secondary,
    dark: normalizeDarkColor(dark),
    light: { r: 246, g: 248, b: 250 },
  };
}

function sampleBorderColor(imageData: ImageData): Rgb {
  const { width, height, data } = imageData;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const isBorder = x < 12 || y < 12 || x > width - 13 || y > height - 13;
      if (!isBorder) continue;
      const index = (y * width + x) * 4;
      if (data[index + 3] < 32) continue;
      r += data[index];
      g += data[index + 1];
      b += data[index + 2];
      count += 1;
    }
  }

  if (!count) return { r: 235, g: 238, b: 240 };
  return { r: r / count, g: g / count, b: b / count };
}

function fallbackCrop(width: number, height: number): Rect {
  const cropWidth = Math.round(width * 0.82);
  const cropHeight = Math.round(height * 0.7);
  return {
    x: Math.round((width - cropWidth) / 2),
    y: Math.round(height * 0.18),
    width: cropWidth,
    height: cropHeight,
  };
}

function createHeadlineLines(text: string) {
  const explicitLines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (explicitLines.length > 0) return explicitLines.slice(0, 3);

  return ["Nieuw product"];
}

function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
) {
  let size = startSize;
  while (size > minSize) {
    context.font = `900 ${size}px Arial, Helvetica, sans-serif`;
    if (context.measureText(text).width <= maxWidth) return size;
    size -= 4;
  }
  return minSize;
}

function createCanvas(width: number, height: number, willReadFrequently = false) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently });
  if (!context) throw new Error("Canvas wordt niet ondersteund in deze browser.");
  return { canvas, context };
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function normalizeDisplayColor(color: Rgb, minSaturation = 0.32, targetLightness = 0.52): Rgb {
  const hsl = rgbToHsl(color);
  return hslToRgb({
    h: hsl.h,
    s: clampNumber(Math.max(hsl.s, minSaturation), 0, 0.92),
    l: clampNumber((hsl.l + targetLightness) / 2, 0.24, 0.68),
  });
}

function normalizeDarkColor(color: Rgb): Rgb {
  const hsl = rgbToHsl(color);
  return hslToRgb({
    h: hsl.h,
    s: clampNumber(hsl.s, 0, 0.54),
    l: clampNumber((hsl.l + 0.16) / 2, 0.08, 0.26),
  });
}

function brightness(color: Rgb) {
  return color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
}

function colorDistance(a: Rgb, b: Rgb) {
  return Math.sqrt(
    (a.r - b.r) ** 2 +
    (a.g - b.g) ** 2 +
    (a.b - b.b) ** 2,
  );
}

function hueDistance(a: number, b: number) {
  const diff = Math.abs(a - b);
  return Math.min(diff, 360 - diff);
}

function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  };
}

function shiftHue(color: Rgb, degrees: number): Rgb {
  const hsl = rgbToHsl(color);
  return hslToRgb({
    ...hsl,
    h: (hsl.h + degrees + 360) % 360,
  });
}

function rgbToCss(color: Rgb) {
  return `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`;
}

function rgbToRgba(color: Rgb, alpha: number) {
  return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${alpha})`;
}

function rgbToHsl(color: Rgb): Hsl {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l: lightness };

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const hue = max === r
    ? ((g - b) / delta + (g < b ? 6 : 0)) * 60
    : max === g
      ? ((b - r) / delta + 2) * 60
      : ((r - g) / delta + 4) * 60;

  return { h: hue, s: saturation, l: lightness };
}

function hslToRgb(color: Hsl): Rgb {
  const hue = color.h / 360;
  const saturation = color.s;
  const lightness = color.l;

  if (saturation === 0) {
    const value = lightness * 255;
    return { r: value, g: value, b: value };
  }

  const q = lightness < 0.5
    ? lightness * (1 + saturation)
    : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;

  return {
    r: hueToRgb(p, q, hue + 1 / 3) * 255,
    g: hueToRgb(p, q, hue) * 255,
    b: hueToRgb(p, q, hue - 1 / 3) * 255,
  };
}

function hueToRgb(p: number, q: number, t: number) {
  let hue = t;
  if (hue < 0) hue += 1;
  if (hue > 1) hue -= 1;
  if (hue < 1 / 6) return p + (q - p) * 6 * hue;
  if (hue < 1 / 2) return q;
  if (hue < 2 / 3) return p + (q - p) * (2 / 3 - hue) * 6;
  return p;
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const x = clampNumber((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function clamp(value: number, min: number, max: number) {
  return Math.round(clampNumber(value, min, max));
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "productfoto";
}
