# Deployment Guide — Zo Computer

This walks you through deploying your AI career page from scratch. Estimated time: 1–2 hours, mostly spent filling out your brain document.

---

## Prerequisites

1. **Zo Computer account** — [Sign up here](https://zo-computer.cello.so/axSBMOdRd0Z) (free tier works)
2. **Anthropic API key** — [Get one here](https://console.anthropic.com). Save it for Step 3.

---

## Step 1 — Fill out your brain document

Open `brain-template.md` and fill in every section. Spend time here. The quality of your brain document directly determines the quality of every AI response.

**The sections that matter most:**
- **Section 1 (Quick Pitch)** — This is what Claude leads with. Make it specific: years of experience, one headline achievement, target role.
- **Section 7 (Pre-Answered FAQs)** — Write out honest answers to the hard questions (why you left, biggest weakness, tenure gaps). Claude will use these verbatim.
- **Section 8 (Fit Rubric)** — Define your strong fits and poor fits explicitly. This is what makes the fit assessment score honestly instead of generically. Don't skip it.

When you're done, save your brain document to your Zo workspace:
```
/home/workspace/brain.md
```
(You can change this path — just update `BRAIN_PATH` in `routes/api-chat.ts` to match.)

---

## Step 2 — Create your Zo AI persona

1. In Zo Computer, go to [Settings → AI → Personas](/?t=settings&s=ai&d=personas)
2. Click **New Persona**
3. Name it something like `[Your Name] AI`
4. Paste in the contents of `persona-prompt.md` as the persona prompt
5. Replace the `[YOUR_NAME]` and `[YOUR_ROLE]` placeholders with your details
6. Save — note the **Persona ID** (you'll need it in the next step)

---

## Step 3 — Set your API key

1. Go to [Settings → Advanced](/?t=settings&s=advanced)
2. In the **Secrets** section, add a new secret:
   - **Key:** `ANTHROPIC_API_KEY`
   - **Value:** Your Anthropic API key from console.anthropic.com
3. Save

---

## Step 4 — Deploy the routes

In Zo Computer, go to your **Zo Space** and deploy the following routes. For each file in `routes/`, create the corresponding route:

### 4a — Deploy the API routes first

Before deploying, find every instance of `YOUR_HANDLE` in the route files and replace it with your actual Zo Space handle (e.g., `janedoe` if your space is `janedoe.zo.space`).

In `routes/api-chat.ts`:
- Update `BRAIN_PATH` if you saved your brain doc to a different path
- Update `PERSONA_ID` to the persona ID from Step 2
- Update `ALLOWED_ORIGINS` with your Zo Space URL

Deploy order:
1. `/api/chat` ← paste contents of `routes/api-chat.ts`
2. `/api/assess-fit` ← paste contents of `routes/api-assess-fit.ts`
3. `/api/contact` ← paste contents of `routes/api-contact.ts`
4. `/robots.txt` ← one-liner (see below)

**robots.txt route** (type: API, path: `/robots.txt`):
```typescript
import type { Context } from "hono";
export default (c: Context) =>
  new Response("User-agent: *\nDisallow: /\n", {
    headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=86400" }
  });
```

### 4b — Deploy the page

1. Open `routes/page.tsx`
2. Find `YOUR_PERSONA_ID` and replace it with your persona ID from Step 2
3. Update any hardcoded text (hero title, tagline, etc.) to reflect your details
4. Create a new **page route** at path `/career` (or `/`, or whatever path you want)
5. Mark it as **Public**

---

## Step 5 — Test everything

**Chat widget:**
```bash
curl -X POST https://YOUR_HANDLE.zo.space/api/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://YOUR_HANDLE.zo.space" \
  -d '{"input": "What are you targeting right now?"}'
```
You should see SSE events streaming back.

**Fit assessment:**
```bash
curl -X POST https://YOUR_HANDLE.zo.space/api/assess-fit \
  -H "Content-Type: application/json" \
  -H "Origin: https://YOUR_HANDLE.zo.space" \
  -d '{"jobDescription": "Senior GTM Engineer at Series B SaaS..."}'
```
You should get a JSON response with `score`, `scoreLabel`, `matches`, `gaps`, `recommendation`, `goodToKnow`.

**Origin check (should reject):**
```bash
curl -X POST https://YOUR_HANDLE.zo.space/api/assess-fit \
  -H "Content-Type: application/json" \
  -H "Origin: https://evil.com" \
  -d '{"jobDescription": "test"}'
# Should return: {"error":"forbidden"}
```

---

## Step 6 — Share your link

Your page is live at:
```
https://YOUR_HANDLE.zo.space/career
```

It is:
- ✅ **Public** — anyone with the link can visit
- ✅ **noindex** — not searchable, not crawlable
- ✅ **Rate limited** — protected from API abuse
- ✅ **Private link** — you control who you share it with

Share it with recruiters directly. Don't post it publicly (it's `noindex` for a reason).

---

## Customization tips

**Change rate limits:** Edit `LIMIT_CHAT_PER_24H` in `api-chat.ts` and `LIMIT` in `api-assess-fit.ts`.

**Change the color scheme:** The page uses Tailwind with `zinc-950` background and `amber-500` accent. Find/replace across `page.tsx`.

**Add your own guardrails:** The `ABUSE_PATTERNS` array in `api-chat.ts` includes regex patterns that deflect jailbreak attempts. Add patterns for topics you want to explicitly block.

**Lead notifications:** `api-contact.ts` sends you an SMS when someone submits the contact form (via Zo's messaging). This requires `ZO_CLIENT_IDENTITY_TOKEN` to be set — it's available automatically in Zo Space routes.

---

## Troubleshooting

**"Missing ANTHROPIC_API_KEY" error** → Go to Settings → Advanced → Secrets and make sure the key is saved exactly as `ANTHROPIC_API_KEY`.

**Chat returns "forbidden"** → Make sure `ALLOWED_ORIGINS` in `api-chat.ts` includes your exact Zo Space URL (e.g., `https://yourhandle.zo.space`).

**Fit assessment returns invalid JSON** → Check the `SYSTEM_PROMPT` in `api-assess-fit.ts`. The prompt instructs Claude to return only valid JSON. If you've modified it, make sure the JSON schema instruction is still present.

**Page doesn't load / build error** → Check the Zo Space error log in your dashboard. Common issues: missing import, TypeScript syntax error.
