import type { JsonValue } from "../../types/Dealtracker.ts";
import type { AdapterLogger } from "./adapterTypes.ts";

const SECRET_KEY_PATTERN = /secret|token|key|password|cookie|authorization/i;

function redact(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      SECRET_KEY_PATTERN.test(key) ? "[redacted]" : redact(nested),
    ]),
  );
}

function write(level: "info" | "warn" | "error", message: string, fields: Record<string, JsonValue> = {}) {
  const entry = {
    level,
    message,
    ...redact(fields) as Record<string, JsonValue>,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function createStructuredLogger(baseFields: Record<string, JsonValue> = {}): AdapterLogger {
  return {
    info: (message, fields = {}) => write("info", message, { ...baseFields, ...fields }),
    warn: (message, fields = {}) => write("warn", message, { ...baseFields, ...fields }),
    error: (message, fields = {}) => write("error", message, { ...baseFields, ...fields }),
  };
}

export function createSilentLogger(): AdapterLogger {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}
