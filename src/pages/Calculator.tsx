import "./Calculator.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import {
  ClipboardPaste,
  FileImage,
  Image as ImageIcon,
  LoaderCircle,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import Page from "../components/Page/Page";
import type { SlicingColorInput } from "../types/Calculator";
import type { Filament } from "../types/Filament";
import { loadFilaments } from "../services/FilamentService";
import { filamentColorValue, filamentOptionLabel } from "../utils/filamentColor";
import { totaalGewicht } from "../utils/filamentInventory";
import {
  applyDetectedSlicingColors,
  calculateSlicingColorUsage,
  calculateSlicingTotals,
  createManualSlicingColor,
  parseSlicingResultText,
} from "../utils/slicingResultCalculator";

type OcrProgressMessage = {
  status: string;
  progress: number;
};

type TesseractLike = {
  recognize: (
    image: HTMLCanvasElement | File,
    langs: string,
    options?: {
      logger?: (message: OcrProgressMessage) => void;
    },
  ) => Promise<{
    data: {
      text: string;
    };
  }>;
};

type Rgb = {
  r: number;
  g: number;
  b: number;
};

type Component = {
  area: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  r: number;
  g: number;
  b: number;
};

const INITIAL_ROWS: SlicingColorInput[] = [createManualSlicingColor(0)];

