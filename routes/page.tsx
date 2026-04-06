// ─── CUSTOMIZATION ────────────────────────────────────────────────────────────
// Replace these constants with your own details before deploying.
// Everything else in this file is structural — change the copy in the JSX below.

const CONFIG = {
  name: "Your Name",
  title: "Your Title",
  tagline: "Your tagline — one sentence that captures what you do and how.",
  location: "Remote · Greater [City]",
  status: "Open to opportunities",
  email: "you@example.com",
  linkedin: "https://linkedin.com/in/yourhandle",
  // Your Zo AI Persona ID (Settings → AI → Personas)
  // Only needed if you're routing chat through the Zo Persona endpoint instead of direct Anthropic
  personaId: "YOUR_PERSONA_ID",
};
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Send, X, MessageCircle, CheckCircle, AlertTriangle,
  ArrowRight, Loader2, RotateCcw, Mail, Linkedin, ExternalLink
} from "lucide-react";

// ─── TYPES ───────────────────────────────────────────────────────────────────

type FitResult = {
  score: number;
  scoreLabel: "Strong Match" | "Good Match" | "Partial Match" | "Poor Match";
  scoreColor: "green" | "yellow" | "orange" | "red";
  matches: { point: string; detail: string }[];
  gaps: { point: string; detail: string }[];
  recommendation: string;
  goodToKnow: string;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

// ─── HOOKS ───────────────────────────────────────────────────────────────────

function useInViewport(ref: React.RefObject<Element>) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.1 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref]);
  return visible;
}

// ─── CHAT WIDGET ─────────────────────────────────────────────────────────────

