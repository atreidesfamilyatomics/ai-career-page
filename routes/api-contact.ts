import type { Context } from "hono";
import { appendFile } from "node:fs/promises";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Replace YOUR_HANDLE with your Zo Space handle
const ALLOWED_ORIGINS = [
  "https://YOUR_HANDLE.zo.space",
  "http://localhost:3099",
];

// Path where lead submissions are stored (one JSON object per line)
const LEADS_PATH = "/home/workspace/leads.jsonl";

// Max contact form submissions per IP per 24h
const LIMIT = 3;
const WINDOW_MS = 24 * 60 * 60 * 1000;
// ─────────────────────────────────────────────────────────────────────────────

const hits = new Map<string, { n: number; reset: number }>();

function ip(c: Context) {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "unknown";
}

function allowed(c: Context) {
  const o = c.req.header("origin") || "";
  const r = c.req.header("referer") || "";
  return ALLOWED_ORIGINS.some((a) => o.startsWith(a) || r.startsWith(a));
}

function rateOk(addr: string): boolean {
  const now = Date.now();
  const rec = hits.get(addr);
  if (!rec || now > rec.reset) {
    hits.set(addr, { n: 1, reset: now + WINDOW_MS });
    return true;
  }
  if (rec.n >= LIMIT) return false;
  rec.n++;
  return true;
}

function cors(c: Context) {
  const o = c.req.header("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(o) ? o : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Optional: SMS notification via Zo when a lead submits the form.
// This uses the ZO_CLIENT_IDENTITY_TOKEN which is automatically available in Zo Space routes.
// Remove this function entirely if you don't want notifications.
async function notifyViaZo(entry: { name: string; email: string; phone: string }) {
  const token = process.env.ZO_CLIENT_IDENTITY_TOKEN;
  if (!token) return;
  const msg = `Career page lead: ${entry.name} (${entry.email}${entry.phone ? ", " + entry.phone : ""}). Reach out soon.`;
  try {
    await fetch("https://api.zo.computer/zo/ask", {
      method: "POST",
      headers: { authorization: token, "content-type": "application/json" },
      body: JSON.stringify({ input: `Send me a text message with exactly this content, nothing else: "${msg}"` }),
    });
  } catch (err) {
    console.error("Notification failed:", err);
  }
}

export default async (c: Context) => {
  if (c.req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(c) });
  if (c.req.method !== "POST") return c.json({ error: "Method not allowed" }, 405);
  if (!allowed(c)) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { "Content-Type": "application/json", ...cors(c) } });
  if (!rateOk(ip(c))) return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { "Content-Type": "application/json", ...cors(c) } });

  try {
    const body = await c.req.json();
    const { name, email, phone, company } = body;

    // Honeypot: "company" is a hidden field in the form. Real users never see or fill it.
    // Bots autofill all fields. If company has a value, it's spam — silently accept without saving.
    if (company) {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json", ...cors(c) } });
    }

    if (!name || typeof name !== "string" || name.trim().length < 1) return c.json({ error: "Name is required" }, 400);
    if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) return c.json({ error: "Valid email is required" }, 400);

    const entry = {
      name: name.trim().slice(0, 200),
      email: email.trim().slice(0, 200),
      phone: phone ? String(phone).trim().slice(0, 30) : "",
      ip: ip(c),
      timestamp: new Date().toISOString(),
    };

    console.log("NEW LEAD:", JSON.stringify(entry));
    await appendFile(LEADS_PATH, JSON.stringify(entry) + "\n");

    // Fire-and-forget — don't block the response on notification delivery
    notifyViaZo(entry);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json", ...cors(c) } });
  } catch (err: any) {
    console.error("Contact error:", err);
    return c.json({ error: "Something went wrong" }, 500);
  }
};
