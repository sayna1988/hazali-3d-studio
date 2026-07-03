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

const OUTPUT_SIZE = 1080;
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
    <Page title="Productfoto" subtitle="Instagram output in 1080 x 1080 met vaste Hazali branding.">
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
            <span><Sparkles size={16} /> Instagram vierkant</span>
            <button type="button" onClick={downloadImage} disabled={isRendering}>
              <Download size={17} />
              Download JPG
            </button>
          </div>

          <div className="product-generator__preview-frame">
            <canvas ref={canvasRef} width={OUTPUT_SIZE} height={OUTPUT_SIZE} />
          </div>

          <div className="product-generator__status" aria-live="polite">
            <span>{hasPendingText ? "Tekst gewijzigd; genereer opnieuw." : message}</span>
            <strong>1080 x 1080</strong>
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
  context.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  drawBackground(context, options.analysis.palette);
  drawHeadline(context, options.text, options.analysis.palette);
  drawDecorations(context, options.analysis.palette);

  if (options.productImage) {
    drawProduct(context, options.productImage, options.analysis);
  } else {
    drawEmptyProductSlot(context, options.analysis.palette);
  }

  drawLogo(context, options.logoImage);
}

function drawBackground(context: CanvasRenderingContext2D, palette: Palette) {
  const gradient = context.createLinearGradient(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  gradient.addColorStop(0, rgbToCss(mix(palette.light, palette.primary, 0.1)));
  gradient.addColorStop(0.52, "#ffffff");
  gradient.addColorStop(1, rgbToCss(mix(palette.light, palette.secondary, 0.13)));
  context.fillStyle = gradient;
  context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  context.save();
  context.globalAlpha = 0.88;
  context.lineCap = "round";
  context.lineWidth = 34;
  context.strokeStyle = rgbToCss(palette.primary);
  context.beginPath();
  context.arc(1020, 920, 360, Math.PI * 1.04, Math.PI * 1.56);
  context.stroke();

  context.globalAlpha = 0.28;
  context.lineWidth = 14;
  context.beginPath();
  context.arc(190, 228, 360, Math.PI * 0.78, Math.PI * 1.3);
  context.stroke();

  context.globalAlpha = 0.3;
  context.strokeStyle = rgbToCss(palette.secondary);
  context.lineWidth = 18;
  context.beginPath();
  context.moveTo(40, 846);
  context.bezierCurveTo(258, 792, 478, 844, 684, 798);
  context.stroke();

  context.globalAlpha = 0.45;
  context.strokeStyle = "rgba(255, 255, 255, 0.92)";
  context.lineWidth = 5;
  context.beginPath();
  context.arc(530, 616, 325, Math.PI * 1.04, Math.PI * 1.92);
  context.stroke();
  context.restore();

  const floorGradient = context.createLinearGradient(0, 740, 0, OUTPUT_SIZE);
  floorGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
  floorGradient.addColorStop(1, "rgba(226, 232, 240, 0.86)");
  context.fillStyle = floorGradient;
  context.fillRect(0, 740, OUTPUT_SIZE, 340);

  context.strokeStyle = "rgba(148, 163, 184, 0.22)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(80, 794);
  context.quadraticCurveTo(540, 776, 1000, 802);
  context.stroke();
}

function drawDecorations(context: CanvasRenderingContext2D, palette: Palette) {
  context.save();
  context.lineCap = "round";
  context.strokeStyle = rgbToCss(palette.primary);
  context.globalAlpha = 0.9;
  context.lineWidth = 17;

  context.beginPath();
  context.moveTo(134, 332);
  context.quadraticCurveTo(186, 356, 244, 368);
  context.stroke();

  context.beginPath();
  context.moveTo(108, 388);
  context.quadraticCurveTo(176, 386, 252, 416);
  context.stroke();

  context.beginPath();
  context.moveTo(862, 324);
  context.quadraticCurveTo(804, 358, 748, 372);
  context.stroke();

  context.beginPath();
  context.moveTo(910, 384);
  context.quadraticCurveTo(828, 384, 758, 418);
  context.stroke();

  context.globalAlpha = 0.66;
  context.lineWidth = 4;
  drawSpark(context, 142, 238, 34, palette.primary);
  drawSpark(context, 944, 172, 24, palette.primary);
  context.restore();
}

function drawHeadline(context: CanvasRenderingContext2D, text: string, palette: Palette) {
  const lines = createHeadlineLines(text);
  const startY = lines.length === 1 ? 178 : 138;
  const lineGap = lines.length === 1 ? 0 : 126;

  lines.forEach((line, index) => {
    const maxWidth = 760;
    const fontSize = fitText(context, line, maxWidth, 152, 68);
    const y = startY + index * lineGap;
    context.font = `900 ${fontSize}px Arial, Helvetica, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineJoin = "round";

    context.save();
    context.shadowColor = "rgba(4, 12, 24, 0.28)";
    context.shadowBlur = 18;
    context.shadowOffsetY = 15;
    context.strokeStyle = "rgba(2, 12, 25, 0.95)";
    context.lineWidth = Math.max(13, fontSize * 0.17);
    context.strokeText(line, OUTPUT_SIZE / 2, y + 8);

    context.shadowColor = "transparent";
    context.strokeStyle = "rgba(255, 255, 255, 0.92)";
    context.lineWidth = Math.max(5, fontSize * 0.06);
    context.strokeText(line, OUTPUT_SIZE / 2, y);

    const fill = context.createLinearGradient(0, y - fontSize / 2, 0, y + fontSize / 2);
    if (index === 0) {
      fill.addColorStop(0, rgbToCss(mix(palette.primary, { r: 255, g: 255, b: 255 }, 0.46)));
      fill.addColorStop(0.52, rgbToCss(palette.primary));
      fill.addColorStop(1, rgbToCss(mix(palette.primary, palette.dark, 0.18)));
    } else {
      fill.addColorStop(0, "#ffffff");
      fill.addColorStop(0.68, "#f6f8fb");
      fill.addColorStop(1, "#cbd5e1");
    }
    context.fillStyle = fill;
    context.fillText(line, OUTPUT_SIZE / 2, y);

    context.globalAlpha = 0.2;
    context.fillStyle = "#ffffff";
    context.fillText(line, OUTPUT_SIZE / 2 - 5, y - Math.max(13, fontSize * 0.15));
    context.restore();
  });
}

function drawProduct(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  analysis: ImageAnalysis,
) {
  const cutout = createProductCutout(image, analysis.crop, 650, 560);
  const productX = (OUTPUT_SIZE - cutout.width) / 2;
  const productY = 850 - cutout.height;
  const centerX = productX + cutout.width / 2;

  context.save();
  const shadowGradient = context.createRadialGradient(centerX, 858, 20, centerX, 858, 250);
  shadowGradient.addColorStop(0, "rgba(15, 23, 42, 0.32)");
  shadowGradient.addColorStop(0.58, "rgba(15, 23, 42, 0.12)");
  shadowGradient.addColorStop(1, "rgba(15, 23, 42, 0)");
  context.fillStyle = shadowGradient;
  context.beginPath();
  context.ellipse(centerX, 858, Math.min(254, cutout.width * 0.48), 44, 0, 0, Math.PI * 2);
  context.fill();

  context.shadowColor = "rgba(15, 23, 42, 0.26)";
  context.shadowBlur = 34;
  context.shadowOffsetY = 18;
  context.drawImage(cutout, productX, productY);
  context.restore();

  const reflection = context.createLinearGradient(0, 850, 0, 990);
  reflection.addColorStop(0, "rgba(255, 255, 255, 0.22)");
  reflection.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = reflection;
  context.beginPath();
  context.ellipse(centerX, 908, Math.min(230, cutout.width * 0.44), 34, 0, 0, Math.PI * 2);
  context.fill();
}

function drawEmptyProductSlot(context: CanvasRenderingContext2D, palette: Palette) {
  context.save();
  context.strokeStyle = rgbToCss(mix(palette.primary, { r: 255, g: 255, b: 255 }, 0.24));
  context.lineWidth = 5;
  context.setLineDash([16, 16]);
  roundRect(context, 322, 484, 436, 310, 34);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = "rgba(255, 255, 255, 0.72)";
  roundRect(context, 352, 514, 376, 250, 26);
  context.fill();
  context.fillStyle = rgbToCss(palette.primary);
  context.font = "800 34px Arial, Helvetica, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("Productfoto", OUTPUT_SIZE / 2, 640);
  context.restore();
}

function drawLogo(context: CanvasRenderingContext2D, logo: HTMLImageElement) {
  const size = 148;
  const x = OUTPUT_SIZE - size - 42;
  const y = OUTPUT_SIZE - size - 34;

  context.save();
  roundRect(context, x, y, size, size, 20);
  context.clip();
  context.drawImage(logo, x, y, size, size);
  context.restore();
}

function drawSpark(context: CanvasRenderingContext2D, x: number, y: number, size: number, color: Rgb) {
  context.save();
  context.strokeStyle = rgbToCss(color);
  context.lineWidth = Math.max(3, size * 0.1);
  context.beginPath();
  context.moveTo(x, y - size);
  context.lineTo(x, y + size);
  context.moveTo(x - size, y);
  context.lineTo(x + size, y);
  context.stroke();
  context.restore();
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

      if (hsl.s < 0.12 && colorBrightness > 120) continue;

      const bucket = `${Math.round(color.r / 24)}-${Math.round(color.g / 24)}-${Math.round(color.b / 24)}`;
      const score = Math.max(1, hsl.s * 3 + distance / 90 + Math.abs(155 - colorBrightness) / 220);
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
    normalizeDisplayColor(mix(DEFAULT_PALETTE.secondary, primary, 0.12));

  return {
    primary,
    secondary,
    dark: normalizeDisplayColor(dark, 0.16, 0.2),
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

function rgbToCss(color: Rgb) {
  return `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`;
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
