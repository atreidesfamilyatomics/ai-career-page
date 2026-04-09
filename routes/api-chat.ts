import type { Context } from "hono";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Replace YOUR_HANDLE with your actual Zo Space handle (e.g. "janedoe")
const ALLOWED_ORIGINS = [
  "https://YOUR_HANDLE.zo.space",
  "http://localhost:3099",
];

// Your Zo Persona ID — Settings → AI → Personas → copy the ID
// The persona's system prompt acts as your AI's "brain". Set it up there.
const PERSONA_ID = "YOUR_PERSONA_ID";

// Model to use. Options:
//   - A named model: "claude-haiku-4-5" (cost-effective, fast)
//   - A BYOK provider ID from Settings → AI → Providers (e.g. "byok:abc123...")
const MODEL = "claude-haiku-4-5";

const MAX_INPUT = 2000;
const MIN_INPUT = 2;
const LIMIT_CHAT_PER_24H = 15;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const ZO_API_URL = "https://api.zo.computer/zo/ask";
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
  if (rec.n >= LIMIT_CHAT_PER_24H) return false;
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

// Abuse patterns: deflect jailbreaks and off-topic requests.
// Customize the last pattern with YOUR name/company/role keywords so legitimate
// career questions aren't caught by the general "explain" catch-all.
const ABUSE_PATTERNS = [
  /ignore (previous|above|all|prior|your) (instructions|rules|prompt)/i,
  /you are now/i,
  /act as/i,
  /pretend (to be|you're|you are)/i,
  /new persona/i,
  /system prompt/i,
  /reveal your (instructions|prompt|rules)/i,
  /jailbreak/i,
  /do anything now/i,
  /write (me )?(a |some )?(code|script|program|essay|poem|story|song)/i,
  /translate (this|the following)/i,
  /what is the (capital|population|meaning|answer)/i,
  /solve (this|the following)/i,
  // ↓ Customize: add your name, company, role keywords to the exception list
  /explain (how|what|why) (?!.*(YOUR_NAME_KEYWORDS|YOUR_COMPANY_KEYWORDS|YOUR_ROLE_KEYWORDS))/i,
];

function isAbusive(input: string): boolean {
  return ABUSE_PATTERNS.some((p) => p.test(input));
}

// Customize this with your name
const REFUSAL = "I'm here specifically to answer questions about [YOUR NAME]'s career and background. What would you like to know about their experience?";

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export default async (c: Context) => {
  if (c.req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(c) });
  if (c.req.method !== "POST") return c.json({ error: "Method not allowed" }, 405);
  if (!allowed(c)) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...cors(c) },
    });
  }

  const addr = ip(c);
  if (!rateOk(addr)) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: { "Content-Type": "application/json", ...cors(c) },
    });
  }

  // ZO_CLIENT_IDENTITY_TOKEN is automatically available in all Zo Space routes.
  // No setup required — it's injected by the platform.
  const zoToken = process.env.ZO_CLIENT_IDENTITY_TOKEN;
  if (!zoToken) return c.json({ error: "Missing ZO_CLIENT_IDENTITY_TOKEN" }, 500);

  try {
    const { input } = await c.req.json();
    if (!input || typeof input !== "string") return c.json({ error: "Input required" }, 400);
    const trimmed = input.trim().slice(0, MAX_INPUT);
    if (trimmed.length < MIN_INPUT) return c.json({ error: "Input required" }, 400);

    if (isAbusive(trimmed)) {
      return new Response(sse("text_delta", { delta: REFUSAL }) + sse("done", { ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          ...cors(c),
        },
      });
    }

    const zoRes = await fetch(ZO_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: zoToken,
      },
      body: JSON.stringify({
        model_name: MODEL,
        persona_id: PERSONA_ID,
        input: trimmed,
      }),
    });

    if (!zoRes.ok) {
      const text = await zoRes.text().catch(() => "");
      console.error("Zo API chat error:", text || zoRes.statusText);
      const status = zoRes.status === 429 ? 429 : zoRes.status >= 500 ? 503 : 502;
      return c.json(
        { error: zoRes.status === 429 ? "rate_limited" : "upstream_unavailable", status: zoRes.status },
        status,
        { ...cors(c) }
      );
    }

    const zoData = await zoRes.json();
    const reply = typeof zoData.output === "string" ? zoData.output : "";

    // Return as a single SSE delta to maintain frontend SSE compatibility
    return new Response(
      sse("text_delta", { delta: reply }) + sse("done", { ok: true }),
      {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          ...cors(c),
        },
      }
    );
  } catch (err) {
    console.error("Chat proxy error:", err);
    return c.json({ error: "Something went wrong" }, 500);
  }
};