function ChatWidget({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError("");
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        body: JSON.stringify({ input: text }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) setError("You've reached the chat limit for today. Try again tomorrow.");
        else setError(data.error || "Something went wrong. Try again.");
        setLoading(false);
        return;
      }

      let reply = "";
      setMessages([...next, { role: "assistant", content: "" }]);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        while (buffer.includes("\n\n")) {
          const idx = buffer.indexOf("\n\n");
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          try {
            const parsed = JSON.parse(dataLine.slice(6));
            if (parsed.delta) {
              reply += parsed.delta;
              setMessages([...next, { role: "assistant", content: reply }]);
            }
          } catch {}
        }
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-6 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ height: "min(560px, 80vh)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900">
          <div>
            <p className="text-sm font-semibold text-white">{CONFIG.name} AI</p>
            <p className="text-xs text-zinc-400">Ask anything about my background</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
          {messages.length === 0 && (
            <div className="text-center text-zinc-500 text-xs pt-8">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Ask me about my background,<br />experience, or any role you're considering.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-amber-500 text-zinc-950 font-medium"
                  : "bg-zinc-800 text-zinc-100"
              }`}>
                {m.content || (loading && m.role === "assistant" ? (
                  <span className="flex gap-1 items-center text-zinc-400">
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                ) : "")}
              </div>
            </div>
          ))}
          {error && <p className="text-red-400 text-xs text-center px-2">{error}</p>}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-zinc-800">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
              placeholder="Ask a question..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-500 transition-colors"
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="p-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 rounded-xl transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FIT ASSESSMENT ──────────────────────────────────────────────────────────

const scoreColors = {
  green:  { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", num: "text-emerald-300" },
  yellow: { bg: "bg-amber-500/10",   border: "border-amber-500/30",   text: "text-amber-400",   num: "text-amber-300"  },
  orange: { bg: "bg-orange-500/10",  border: "border-orange-500/30",  text: "text-orange-400",  num: "text-orange-300" },
  red:    { bg: "bg-red-500/10",     border: "border-red-500/30",     text: "text-red-400",     num: "text-red-300"    },
};

function FitAssessment() {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInViewport(ref as React.RefObject<Element>);
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FitResult | null>(null);
  const [error, setError] = useState("");

  const assess = async () => {
    if (!jd.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await fetch("/api/assess-fit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ jobDescription: jd }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) setError("You've used your assessments for today. Check back tomorrow.");
        else setError(data.error || "Something went wrong. Try again.");
        return;
      }
      setResult(data);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const colors = result ? (scoreColors[result.scoreColor] || scoreColors.yellow) : null;

  return (
    <section ref={ref} className={`py-24 px-6 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-2">Check Your Job Fit</h2>
        <p className="text-zinc-400 mb-8 text-sm">Paste a job description. Get an honest score, match points, and gaps — not just a chatbot saying "looks great!"</p>

        {!result ? (
          <div className="space-y-4">
            <textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the full job description here — title, responsibilities, requirements..."
              rows={8}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-500 transition-colors resize-none"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={assess}
              disabled={loading || !jd.trim()}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><ArrowRight className="w-4 h-4" /> Assess Fit</>}
            </button>
          </div>
        ) : (
          <div className={`rounded-2xl border p-6 space-y-6 ${colors!.bg} ${colors!.border}`}>
            {/* Score */}
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-4xl font-black ${colors!.num}`}>{result.score}<span className="text-lg font-normal text-zinc-500">/10</span></p>
                <p className={`text-sm font-semibold mt-1 ${colors!.text}`}>{result.scoreLabel}</p>
              </div>
              <button onClick={() => { setResult(null); setError(""); }} className="p-2 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Matches */}
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Matches</p>
              <div className="space-y-2">
                {result.matches.map((m, i) => (
                  <div key={i} className="flex gap-3">
                    <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-white">{m.point}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{m.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gaps */}
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Gaps</p>
              <div className="space-y-2">
                {result.gaps.map((g, i) => (
                  <div key={i} className="flex gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-white">{g.point}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{g.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendation */}
            <div className="pt-4 border-t border-zinc-700/50 space-y-2">
              <p className="text-sm text-zinc-200">{result.recommendation}</p>
              <p className="text-xs text-zinc-500 italic">{result.goodToKnow}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── CONTACT FORM ────────────────────────────────────────────────────────────

function ContactForm() {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInViewport(ref as React.RefObject<Element>);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "" }); // company = honeypot
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(form),
      });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <section ref={ref} className={`py-24 px-6 border-t border-zinc-800 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
      <div className="max-w-md mx-auto text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Let's connect</h2>
        <p className="text-zinc-400 text-sm mb-8">Leave your info and I'll reach out directly.</p>

        {status === "success" ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-emerald-300 font-semibold">Got it — I'll be in touch soon.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3 text-left">
            {/* Honeypot — hidden from real users, bots autofill it */}
            <input
              type="text"
              name="company"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              tabIndex={-1}
              autoComplete="off"
              style={{ position: "absolute", opacity: 0, pointerEvents: "none", height: 0 }}
            />
            <input
              type="text"
              placeholder="Your name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-500 transition-colors"
            />
            <input
              type="email"
              placeholder="Email address *"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-500 transition-colors"
            />
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-500 transition-colors"
            />
            {status === "error" && <p className="text-red-400 text-sm">Something went wrong. Please try again.</p>}
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 font-semibold rounded-xl transition-colors"
            >
              {status === "loading" ? "Sending..." : "Send"}
            </button>
          </form>
        )}

        {/* Direct links */}
        <div className="flex justify-center gap-4 mt-8">
          <a href={`mailto:${CONFIG.email}`} className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors">
            <Mail className="w-4 h-4" /> Email
          </a>
          <a href={CONFIG.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors">
            <Linkedin className="w-4 h-4" /> LinkedIn
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────

export default function CareerPage() {
  const [chatOpen, setChatOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  // Set meta/OG tags for link sharing
  useEffect(() => {
    document.title = `${CONFIG.name} — ${CONFIG.title}`;
    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute(name.startsWith("og:") || name.startsWith("twitter:") ? "property" : "name", name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    setMeta("description", CONFIG.tagline);
    setMeta("robots", "noindex, nofollow");
    setMeta("og:title", `${CONFIG.name} — ${CONFIG.title}`);
    setMeta("og:description", CONFIG.tagline);
    setMeta("og:type", "website");
    setMeta("og:url", `https://YOUR_HANDLE.zo.space/career`);
    setMeta("twitter:card", "summary");
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      {/* ── HERO ── */}
      <div ref={heroRef} className="relative min-h-screen flex flex-col justify-center px-6 py-24 overflow-hidden">
        {/* Background blur blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-zinc-700/20 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-2xl mx-auto w-full">
          {/* Status badge */}
          <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-full px-4 py-1.5 text-xs text-zinc-400 mb-8">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            {CONFIG.status}
          </div>

          <h1 className="text-5xl sm:text-6xl font-black text-white tracking-tight leading-none mb-4">
            {CONFIG.name}
          </h1>
          <p className="text-lg sm:text-xl text-amber-400 font-semibold mb-4">{CONFIG.title}</p>
          <p className="text-zinc-400 text-lg max-w-xl mb-10 leading-relaxed">{CONFIG.tagline}</p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setChatOpen(true)}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
            >
              <MessageCircle className="w-5 h-5" /> Ask AI about me
            </button>
            <a
              href="#fit"
              className="px-6 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-5 h-5" /> Check your job fit
            </a>
          </div>
        </div>
      </div>

      {/* ── FIT ASSESSMENT ── */}
      <div id="fit">
        <FitAssessment />
      </div>

      {/* ── CONTACT ── */}
      <ContactForm />

      {/* ── CHAT FAB ── */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-amber-500 hover:bg-amber-400 rounded-full shadow-2xl shadow-amber-500/30 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          aria-label="Open chat"
        >
          <MessageCircle className="w-6 h-6 text-zinc-950" />
        </button>
      )}

      <ChatWidget isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
