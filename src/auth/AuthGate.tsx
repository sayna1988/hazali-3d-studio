import { useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { useAuth } from "./AuthProvider";
import "./AuthGate.css";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading, syncError } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  if (!isSupabaseConfigured) {
    return <AuthShell title="Supabase nog niet geconfigureerd" text="Voeg VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY toe aan de Environment Variables van Vercel en deploy opnieuw." />;
  }

  if (loading) return <AuthShell title="Je studio synchroniseren…" text="Lokale en online prints worden samengevoegd." />;

  if (!session) {
    async function login(event: React.FormEvent) {
      event.preventDefault();
      setSending(true);
      setMessage("");
      const { error } = await supabase!.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin }
      });
      setMessage(error ? error.message : "Controleer je e-mail en open de inloglink.");
      setSending(false);
    }

    return (
      <main className="auth-page">
        <section className="auth-card">
          <img src="/logo.png" alt="Hazali" />
          <span>Cloud sync</span>
          <h1>Log in bij je studio</h1>
          <p>Gebruik op desktop en mobiel hetzelfde e-mailadres. Je krijgt een veilige inloglink zonder wachtwoord.</p>
          <form onSubmit={login}>
            <label htmlFor="auth-email">E-mailadres</label>
            <input id="auth-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="jij@voorbeeld.nl" />
            <button disabled={sending}>{sending ? "Link versturen…" : "Stuur inloglink"}</button>
          </form>
          {message && <div className="auth-message">{message}</div>}
        </section>
      </main>
    );
  }

  return <>{syncError && <div className="sync-warning">Cloudsync: {syncError}</div>}{children}</>;
}

function AuthShell({ title, text }: { title: string; text: string }) {
  return <main className="auth-page"><section className="auth-card"><img src="/logo.png" alt="Hazali" /><h1>{title}</h1><p>{text}</p></section></main>;
}
