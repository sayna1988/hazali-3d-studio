import type { JsonValue } from "../../types/Dealtracker.ts";
import type { AdapterHttpClient, AdapterHttpRequestOptions } from "./adapterTypes.ts";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type DealHttpClientOptions = {
  timeoutMs?: number;
  retries?: number;
  retryBaseDelayMs?: number;
  rateLimitMs?: number;
  maxResponseBytes?: number;
  userAgent?: string;
  fetchFn?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
};

const DEFAULT_USER_AGENT = "HazaliDealtracker/1.0 (+https://hazali.nl; respectful price monitoring)";
const DEFAULT_ACCEPTED_TYPES = ["application/json", "text/json", "text/html", "application/xhtml+xml"];

let nextAllowedRequestAt = 0;

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 10
    || a === 127
    || a === 0
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168);
}

export function validatePublicHttpUrl(value: string): URL {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("URL protocol is niet toegestaan.");
  if (url.username || url.password) throw new Error("URL mag geen credentials bevatten.");

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost"
    || hostname.endsWith(".localhost")
    || hostname === "[::1]"
    || hostname === "::1"
    || hostname.startsWith("fc")
    || hostname.startsWith("fd")
    || hostname.startsWith("fe80:")
    || isPrivateIpv4(hostname)
  ) {
    throw new Error("Interne of lokale URL is niet toegestaan.");
  }

  return url;
}

function acceptsContentType(actual: string, accepted: string[]) {
  if (!actual) return false;
  const normalized = actual.split(";")[0]?.trim().toLowerCase() ?? "";
  return accepted.some((item) => normalized === item.toLowerCase());
}

function retryableStatus(status: number) {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

export function createDealHttpClient(options: DealHttpClientOptions = {}): AdapterHttpClient {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const retries = options.retries ?? 2;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? 250;
  const rateLimitMs = options.rateLimitMs ?? 0;
  const maxResponseBytes = options.maxResponseBytes ?? 1_000_000;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const fetchFn = options.fetchFn ?? fetch;
  const sleep = options.sleep ?? defaultSleep;

  async function waitForRateLimit() {
    if (rateLimitMs <= 0) return;
    const now = Date.now();
    const waitMs = Math.max(0, nextAllowedRequestAt - now);
    nextAllowedRequestAt = Math.max(now, nextAllowedRequestAt) + rateLimitMs;
    if (waitMs > 0) await sleep(waitMs);
  }

  async function fetchText(urlValue: string, requestOptions: AdapterHttpRequestOptions = {}) {
    const url = validatePublicHttpUrl(urlValue);
    const acceptedContentTypes = requestOptions.acceptedContentTypes ?? DEFAULT_ACCEPTED_TYPES;
    const limit = requestOptions.maxResponseBytes ?? maxResponseBytes;
    const requestTimeoutMs = requestOptions.timeoutMs ?? timeoutMs;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      if (attempt > 0) await sleep(retryBaseDelayMs * (2 ** (attempt - 1)));
      await waitForRateLimit();

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
      try {
        const response = await fetchFn(url.href, {
          headers: {
            Accept: acceptedContentTypes.join(", "),
            "User-Agent": userAgent,
          },
          redirect: "follow",
          signal: controller.signal,
        });

        const contentType = response.headers.get("content-type") ?? "";
        if (!acceptsContentType(contentType, acceptedContentTypes)) {
          throw new Error(`Onverwacht content-type: ${contentType || "onbekend"}.`);
        }

        const contentLength = Number(response.headers.get("content-length") ?? 0);
        if (contentLength > limit) throw new Error("Response is groter dan toegestaan.");

        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}.`);
          if (attempt < retries && retryableStatus(response.status)) {
            lastError = error;
            continue;
          }
          throw error;
        }

        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > limit) throw new Error("Response is groter dan toegestaan.");
        return new TextDecoder().decode(buffer);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("HTTP request mislukt.");
        if (attempt >= retries) throw lastError;
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new Error("HTTP request mislukt.");
  }

  async function fetchJson(url: string, requestOptions: AdapterHttpRequestOptions = {}): Promise<JsonValue> {
    const text = await fetchText(url, {
      ...requestOptions,
      acceptedContentTypes: requestOptions.acceptedContentTypes ?? ["application/json", "text/json"],
    });
    return JSON.parse(text) as JsonValue;
  }

  return { fetchText, fetchJson };
}
