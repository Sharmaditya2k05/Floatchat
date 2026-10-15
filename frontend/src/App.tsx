import { useEffect, useState } from "react";
import { askQuestion } from "./api";
import Chat from "./components/Chat";
import DataLimitNotice from "./components/DataLimitNotice";
import DataView from "./components/DataView";
import FisheriesView from "./components/FisheriesView";
import HowItWorks from "./components/HowItWorks";
import Landing, { type EnterPayload } from "./components/Landing";
import ResultsPanel from "./components/ResultsPanel";
import Sidebar, { type NavKey } from "./components/Sidebar";
import { HistoryPanel, SavedPanel } from "./components/SidePanels";
import type { ChatMessage, ChatResponse } from "./types";

const EXAMPLES = [
  "Show me salinity near the equator in March 2023",
  "Average salinity in the Arabian Sea in 2023 between 0 and 200 m",
  "How many active floats are in the Bay of Bengal?",
  "Nearest 5 floats to 15N, 68E",
  "How has surface temperature near the equator changed month by month in 2023?",
  "Current fishing zones near Kochi",
  "Is the water warm enough for tuna near Chennai?",
  "Show me chlorophyll hotspots in the Bay of Bengal",
];

const LANGS = [
  { code: "", label: "Auto-detect" },
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "ta", label: "தமிழ்" },
  { code: "bn", label: "বাংলা" },
  { code: "te", label: "తెలుగు" },
  { code: "ml", label: "മലയാളം" },
];

