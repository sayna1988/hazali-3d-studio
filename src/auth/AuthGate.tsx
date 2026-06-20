import { useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { useAuth } from "./AuthProvider";
import "./AuthGate.css";

const OTP_LENGTH = 8;

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading, syncError } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
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
        email: email.trim(),
        options: { shouldCreateUser: true }
      });
      if (error) setMessage(error.message);
      else {
        setCodeSent(true);
        setMessage(`Vul de ${OTP_LENGTH}-cijferige code uit de e-mail hieronder in.`);
      }
      setSending(false);
    }

    async function verifyCode(event: React.FormEvent) {
      event.preventDefault();
      setSending(true);
      setMessage("");
      const { error } = await supabase!.auth.verifyOtp({ email: email.trim(), token: code, type: "email" });
      if (error) {
        setMessage(error.message);
        setSending(false);
      }
      // Bij succes verwerkt AuthProvider de nieuwe sessie en verdwijnt dit scherm.
    }

    return (
      <main className="auth-page">
        <section className="auth-card">
          <img src="/logo.png" alt="Hazali" />
          <span>Cloud sync</span>
          <h1>Log in bij je studio</h1>
          <p>Gebruik op desktop en mobiel hetzelfde e-mailadres. Je krijgt een veilige inlogcode zonder wachtwoord.</p>
          {!codeSent ? (
            <form onSubmit={login}>
              <label htmlFor="auth-email">E-mailadres</label>
              <input id="auth-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="jij@voorbeeld.nl" />
              <button disabled={sending}>{sending ? "Code versturen…" : "Stuur inlogcode"}</button>
            </form>
          ) : (
            <form onSubmit={verifyCode}>
              <label htmlFor="auth-code">Inlogcode voor {email}</label>
              <input id="auth-code" className="auth-code" type="text" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))} required minLength={OTP_LENGTH} maxLength={OTP_LENGTH} inputMode="numeric" autoComplete="one-time-code" pattern={`[0-9]{${OTP_LENGTH}}`} placeholder="00000000" autoFocus />
              <button disabled={sending || code.length !== OTP_LENGTH}>{sending ? "Controleren…" : "Log in"}</button>
              <button className="auth-secondary" type="button" disabled={sending} onClick={() => { setCodeSent(false); setCode(""); setMessage(""); }}>Ander e-mailadres</button>
            </form>
          )}
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
