import logger from "@calcom/lib/logger";

const log = logger.getSubLogger({ prefix: ["[arubaInvoice]"] });

const AUTH_URL = "https://auth.fatturazioneelettronica.aruba.it";
const WS_URL   = "https://ws.fatturazioneelettronica.aruba.it";

async function getToken(): Promise<string> {
  const username = process.env['ARUBA_USERNAME'] ?? "";
  const password = process.env['ARUBA_PASSWORD'] ?? "";
  const body = `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

  const res = await fetch(`${AUTH_URL}/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Aruba auth failed: ${res.status} — ${detail}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

export async function sendInvoiceToAruba(xml: string): Promise<string> {
  const token = await getToken();
  const dataFile = Buffer.from(xml, "utf-8").toString("base64");

  const res = await fetch(`${WS_URL}/services/invoice/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dataFile, skipExtraSchema: false }),
  });

  const result = await res.json();
  if (result.errorCode !== "0000") {
    throw new Error(`Aruba upload error ${result.errorCode}: ${result.errorDescription}`);
  }

  log.info(`Invoice sent to Aruba: ${result.uploadFileName}`);
  return result.uploadFileName as string;
}