export type Stage = "idle" | "understanding" | "querying" | "plotting";
export type ResultTab = "map" | "chart" | "table";

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [current, setCurrent] = useState<ChatResponse | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [lang, setLang] = useState("");
  const [health, setHealth] = useState<"ok" | "down" | "loading">("loading");
  const [view, setView] = useState<"explore" | "how">("explore");
  const [nav, setNav] = useState<NavKey>("chat");
  const [tab, setTab] = useState<ResultTab>("map");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try { return (localStorage.getItem("fc-theme") as "dark" | "light") || "dark"; } catch { return "dark"; }
  });
  const [saved, setSaved] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("fc-saved") || "[]"); } catch { return []; }
  });
  // Landing → app entry. `landing` shows the hero; `leaving` runs the crossfade.
  const [landing, setLanding] = useState(true);
  const [leaving, setLeaving] = useState(false);

  function enterApp(p: EnterPayload) {
    if (leaving) return;
    if (p.view === "how") { setView("how"); setNav("about"); }
    else if (p.view === "data") { setView("explore"); setNav("data"); }
    else if (p.view === "fisheries") { setView("explore"); setNav("fisheries"); }
    setLeaving(true);
    window.setTimeout(() => {
      setLanding(false);
      if (p.q) submit(p.q);
    }, 640);
  }

  const history = messages
    .filter((m): m is ChatMessage & { response: ChatResponse } => !!m.response)
    .map((m) => m.response)
    .reverse();

  function toggleSave(q: string) {
    setSaved((s) => {
      const next = s.includes(q) ? s.filter((x) => x !== q) : [q, ...s];
      try { localStorage.setItem("fc-saved", JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  }

  useEffect(() => {
    fetch("/api/health").then((r) => r.json())
      .then((h) => setHealth(h.db === "ok" ? "ok" : "down"))
      .catch(() => setHealth("down"));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("fc-theme", theme); } catch { /* private mode */ }
  }, [theme]);

  function onNav(k: NavKey) {
    if (k === "about") { setView("how"); setNav("about"); return; }
    setView("explore");
    setNav(k);
    if (k === "map" || k === "chart" || k === "table") setTab(k);
  }

  async function submit(question: string) {
    if (!question.trim() || stage !== "idle") return;
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setView("explore");
    setMessages((m) => [...m, { role: "user", text: question, time: now }]);
    setStage("understanding");
    const t = setTimeout(() => setStage("querying"), 600);
    try {
      const res = await askQuestion(question, lang);
      setStage("plotting");
      setCurrent(res);
      setMessages((m) => [...m, { role: "assistant", text: res.answer, response: res,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "error", text: e instanceof Error ? e.message : String(e) }]);
    } finally {
      clearTimeout(t);
      setStage("idle");
    }
  }

  return (
    <div className="flex h-full">
      {landing && <Landing leaving={leaving} onEnter={enterApp} />}
      {!landing && <DataLimitNotice />}
      <Sidebar active={view === "how" ? "about" : nav} onSelect={onNav} theme={theme} onTheme={setTheme} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between px-6 py-3" style={{ borderBottom: "1px solid var(--border-soft)" }}>
          <div>
            <h1 className="font-display text-[19px] font-semibold leading-none tracking-tight" style={{ color: "var(--ink)" }}>
              FloatChat
            </h1>
            <p className="mt-1 text-[11px]" style={{ color: "var(--ink-faint)" }}>
              ARGO ocean-float intelligence · ask in plain language
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-1 rounded-lg p-1" style={{ background: "var(--panel)", border: "1px solid var(--border-soft)" }}>
              <button onClick={() => { setView("explore"); setNav("chat"); }}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] transition"
                style={{ background: view === "explore" ? "var(--raised)" : "transparent", color: view === "explore" ? "var(--ink)" : "var(--ink-faint)", fontWeight: view === "explore" ? 600 : 500 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>
                Explore
              </button>
              <button onClick={() => { setView("how"); setNav("about"); }}
                className="rounded-md px-3 py-1.5 text-[13px] transition"
                style={{ background: view === "how" ? "var(--raised)" : "transparent", color: view === "how" ? "var(--ink)" : "var(--ink-faint)", fontWeight: view === "how" ? 600 : 500 }}>
                How it works
              </button>
            </div>
            <StatusPill health={health} />
            {view === "explore" && (
              <select value={lang} onChange={(e) => setLang(e.target.value)}
                className="rounded-lg px-3 py-1.5 text-sm outline-none"
                style={{ border: "1px solid var(--border)", background: "var(--panel-2)", color: "var(--ink-dim)" }}>
                {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            )}
          </div>
        </header>

        {view === "how" ? (
          <HowItWorks />
        ) : nav === "data" ? (
          <DataView />
        ) : nav === "fisheries" ? (
          <FisheriesView onAsk={(q) => { setNav("chat"); submit(q); }} />
        ) : (
          <main className="flex min-h-0 flex-1">
            <section className="flex w-[44%] min-w-[380px] flex-col" style={{ borderRight: "1px solid var(--border-soft)" }}>
              {nav === "query" ? (
                <HistoryPanel items={history} onOpen={(r) => { setCurrent(r); setNav("chat"); }} />
              ) : nav === "saved" ? (
                <SavedPanel items={saved} onRun={(q) => { setNav("chat"); submit(q); }} onRemove={toggleSave} />
              ) : (
                <Chat messages={messages} stage={stage} examples={EXAMPLES} current={current}
                  saved={saved} onToggleSave={toggleSave}
                  onSubmit={submit} onSelectResult={(r) => setCurrent(r)} onLearn={() => { setView("how"); setNav("about"); }} />
              )}
            </section>
            <section className="min-w-0 flex-1 p-4">
              <ResultsPanel response={current} tab={tab} onTab={setTab} />
            </section>
          </main>
        )}
      </div>
    </div>
  );
}

function StatusPill({ health }: { health: "ok" | "down" | "loading" }) {
  const map = {
    ok: { c: "var(--seafoam)", t: "Data live" },
    down: { c: "var(--coral)", t: "DB offline" },
    loading: { c: "var(--ink-faint)", t: "Connecting" },
  }[health];
  return (
    <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium"
      style={{ border: "1px solid var(--border)", background: "var(--panel)", color: "var(--ink-dim)" }}>
      <span className={health === "ok" ? "fc-dot" : ""} style={{ width: 7, height: 7, borderRadius: 999, background: map.c }} />
      {map.t}
    </div>
  );
}
