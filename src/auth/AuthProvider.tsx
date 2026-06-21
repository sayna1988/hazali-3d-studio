/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { syncPrints } from "../services/PrintSyncService";
import { syncFilaments } from "../services/FilamentSyncService";

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

    async function synchronize() {
      try {
        await Promise.all([syncPrints(), syncFilaments()]);
      } catch (error) {
        if (active) {
          setSyncError(error instanceof Error ? error.message : "Synchroniseren is mislukt.");
        }
      }
    }

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
