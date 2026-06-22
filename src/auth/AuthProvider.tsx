/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { syncPrints } from "../services/PrintSyncService";
import { syncFilaments } from "../services/FilamentSyncService";
import { syncInventory } from "../services/InventorySyncService";
import { syncSettings } from "../services/SettingsSyncService";

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  syncError: string | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    let syncTimer: number | undefined;
    let synchronizing = false;
    let syncAgain = false;

    async function synchronize() {
      if (synchronizing) {
        syncAgain = true;
        return;
      }
      synchronizing = true;
      try {
        // Prints eerst, zodat inventarisitems hun printCloudId op elk apparaat
        // aan de juiste lokale print kunnen koppelen.
        await Promise.all([syncPrints(), syncFilaments()]);
        await Promise.all([syncInventory(), syncSettings()]);
        if (active) {
          setSyncError(null);
          window.dispatchEvent(new Event("hazali:prints-synced"));
          window.dispatchEvent(new Event("hazali:inventory-synced"));
          window.dispatchEvent(new Event("hazali:settings-synced"));
          window.dispatchEvent(new Event("hazali:data-synced"));
        }
      } catch (error) {
        if (active) {
          setSyncError(error instanceof Error ? error.message : "Synchroniseren is mislukt.");
        }
      } finally {
        synchronizing = false;
        if (syncAgain && active) {
          syncAgain = false;
          void synchronize();
        }
      }
    }

    function scheduleSync() {
      window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(() => void synchronize(), 250);
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") scheduleSync();
    }

    window.addEventListener("online", scheduleSync);
    window.addEventListener("focus", scheduleSync);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) scheduleSync();
    }, 30_000);

    const printChannel = supabase
      .channel("print-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "prints" }, scheduleSync)
      .subscribe();

    const inventoryChannel = supabase
      .channel("inventory-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, scheduleSync)
      .subscribe();

    const filamentChannel = supabase
      .channel("filament-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "filaments" }, scheduleSync)
      .subscribe();

    const settingsChannel = supabase
      .channel("settings-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, scheduleSync)
      .subscribe();

    function applySession(nextSession: Session | null) {
      if (!active) return;
      setSession(nextSession);
      setSyncError(null);
      setLoading(false);

      // Supabase waarschuwt ervoor om geen andere auth/database-aanroepen af te
      // wachten binnen onAuthStateChange. Start de synchronisatie daarom los.
      if (nextSession) void synchronize();
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    // Lees de bewaarde sessie bij iedere app-start expliciet terug. Hierdoor is
    // de app niet afhankelijk van de timing van het INITIAL_SESSION-event.
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setSyncError(error.message);
        setLoading(false);
        return;
      }
      applySession(data.session);
    });

    return () => {
      active = false;
      window.clearTimeout(syncTimer);
      window.clearInterval(poll);
      window.removeEventListener("online", scheduleSync);
      window.removeEventListener("focus", scheduleSync);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void supabase?.removeChannel(printChannel);
      void supabase?.removeChannel(inventoryChannel);
      void supabase?.removeChannel(filamentChannel);
      void supabase?.removeChannel(settingsChannel);
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    loading,
    syncError,
    signOut: async () => { await supabase?.auth.signOut(); }
  }), [session, loading, syncError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth moet binnen AuthProvider worden gebruikt");
  return value;
}
