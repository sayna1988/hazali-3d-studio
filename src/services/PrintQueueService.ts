import { supabase } from "../lib/supabase";

export type PrintQueueItem = {
  id: string;
  url: string;
  status: "loading" | "ready" | "error";
  title?: string;
  image?: string;
  printTimeSeconds?: number;
  error?: string;
  completed: boolean;
};

export async function loadPrintQueue(userId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("print_queue")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Array.isArray(data?.data) ? data.data as PrintQueueItem[] : [];
}

export async function savePrintQueue(userId: string, items: PrintQueueItem[]) {
  if (!supabase) return;
  const { error } = await supabase.from("print_queue").upsert({
    user_id: userId,
    data: items,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
