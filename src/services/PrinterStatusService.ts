import { supabase } from "../lib/supabase";

export type PrinterStatus = {
  state?: string;
  job?: { name?: string; progress?: number; elapsedSeconds?: number; remainingSeconds?: number };
  temperatures?: { nozzle?: number; nozzleTarget?: number; bed?: number; bedTarget?: number; chamber?: number };
  speed?: { percentage?: number; profile?: string };
  filament?: { type?: string; color?: string; remainingPercent?: number };
  device?: { model?: string; serial?: string; firmware?: string; wifiSignal?: number; ip?: string };
};

export type CloudPrinterStatus = { data: PrinterStatus; received_at: string };

export async function getPrinterStatus(userId: string) {
  const result = await supabase!.from("printer_status").select("data,received_at").eq("user_id", userId).maybeSingle();
  if (result.error) throw result.error;
  return result.data as CloudPrinterStatus | null;
}