export default function Calculator() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<SlicingColorInput[]>(INITIAL_ROWS);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [rawText, setRawText] = useState("");
  const [status, setStatus] = useState("Plak een slicer-screenshot of upload een afbeelding.");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [filamentVoorraad, setFilamentVoorraad] = useState<Filament[]>([]);
  const [filamentsLoading, setFilamentsLoading] = useState(true);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  useEffect(() => {
    let cancelled = false;

    async function loadInventory() {
      setFilamentsLoading(true);
      try {
        const filaments = await loadFilaments();
        if (!cancelled) setFilamentVoorraad(filaments);
      } catch (error) {
        if (!cancelled) setStatus(error instanceof Error ? error.message : "Filamentvoorraad laden is mislukt.");
      } finally {
        if (!cancelled) setFilamentsLoading(false);
      }
    }

    void loadInventory();

    return () => {
      cancelled = true;
    };
  }, []);

  const readScreenshot = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setStatus("Kies een JPG, PNG of WebP screenshot.");
      return;
    }

    setIsReading(true);
    setOcrProgress(0);
    setWarnings([]);
    setImageName(file.name || "Geplakte screenshot");
    setImageUrl((previousUrl) => {
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      return URL.createObjectURL(file);
    });

    try {
      setStatus("Screenshot voorbereiden...");
      const [detectedColors, ocrCanvas] = await Promise.all([
        detectSlicingSwatches(file),
        createOcrCanvas(file),
      ]);

      setStatus("OCR leest de gramwaarden...");
      const text = await recognizeImageText(ocrCanvas, (message) => {
        if (message.status) setStatus(`OCR: ${message.status}`);
        setOcrProgress(Math.round((message.progress || 0) * 100));
      });
      const result = parseSlicingResultText(text);
      const parsedRows = result.colors.length > 0
        ? applyDetectedSlicingColors(result.colors, detectedColors)
        : rows;

      setRawText(text.trim());
      setRows(parsedRows);
      setWarnings(result.warnings);
      setStatus(result.colors.length > 0
        ? `${result.colors.length} kleur${result.colors.length === 1 ? "" : "en"} uit screenshot gehaald.`
        : "OCR klaar, maar er zijn geen gramregels gevonden.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Screenshot uitlezen is mislukt.");
    } finally {
      setIsReading(false);
    }
  }, [rows]);

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const file = getImageFileFromItems(event.clipboardData?.items);
      if (!file) return;

      event.preventDefault();
      void readScreenshot(file);
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [readScreenshot]);

  const usages = useMemo(() => rows.map(calculateSlicingColorUsage), [rows]);
  const totals = useMemo(() => calculateSlicingTotals(rows), [rows]);

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void readScreenshot(file);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void readScreenshot(file);
  }

  function parseRawText() {
    const result = parseSlicingResultText(rawText);
    if (result.colors.length > 0) setRows(result.colors);
    setWarnings(result.warnings);
    setStatus(result.colors.length > 0
      ? `${result.colors.length} kleur${result.colors.length === 1 ? "" : "en"} uit OCR-tekst gehaald.`
      : "Geen gramregels in deze tekst gevonden.");
  }

  function addRow() {
    setRows((current) => [...current, createManualSlicingColor(current.length)]);
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function resetRows() {
    setRows([createManualSlicingColor(0)]);
    setRawText("");
    setWarnings([]);
    setStatus("Calculator leeggemaakt.");
  }

  function updateRow(id: string, patch: Partial<SlicingColorInput>) {
    setRows((current) => current.map((row) =>
      row.id === id
        ? {
            ...row,
            ...patch,
            source: row.source,
          }
        : row,
    ));
  }

  function linkFilament(rowId: string, filamentId: string) {
    const filament = filamentVoorraad.find((item) => String(item.id) === filamentId);
    if (!filament) {
      updateRow(rowId, {
        filamentId: undefined,
        filamentNaam: undefined,
        filamentPrijsPerKg: undefined,
      });
      return;
    }

    updateRow(rowId, {
      filamentId: filament.id,
      filamentNaam: filamentOptionLabel(filament),
      filamentPrijsPerKg: filament.prijsPerKg,
      color: filamentColorValue(filament.kleur),
    });
  }

  return (
    <Page title="Slicer calculator" subtitle="Plak een slicing-result screenshot en corrigeer de gramwaarden per kleur.">
      <div className="slicer-calculator">
        <section className="slicer-calculator__input-panel" aria-label="Screenshot invoer">
          <button
            type="button"
            className={`slicer-calculator__dropzone${isDragging ? " is-dragging" : ""}`}
            onClick={() => fileInputRef.current?.click()}
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
            <span>{isReading ? <LoaderCircle size={24} className="slicer-calculator__spin" /> : <ClipboardPaste size={24} />}</span>
            <strong>{imageName || "Plak of upload screenshot"}</strong>
            <small>Ctrl+V, sleep een afbeelding hierheen of tik om te uploaden</small>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileInput}
          />

          {imageUrl ? (
            <div className="slicer-calculator__preview">
              <img src={imageUrl} alt="Geuploade slicer screenshot" />
            </div>
          ) : (
            <div className="slicer-calculator__empty-preview">
              <ImageIcon size={28} />
              <span>Geen screenshot geladen</span>
            </div>
          )}

          <div className="slicer-calculator__status" aria-live="polite">
            <span>{status}</span>
            {isReading && <strong>{ocrProgress}%</strong>}
          </div>
        </section>

        <section className="slicer-calculator__summary" aria-label="Totalen">
          <div className="slicer-calculator__summary-card">
            <span><Sparkles size={16} /> Kleuren</span>
            <strong>{totals.colors}</strong>
          </div>
          <div className="slicer-calculator__summary-card">
            <span>Printgram</span>
            <strong>{formatGram(totals.printGram)} g</strong>
            <small>Model + support</small>
          </div>
          <div className="slicer-calculator__summary-card">
            <span>Purged</span>
            <strong>{formatGram(totals.purgedGram)} g</strong>
          </div>
          <div className="slicer-calculator__summary-card">
            <span>Tower</span>
            <strong>{formatGram(totals.towerGram)} g</strong>
          </div>
          <div className="slicer-calculator__summary-card is-total">
            <span>Totaal filament</span>
            <strong>{formatGram(totals.totalGram)} g</strong>
          </div>
          <div className="slicer-calculator__summary-card is-cost">
            <span>Materiaalkosten</span>
            <strong>{formatEuro(totals.materialCost)}</strong>
            <small>Print {formatEuro(totals.printCost)} - afval {formatEuro(totals.wasteCost)}</small>
          </div>
        </section>

        {warnings.length > 0 && (
          <div className="slicer-calculator__warnings" role="status">
            {warnings.map((warning) => <span key={warning}>{warning}</span>)}
          </div>
        )}

        <section className="slicer-calculator__table-panel" aria-label="Kleurcalculator">
          <div className="slicer-calculator__panel-header">
            <span><FileImage size={16} /> Kleuren en grams</span>
            <div>
              <button type="button" onClick={addRow}><Plus size={16} /> Kleur</button>
              <button type="button" onClick={resetRows}><RotateCcw size={16} /> Reset</button>
            </div>
          </div>

          <div className="slicer-calculator__rows">
            {usages.map((row) => (
              <article className="slicer-calculator__row" key={row.id}>
                <div className="slicer-calculator__color-fields">
                  <input
                    type="color"
                    value={row.color}
                    aria-label={`Kleur ${row.label} kiezen`}
                    onChange={(event) => updateRow(row.id, { color: event.target.value })}
                  />
                  <label>
                    <span>Kleur</span>
                    <input
                      value={row.label}
                      onChange={(event) => updateRow(row.id, { label: event.target.value })}
                      placeholder="Kleur"
                    />
                  </label>
                </div>

                <label className="slicer-calculator__filament-field">
                  <span>Filament</span>
                  <select
                    value={row.filamentId ?? ""}
                    onChange={(event) => linkFilament(row.id, event.target.value)}
                    disabled={filamentsLoading || filamentVoorraad.length === 0}
                  >
                    <option value="">{filamentsLoading ? "Filamenten laden..." : "Niet gekoppeld"}</option>
                    {filamentVoorraad.map((filament) => (
                      <option key={filament.id} value={filament.id}>
                        {filamentOptionLabel(filament)} - {formatEuro(filament.prijsPerKg)}/kg
                      </option>
                    ))}
                  </select>
                  {row.filamentId ? (
                    <small>
                      {formatEuro(row.filamentPrijsPerKg ?? 0)}/kg - {formatGram(totaalGewicht(filamentVoorraad.find((item) => item.id === row.filamentId) ?? {
                        naam: "",
                        merk: "",
                        kleur: row.color,
                        type: "",
                        prijsPerKg: row.filamentPrijsPerKg ?? 0,
                        voorraadGram: 0,
                      }))} g op voorraad
                    </small>
                  ) : <small>Kies een voorraad-filament voor prijsberekening</small>}
                </label>

                <NumberField label="Model g" value={row.modelGram} onChange={(value) => updateRow(row.id, { modelGram: value })} />
                <NumberField label="Support g" value={row.supportGram} onChange={(value) => updateRow(row.id, { supportGram: value })} />
                <NumberField label="Purged g" value={row.purgedGram} onChange={(value) => updateRow(row.id, { purgedGram: value })} />
                <NumberField label="Tower g" value={row.towerGram} onChange={(value) => updateRow(row.id, { towerGram: value })} />

                <div className="slicer-calculator__computed">
                  <span>Totaal</span>
                  <strong>{formatGram(row.totalGram)} g</strong>
                  <small>Print {formatGram(row.printGram)} g - {formatEuro(row.materialCost)}</small>
                </div>

                <button
                  type="button"
                  className="slicer-calculator__delete"
                  aria-label={`Kleur ${row.label} verwijderen`}
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1}
                >
                  <Trash2 size={17} />
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="slicer-calculator__ocr-panel" aria-label="OCR tekst">
          <div className="slicer-calculator__panel-header">
            <span><Upload size={16} /> OCR tekst</span>
            <button type="button" onClick={parseRawText} disabled={!rawText.trim()}>Lees tekst opnieuw</button>
          </div>
          <textarea
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            rows={7}
            placeholder="OCR tekst verschijnt hier. Je kunt deze corrigeren en opnieuw laten uitlezen."
          />
        </section>
      </div>
    </Page>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="slicer-calculator__number-field">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(Number(event.target.value || 0))}
      />
    </label>
  );
}

