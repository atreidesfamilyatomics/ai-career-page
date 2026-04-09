import type { Context } from "hono";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Replace YOUR_HANDLE with your actual Zo Space handle
const ALLOWED_ORIGINS = [
  "https://YOUR_HANDLE.zo.space",
  "http://localhost:3099",
];

// Model to use. Options:
//   - A named model: "claude-haiku-4-5" (cost-effective, fast)
//   - A BYOK provider ID from Settings → AI → Providers (e.g. "byok:abc123...")
const MODEL = "claude-haiku-4-5";

const MAX_JD = 10000;
const MIN_JD = 80;
const LIMIT = 2; // fit assessments per IP per 24h — increase if you trust your audience
const WINDOW_MS = 24 * 60 * 60 * 1000;
const ZO_API_URL = "https://api.zo.computer/zo/ask";

// ─── CANDIDATE PROFILE ───────────────────────────────────────────────────────
// Condensed version of your background that the fit assessment reads.
// Cover: years of experience, key achievements with metrics, skill tiers,
// target role types, strong fits, poor fits, and compensation range.
//
// Keep it focused and specific — this drives the match/gap analysis.
// The more specific your poor fits are, the more honest the scoring will be.

const CANDIDATE_PROFILE = `[YOUR NAME] is a [YOUR TITLE] with [X]+ years [ONE-LINE DESCRIPTION].

[KEY ACHIEVEMENT 1 with company, metric, and outcome.]
[KEY ACHIEVEMENT 2.]
Currently targeting [TARGET ROLE TYPES] at [TARGET COMPANY TYPES].

Expert skills: [Skill areas you'd claim as expert-level].
Strong skills: [Skill areas you'd claim as strong].
Tools: [Key tools and platforms].

Strong fits: [Company stage, e.g. Series A–C]. [Role type, e.g. roles working with engineering/product]. [Location, e.g. remote-first or hybrid Boston]. [Culture type]. [Industry type].
Poor fits: [Clear dealbreaker 1, e.g. pre-revenue or pre-product]. [Clear dealbreaker 2, e.g. quota-bearing AE roles]. [Clear dealbreaker 3, e.g. on-site outside Boston]. [Clear dealbreaker 4].

Target compensation: [Range, e.g. $90K–$160K base depending on role, stage, and equity]. Flag as a gap only if the posted range is clearly below [YOUR FLOOR].`;

// ─── SYSTEM PROMPT ───────────────────────────────────────────────────────────
// Instructions for the scoring model. The JSON schema here is strict —
// don't change the shape without also updating the validateResult function below.

const SYSTEM_PROMPT = `You are evaluating job fit for [YOUR NAME].

Background and preferences:
${CANDIDATE_PROFILE}

Return ONLY valid JSON with exactly this shape:
{
  "score": number,
  "scoreLabel": "Strong Match" | "Good Match" | "Partial Match" | "Poor Match",
  "scoreColor": "green" | "yellow" | "orange" | "red",
  "matches": [
    { "point": "short label", "detail": "one sentence explanation" },
    { "point": "short label", "detail": "one sentence explanation" },
    { "point": "short label", "detail": "one sentence explanation" }
  ],
  "gaps": [
    { "point": "short label", "detail": "one sentence explanation" },
    { "point": "short label", "detail": "one sentence explanation" }
  ],
  "recommendation": "one direct sentence on whether to pursue this",
  "goodToKnow": "one honest observation or caveat"
}

Hard requirements:
- score must be a number from 1 to 10
- matches must contain exactly 3 items
- gaps must contain exactly 2 items
- do not include any extra keys
- do not use markdown or code fences

Scoring guide:
- 8-10: Strong Match
- 6-7: Good Match
- 4-5: Partial Match
- 1-3: Poor Match

Be honest and specific. Reference actual experience from the candidate's background.
No markdown. No code fences. No extra commentary.`;
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

// Signals that indicate a real job posting (vs. test input or abuse)
const JOB_SIGNALS = [
  /responsibilit/i, /qualificat/i, /requirement/i, /experience/i,
  /salary|compensation|pay range|OTE/i, /role|position/i,
  /team|report(s|ing) to/i, /skills/i, /years of/i,
  /full.time|part.time|contract|remote|hybrid|on.site/i,
  /apply|candidate/i, /hiring|recruit/i,
  /manager|director|engineer|analyst|lead|senior|junior|vp|head of/i,
  /bachelor|master|degree|MBA/i, /benefits|equity|stock/i,
  /about (the|our) (company|team|role)/i, /job description/i,
  /we are (looking|seeking|hiring)/i, /you will|you'll/i,
  /what you'll do|what we're looking for/i,
];

function looksLikeJobPosting(text: string): boolean {
  if (text.toLowerCase().length < MIN_JD) return false;
  let matches = 0;
  for (const sig of JOB_SIGNALS) {
    if (sig.test(text)) matches++;
  }
  return matches >= 3;
}

