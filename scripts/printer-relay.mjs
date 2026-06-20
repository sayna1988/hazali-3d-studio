const sourceUrl = process.env.PRINTER_STATUS_URL;
const destinationUrl = process.env.HAZALI_PRINTER_API_URL;
const token = process.env.HAZALI_PRINTER_TOKEN;
const intervalMs = Math.max(1000, Number(process.env.PRINTER_POLL_INTERVAL_MS || 2000));
let lastMessage = "";
let lastLogAt = 0;

if (!sourceUrl || !destinationUrl || !token) {
  console.error("Vereist: PRINTER_STATUS_URL, HAZALI_PRINTER_API_URL en HAZALI_PRINTER_TOKEN.");
  process.exit(1);
}

async function relay() {
  try {
    const source = await fetch(sourceUrl, { headers: { Accept: "application/json" } });
    if (!source.ok) throw new Error(`printerbridge HTTP ${source.status}`);
    const status = await source.json();
    const destination = await fetch(destinationUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(status),
    });
    if (!destination.ok) throw new Error(`Hazali API HTTP ${destination.status}`);
    if (lastMessage !== "status bijgewerkt") console.log(`${new Date().toISOString()} status bijgewerkt`);
    lastMessage = "status bijgewerkt";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message !== lastMessage || Date.now() - lastLogAt >= 60_000) {
      console.error(`${new Date().toISOString()} ${message}`);
      lastLogAt = Date.now();
    }
    lastMessage = message;
  }
}

await relay();
setInterval(relay, intervalMs);