async function recognizeImageText(
  image: HTMLCanvasElement,
  onProgress: (message: OcrProgressMessage) => void,
) {
  const module = await import("tesseract.js") as unknown as TesseractLike | { default: TesseractLike };
  const tesseract = "default" in module ? module.default : module;
  const result = await tesseract.recognize(image, "eng", { logger: onProgress });
  return result.data.text;
}

function getImageFileFromItems(items: DataTransferItemList | undefined) {
  if (!items) return null;
  const imageItem = Array.from(items).find((item) => item.type.startsWith("image/"));
  return imageItem?.getAsFile() ?? null;
}

async function createOcrCanvas(file: File) {
  const image = await loadImageFromFile(file);
  const scale = Math.min(3, Math.max(2, 940 / image.naturalWidth));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = getCanvasContext(canvas);

  context.imageSmoothingEnabled = true;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const average = averageLuminance(imageData);
  const darkBackground = average < 128;

  for (let index = 0; index < imageData.data.length; index += 4) {
    const luminance = getLuminance({
      r: imageData.data[index] ?? 0,
      g: imageData.data[index + 1] ?? 0,
      b: imageData.data[index + 2] ?? 0,
    });
    const isTextPixel = darkBackground ? luminance > 108 : luminance < 148;
    const value = isTextPixel ? 0 : 255;
    imageData.data[index] = value;
    imageData.data[index + 1] = value;
    imageData.data[index + 2] = value;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

async function detectSlicingSwatches(file: File) {
  const image = await loadImageFromFile(file);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = getCanvasContext(canvas);
  context.drawImage(image, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const components = findSwatchComponents(imageData);
  return components
    .sort((a, b) => a.minY - b.minY)
    .filter((component, index, all) => index === 0 || Math.abs(component.minY - all[index - 1]!.minY) > 12)
    .map((component) => rgbToHex({
      r: component.r / component.area,
      g: component.g / component.area,
      b: component.b / component.area,
    }));
}

function findSwatchComponents(imageData: ImageData) {
  const { width, height, data } = imageData;
  const mask = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const startX = Math.max(4, Math.floor(width * 0.015));
  const endX = Math.min(width, Math.max(52, Math.floor(width * 0.16)));
  const startY = Math.floor(height * 0.2);
  const endY = Math.floor(height * 0.72);

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const index = (y * width + x) * 4;
      const color = {
        r: data[index] ?? 0,
        g: data[index + 1] ?? 0,
        b: data[index + 2] ?? 0,
      };
      if (isPossibleSwatchPixel(color)) mask[y * width + x] = 1;
    }
  }

  const components: Component[] = [];
  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const pointIndex = y * width + x;
      if (!mask[pointIndex] || visited[pointIndex]) continue;
      const component = collectComponent(mask, visited, imageData, x, y, startX, endX, startY, endY);
      const componentWidth = component.maxX - component.minX + 1;
      const componentHeight = component.maxY - component.minY + 1;
      const aspect = componentWidth / componentHeight;

      if (
        component.area >= 12 &&
        component.area <= 260 &&
        componentWidth >= 4 &&
        componentWidth <= 22 &&
        componentHeight >= 4 &&
        componentHeight <= 22 &&
        aspect >= 0.45 &&
        aspect <= 2.2
      ) {
        components.push(component);
      }
    }
  }

  return components;
}