function validateResult(result: any) {
  if (!result || typeof result !== "object") return false;
  if (typeof result.score !== "number") return false;
  if (result.score < 1 || result.score > 10) return false;
  if (!Array.isArray(result.matches) || result.matches.length !== 3) return false;
  if (!Array.isArray(result.gaps) || result.gaps.length !== 2) return false;
  if (typeof result.recommendation !== "string" || typeof result.goodToKnow !== "string") return false;
  if (!["Strong Match", "Good Match", "Partial Match", "Poor Match"].includes(result.scoreLabel)) return false;
  if (!["green", "yellow", "orange", "red"].includes(result.scoreColor)) return false;
  if (!result.matches.every((item: any) => item && typeof item.point === "string" && typeof item.detail === "string")) return false;
  if (!result.gaps.every((item: any) => item && typeof item.point === "string" && typeof item.detail === "string")) return false;
  return true;
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

  // ZO_CLIENT_IDENTITY_TOKEN is automatically available in all Zo Space routes.
  // No setup required — it's injected by the platform.
  const zoToken = process.env.ZO_CLIENT_IDENTITY_TOKEN;
  if (!zoToken) return c.json({ error: "Missing ZO_CLIENT_IDENTITY_TOKEN" }, 500);

  // Parse and validate body BEFORE consuming rate limit quota
  let jobDescription: string;
  try {
    const body = await c.req.json();
    jobDescription = body?.jobDescription;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...cors(c) },
    });
  }

  if (!jobDescription || typeof jobDescription !== "string") {
    return new Response(JSON.stringify({ error: "Please provide a job description." }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...cors(c) },
    });
  }

  const jd = jobDescription.trim().slice(0, MAX_JD);
  if (!looksLikeJobPosting(jd)) {
    return new Response(
      JSON.stringify({ error: "That doesn't look like a job posting. Paste the full job description — title, responsibilities, requirements — and I'll analyze the fit." }),
      { status: 422, headers: { "Content-Type": "application/json", ...cors(c) } }
    );
  }

  // Only consume rate limit after we know the input is valid
  const addr = ip(c);
  if (!rateOk(addr)) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: { "Content-Type": "application/json", ...cors(c) },
    });
  }

  try {
    const zoRes = await fetch(ZO_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: zoToken,
      },
      body: JSON.stringify({
        model_name: MODEL,
        input: `CANDIDATE PROFILE:\n${CANDIDATE_PROFILE}\n\nJOB DESCRIPTION TO EVALUATE:\n${jd}`,
        system: SYSTEM_PROMPT,
        output_format: {
          type: "object",
          properties: {
            score: { type: "number" },
            scoreLabel: { type: "string", enum: ["Strong Match", "Good Match", "Partial Match", "Poor Match"] },
            scoreColor: { type: "string", enum: ["green", "yellow", "orange", "red"] },
            matches: {
              type: "array",
              items: {
                type: "object",
                properties: { point: { type: "string" }, detail: { type: "string" } },
                required: ["point", "detail"],
              },
            },
            gaps: {
              type: "array",
              items: {
                type: "object",
                properties: { point: { type: "string" }, detail: { type: "string" } },
                required: ["point", "detail"],
              },
            },
            recommendation: { type: "string" },
            goodToKnow: { type: "string" },
          },
          required: ["score", "scoreLabel", "scoreColor", "matches", "gaps", "recommendation", "goodToKnow"],
        },
      }),
    });

    if (!zoRes.ok) {
      const text = await zoRes.text().catch(() => "");
      console.error("Zo API assess-fit error:", text || zoRes.statusText);
      const status = zoRes.status === 429 ? 429 : zoRes.status >= 500 ? 503 : 502;
      return c.json(
        { error: zoRes.status === 429 ? "rate_limited" : "upstream_unavailable", status: zoRes.status },
        status,
        { ...cors(c) }
      );
    }

    const zoData = await zoRes.json();

    // When output_format is used, zoData.output is already a parsed object
    let result: any = typeof zoData.output === "object" && zoData.output !== null
      ? zoData.output
      : (() => {
          const raw = typeof zoData.output === "string" ? zoData.output : "";
          const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
          try { return JSON.parse(cleaned); } catch { return null; }
        })();

    if (!result) {
      console.error("Invalid JSON from Zo API assess-fit output:", zoData.output);
      return c.json({ error: "Assessment service returned an invalid response" }, 502, { ...cors(c) });
    }

    const normalizedScore = Math.max(1, Math.min(10, Math.round(result.score / 10)));
    result = {
      ...result,
      score: result.score > 10 ? normalizedScore : result.score,
      matches: Array.isArray(result.matches) ? result.matches.slice(0, 3) : result.matches,
      gaps: Array.isArray(result.gaps) ? result.gaps.slice(0, 2) : result.gaps,
    };

    if (!validateResult(result)) {
      console.error("Assess-fit response failed validation:", result);
      return c.json({ error: "Assessment service returned an invalid response" }, 502, { ...cors(c) });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...cors(c) },
    });
  } catch (err: any) {
    console.error("Fit assessment error:", err);
    return c.json({ error: "Something went wrong. Please try again." }, 500);
  }
};
