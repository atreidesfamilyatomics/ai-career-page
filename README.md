# AI Career Page — Built on Zo Computer

A production-grade interactive career page with an AI chat widget and job fit assessment engine, built entirely on [Zo Computer](https://zo-computer.cello.so/axSBMOdRd0Z).

---

## What you'll have in ~2 hours

- **AI chat widget** — visitors ask anything about your background; Claude answers from your brain document
- **Job fit assessment** — paste a JD, get a scored 1–10 analysis: match points, gaps, honest recommendation
- **Security hardening** — IP rate limiting, origin checks, input validation, abuse guardrails, honeypot contact form
- **noindex by design** — private link-sharing artifact, not a public career site; you control who sees it
- **Lead capture** — contact form with honeypot, rate limiting, and optional SMS notification via Zo

---

## Live demo

> [atreidesfamilyatomics.zo.space/career](https://atreidesfamilyatomics.zo.space/career)

---

## What's in this repo

| File | Purpose |
|------|---------|
| `brain-template.md` | 8-section brain doc template — **start here. This is the real IP.** |
| `persona-prompt.md` | System prompt template for your Zo AI persona |
| `routes/page.tsx` | Career page React component (Tailwind, dark mode) |
| `routes/api-chat.ts` | Chat proxy: SSE streaming, rate limiting, abuse guardrails |
| `routes/api-assess-fit.ts` | Fit assessment: structured JSON scoring via Claude |
| `routes/api-contact.ts` | Contact form: honeypot, rate limiting, optional SMS notification |
| `DEPLOY.md` | Full step-by-step deployment guide for Zo Computer |

---

## The brain document

The brain document (`brain-template.md`) is the actual work. Most people paste their LinkedIn export into a prompt and get generic output. This template is different:

- **8 structured sections** — pitch, work history, skills, projects, what you're looking for, working style, pre-answered FAQs, and fit rubric
- **Section 8: Fit Rubric** is what makes the fit assessment non-generic. It explicitly defines your strong fits and poor fits so Claude scores honestly — not just optimistically. Most people skip this section. Don't skip this section.

Fill out the template, save it to your Zo workspace, and it becomes the AI's working memory.

---

## Setup

See **[DEPLOY.md](DEPLOY.md)** for the full walkthrough.

**You'll need:**
- A [Zo Computer account](https://zo-computer.cello.so/axSBMOdRd0Z) (free tier works to launch)
- An [Anthropic API key](https://console.anthropic.com) (pay-as-you-go, ~$5 for thousands of conversations)

**Total cost to launch:** $0 on Zo free tier + Anthropic API usage. Optional: ~$15/year for a custom domain.

---

## Credit & Inspiration

This project was directly inspired by **[Nate B Jones](https://www.youtube.com/@AINewsStrategy)** (AI News & Strategy Daily) and his video:

> **"Stop Competing With 400 Applicants. Build This in One Weekend"** (January 2026)
> [Watch on YouTube →](https://youtu.be/0teZqotpqT8?si=oGmZy4KUg131Tcjy)

Nate's core insight: *don't be in the pile — create your own surface.* His original demo used Lovable with a fictional candidate. This repo is a full rebuild on Zo Computer with added security hardening, structured JSON scoring output, a reusable 8-section brain document template, and noindex-by-design.

If you find this useful, go watch his video first. His framing on attention economics is worth the time.

---

## License

MIT
