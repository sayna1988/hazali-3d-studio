/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { syncPrints } from "../services/PrintSyncService";

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

    async function applySession(nextSession: Session | null) {
      if (!active) return;
      setLoading(true);
      setSession(nextSession);
      setSyncError(null);
      if (nextSession) {
        try {
          await syncPrints();
        } catch (error) {
          setSyncError(error instanceof Error ? error.message : "Synchroniseren is mislukt.");
        }
      }
      if (active) setLoading(false);
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession);
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
