import { db } from "../database/db";
import { supabase } from "../lib/supabase";
import type { SettingsModel } from "../types/Settings";
import {
  announceAppIconVariant,
  getAppIconPath,
  normalizeAppIconVariant,
  setFavicon,
  storeAppIconVariant,
} from "../utils/appIcon";
import {
  announceAppThemeVariant,
  applyAppThemeVariant,
  normalizeAppThemeVariant,
  storeAppThemeVariant,
} from "../utils/appTheme";

function cloudData(settings: SettingsModel) {
  return Object.fromEntries(
    Object.entries(settings).filter(([key]) => !["id", "syncPending"].includes(key)),
  ) as Omit<SettingsModel, "id" | "syncPending">;
}

async function currentUserId() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function applySettingsIcon(settings: Partial<SettingsModel>) {
  if (!settings.appIconVariant) return;
  const variant = normalizeAppIconVariant(settings.appIconVariant);
  storeAppIconVariant(variant);
  setFavicon(getAppIconPath(variant));
  announceAppIconVariant(variant);
}

function applySettingsTheme(settings: Partial<SettingsModel>) {
  if (!settings.appThemeVariant) return;
  const variant = normalizeAppThemeVariant(settings.appThemeVariant);
  storeAppThemeVariant(variant);
  applyAppThemeVariant(variant);
  announceAppThemeVariant(variant);
}

export async function syncSettings() {
  const userId = await currentUserId();
  if (!supabase || !userId) return;

  const local = await db.settings.get(1);
  const { data: remote, error } = await supabase
    .from("app_settings")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;

  if (local && (!remote || local.syncPending)) {
    const result = await supabase.from("app_settings").upsert({
      user_id: userId,
      data: cloudData(local),
      updated_at: new Date().toISOString(),
    });
    if (result.error) throw result.error;
    await db.settings.update(1, { syncPending: false });
    applySettingsIcon(local);
    applySettingsTheme(local);
    return;
  }

  if (remote?.data) {
    const remoteSettings = { ...remote.data, id: 1, syncPending: false } as SettingsModel;
    await db.settings.put(remoteSettings);
    applySettingsIcon(remoteSettings);
    applySettingsTheme(remoteSettings);
  }
}

export async function saveSettings(settings: SettingsModel) {
  await db.settings.put({ ...settings, id: 1, syncPending: true });
  applySettingsIcon(settings);
  applySettingsTheme(settings);
  try { await syncSettings(); } catch (error) { console.warn("Instellingensync uitgesteld:", error); }
}
