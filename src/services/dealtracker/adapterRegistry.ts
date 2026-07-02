import type { JsonValue } from "../../types/Dealtracker.ts";
import { JoybuyAdapter } from "./adapters/JoybuyAdapter.ts";
import type { RetailerAdapter } from "./adapterTypes.ts";

export type RuntimeRetailer = {
  id: string;
  name: string;
  domain: string;
  active: boolean;
  adapterKey: string;
  config: Record<string, JsonValue>;
  requestDelayMs: number;
  requestTimeoutMs: number;
  maxConcurrency: number;
};

function stringConfig(config: Record<string, JsonValue>, key: string) {
  const value = config[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function createRetailerAdapter(retailer: RuntimeRetailer): RetailerAdapter | null {
  if (retailer.adapterKey === "joybuy-nl" || retailer.domain === "www.joybuy.nl" || retailer.domain === "joybuy.nl") {
    return new JoybuyAdapter({
      feedUrl: stringConfig(retailer.config, "feedUrl"),
      feedText: stringConfig(retailer.config, "feedText"),
    });
  }

  return null;
}
