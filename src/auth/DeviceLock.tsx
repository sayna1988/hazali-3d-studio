import { useEffect, useState } from "react";
import { Fingerprint, KeyRound, LockKeyhole } from "lucide-react";
import { getAppIconPath, getStoredAppIconVariant } from "../utils/appIcon";

interface Props {
  userId: string;
  signOut: () => Promise<void>;
  children: React.ReactNode;
}

type PinRecord = { salt: string; hash: string };

function bytesToBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

async function pinHash(pin: string, salt: string) {
  const bytes = new TextEncoder().encode(`${salt}:${pin}`);
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}

function readPinRecord(key: string): PinRecord | null {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as PinRecord : null;
  } catch {
    return null;
  }
}

export function DeviceLock({ userId, signOut, children }: Props) {
  const logoSrc = getAppIconPath(getStoredAppIconVariant(), 192);
  const pinKey = `hazali-pin:${userId}`;
  const faceKey = `hazali-passkey:${userId}`;
  const unlockKey = `hazali-unlocked:${userId}`;
  const [hasPin, setHasPin] = useState(() => Boolean(readPinRecord(pinKey)));
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(unlockKey) === "1");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [faceAvailable, setFaceAvailable] = useState(false);
  const [hasFace, setHasFace] = useState(() => Boolean(localStorage.getItem(faceKey)));

  useEffect(() => {
    if (!("PublicKeyCredential" in window)) return;
    void PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      .then(setFaceAvailable)
      .catch(() => setFaceAvailable(false));
  }, []);

  function unlock() {
    sessionStorage.setItem(unlockKey, "1");
    setUnlocked(true);
  }

  async function setupPin(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(pin)) return setMessage("Kies precies 6 cijfers.");
    if (pin !== pinConfirm) return setMessage("De pincodes zijn niet hetzelfde.");
    setBusy(true);
    const salt = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(16)));
    localStorage.setItem(pinKey, JSON.stringify({ salt, hash: await pinHash(pin, salt) } satisfies PinRecord));
    setHasPin(true);
    setPin("");
    setPinConfirm("");
    setMessage("Pincode opgeslagen. Ontgrendel je studio om verder te gaan.");
    setBusy(false);
  }

  async function verifyPin(event: React.FormEvent) {
    event.preventDefault();
    const record = readPinRecord(pinKey);
    if (!record) { setHasPin(false); return; }
    setBusy(true);
    if (await pinHash(pin, record.salt) === record.hash) unlock();
    else setMessage("Onjuiste pincode.");
    setPin("");
    setBusy(false);
  }

  async function handleFaceId() {
    setBusy(true);
    setMessage("");
    try {
      const savedId = localStorage.getItem(faceKey);
      if (savedId) {
        const credential = await navigator.credentials.get({ publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ id: base64UrlToBytes(savedId), type: "public-key" }],
          userVerification: "required",
          timeout: 60000
        } });
        if (credential) unlock();
      } else {
        const credential = await navigator.credentials.create({ publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: "Hazali 3D Studio" },
          user: { id: new TextEncoder().encode(userId), name: "Hazali eigenaar", displayName: "Hazali eigenaar" },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
          authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "preferred", userVerification: "required" },
          attestation: "none",
          timeout: 60000
        } }) as PublicKeyCredential | null;
        if (credential) {
          localStorage.setItem(faceKey, bytesToBase64Url(new Uint8Array(credential.rawId)));
          setHasFace(true);
          unlock();
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") setMessage("Face ID is geannuleerd of niet beschikbaar.");
      else setMessage("Face ID kon niet worden ingesteld. Gebruik je pincode.");
    } finally {
      setBusy(false);
    }
  }

  async function resetDevice() {
    localStorage.removeItem(pinKey);
    localStorage.removeItem(faceKey);
    sessionStorage.removeItem(unlockKey);
    await signOut();
  }

  if (unlocked) return <>{children}</>;

  return (
    <main className="auth-page">
      <section className="auth-card device-lock-card">
        <img src={logoSrc} alt="Hazali" />
        <span><LockKeyhole size={13} /> Privéstudio</span>
        <h1>{hasPin ? "Ontgrendel je studio" : "Beveilig dit apparaat"}</h1>
        <p>{hasPin ? "Gebruik je 6-cijferige pincode of Face ID." : "Stel één keer een lokale pincode in. Deze wordt alleen versleuteld op dit apparaat bewaard."}</p>
        {!hasPin ? (
          <form onSubmit={setupPin}>
            <label htmlFor="new-device-pin">Nieuwe 6-cijferige pincode</label>
            <input id="new-device-pin" className="auth-code device-pin" type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} minLength={6} maxLength={6} required autoFocus />
            <label htmlFor="confirm-device-pin">Herhaal pincode</label>
            <input id="confirm-device-pin" className="auth-code device-pin" type="password" inputMode="numeric" autoComplete="new-password" value={pinConfirm} onChange={(event) => setPinConfirm(event.target.value.replace(/\D/g, "").slice(0, 6))} minLength={6} maxLength={6} required />
            <button disabled={busy || pin.length !== 6 || pinConfirm.length !== 6}><KeyRound size={17} /> Pincode opslaan</button>
          </form>
        ) : (
          <>
            <form onSubmit={verifyPin}>
              <label htmlFor="device-pin">Pincode</label>
              <input id="device-pin" className="auth-code device-pin" type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} minLength={6} maxLength={6} required autoFocus />
              <button disabled={busy || pin.length !== 6}><KeyRound size={17} /> Ontgrendelen</button>
            </form>
            {faceAvailable && <button className="face-id-button" type="button" disabled={busy} onClick={() => void handleFaceId()}><Fingerprint size={20} /> {hasFace ? "Ontgrendel met Face ID" : "Face ID instellen"}</button>}
          </>
        )}
        {message && <div className="auth-message">{message}</div>}
        <button className="device-reset" type="button" disabled={busy} onClick={() => void resetDevice()}>PIN vergeten? Opnieuw inloggen via e-mail</button>
      </section>
    </main>
  );
}
