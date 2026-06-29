export type AlertEmailInput = {
  to: string;
  subject: string;
  productName: string;
  currentPrice: string;
  pricePerKg: string;
  shippingCost: string;
  totalWeight: string;
  retailerName: string;
  offerUrl: string;
  reason: string;
  manageUrl: string;
};

export type AlertEmailResult = {
  status: "sent" | "skipped" | "failed";
  error?: string;
};

function htmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderAlertEmail(input: AlertEmailInput) {
  const buttonStyle = "display:inline-block;padding:12px 18px;border-radius:10px;background:#159cff;color:#ffffff;text-decoration:none;font-weight:700";
  return {
    subject: input.subject,
    html: `
      <h2>Je Hazali-prijsalarm is afgegaan</h2>
      <p><strong>${htmlEscape(input.productName)}</strong> voldoet nu aan je voorwaarden.</p>
      <ul>
        <li>Huidige prijs: ${htmlEscape(input.currentPrice)}</li>
        <li>Prijs per kilogram: ${htmlEscape(input.pricePerKg)}</li>
        <li>Verzendkosten: ${htmlEscape(input.shippingCost)}</li>
        <li>Totaalgewicht: ${htmlEscape(input.totalWeight)}</li>
        <li>Webwinkel: ${htmlEscape(input.retailerName)}</li>
      </ul>
      <p>Reden: ${htmlEscape(input.reason)}</p>
      <p><a href="${htmlEscape(input.offerUrl)}" style="${buttonStyle}">Bekijk aanbieding</a></p>
      <p><a href="${htmlEscape(input.manageUrl)}">Prijsalarm beheren of uitschakelen</a></p>
    `,
    text: [
      "Je Hazali-prijsalarm is afgegaan",
      "",
      `${input.productName} voldoet nu aan je voorwaarden.`,
      `Huidige prijs: ${input.currentPrice}`,
      `Prijs per kilogram: ${input.pricePerKg}`,
      `Verzendkosten: ${input.shippingCost}`,
      `Totaalgewicht: ${input.totalWeight}`,
      `Webwinkel: ${input.retailerName}`,
      `Reden: ${input.reason}`,
      `Bekijk aanbieding: ${input.offerUrl}`,
      `Beheren of uitschakelen: ${input.manageUrl}`,
    ].join("\n"),
  };
}

export async function sendAlertEmail(input: AlertEmailInput): Promise<AlertEmailResult> {
  const mode = process.env.DEALTRACKER_EMAIL_MODE || "log";
  const testRecipient = process.env.DEALTRACKER_TEST_EMAIL_TO;
  const to = testRecipient || input.to;
  const rendered = renderAlertEmail({ ...input, to });

  if (mode === "off") return { status: "skipped" };
  if (mode === "log" || process.env.NODE_ENV !== "production") {
    console.info(JSON.stringify({
      level: "info",
      message: "dealtracker_alert_email_log",
      to,
      subject: rendered.subject,
    }));
    return { status: "skipped" };
  }

  if (mode !== "resend") return { status: "failed", error: `Onbekende e-mailmodus: ${mode}.` };
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DEALTRACKER_EMAIL_FROM;
  if (!apiKey || !from) return { status: "failed", error: "RESEND_API_KEY of DEALTRACKER_EMAIL_FROM ontbreekt." };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    }),
  });

  if (!response.ok) return { status: "failed", error: `Resend HTTP ${response.status}.` };
  return { status: "sent" };
}