function collectComponent(
  mask: Uint8Array,
  visited: Uint8Array,
  imageData: ImageData,
  startX: number,
  startY: number,
  minSearchX: number,
  maxSearchX: number,
  minSearchY: number,
  maxSearchY: number,
) {
  const { width, data } = imageData;
  const stack: Array<[number, number]> = [[startX, startY]];
  const component: Component = {
    area: 0,
    minX: startX,
    maxX: startX,
    minY: startY,
    maxY: startY,
    r: 0,
    g: 0,
    b: 0,
  };

  while (stack.length > 0) {
    const point = stack.pop();
    if (!point) continue;
    const [x, y] = point;
    if (x < minSearchX || x >= maxSearchX || y < minSearchY || y >= maxSearchY) continue;

    const pointIndex = y * width + x;
    if (!mask[pointIndex] || visited[pointIndex]) continue;
    visited[pointIndex] = 1;

    const dataIndex = pointIndex * 4;
    component.area += 1;
    component.minX = Math.min(component.minX, x);
    component.maxX = Math.max(component.maxX, x);
    component.minY = Math.min(component.minY, y);
    component.maxY = Math.max(component.maxY, y);
    component.r += data[dataIndex] ?? 0;
    component.g += data[dataIndex + 1] ?? 0;
    component.b += data[dataIndex + 2] ?? 0;

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return component;
}

function isPossibleSwatchPixel(color: Rgb) {
  const luminance = getLuminance(color);
  const saturation = getSaturation(color);
  const chromatic = saturation > 0.22 && luminance > 35 && luminance < 245;
  const neutral = saturation <= 0.22 && luminance >= 44 && luminance <= 150;
  return chromatic || neutral;
}

function averageLuminance(imageData: ImageData) {
  let sum = 0;
  let count = 0;

  for (let index = 0; index < imageData.data.length; index += 16) {
    sum += getLuminance({
      r: imageData.data[index] ?? 0,
      g: imageData.data[index + 1] ?? 0,
      b: imageData.data[index + 2] ?? 0,
    });
    count += 1;
  }

  return count === 0 ? 0 : sum / count;
}

function getLuminance(color: Rgb) {
  return color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
}

function getSaturation(color: Rgb) {
  const max = Math.max(color.r, color.g, color.b) / 255;
  const min = Math.min(color.r, color.g, color.b) / 255;
  if (max === min) return 0;
  const lightness = (max + min) / 2;
  const delta = max - min;
  return lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
}

function rgbToHex(color: Rgb) {
  const toHex = (value: number) => Math.round(Math.max(0, Math.min(255, value)))
    .toString(16)
    .padStart(2, "0");

  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

function getCanvasContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas wordt niet ondersteund in deze browser.");
  return context;
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Afbeelding kon niet worden geladen."));
    };
    image.src = url;
  });
}

function formatGram(value: number) {
  return value.toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatEuro(value: number) {
  return value.toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
  });
}
