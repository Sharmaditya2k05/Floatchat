import { useEffect, useRef, useState } from "react";
import type { Stage } from "../App";
import type { ChatMessage, ChatResponse } from "../types";
import PromoCard from "./PromoCard";
import QuickInsights from "./QuickInsights";

const STAGE_LABEL: Record<Exclude<Stage, "idle">, string> = {
  understanding: "understanding your question",
  querying: "querying the ARGO database",
  plotting: "building the map and chart",
};

export default function Chat({
  messages,
  stage,
  examples,
  current,
  saved,
  onToggleSave,
  onSubmit,
  onSelectResult,
  onLearn,
}: {
  messages: ChatMessage[];
  stage: Stage;
  examples: string[];
  current: ChatResponse | null;
  saved: string[];
  onToggleSave: (q: string) => void;
  onSubmit: (q: string) => void;
  onSelectResult: (r: ChatResponse) => void;
  onLearn: () => void;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, stage]);

  function send() {
    onSubmit(input);
    setInput("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
        {messages.length === 0 && (
          <div className="mt-2 space-y-4">
            <div>
              <p
                className="font-display text-[15px] font-medium"
                style={{ color: "var(--ink)" }}
              >
                Explore the Indian Ocean by asking.
              </p>
              <p className="mt-1 text-[13px]" style={{ color: "var(--ink-faint)" }}>
                Every answer is drawn from real ARGO float records — with the map,
                the chart, and the exact SQL behind it.
              </p>
            </div>
            <div className="space-y-2">
              {examples.map((ex) => (
                <button
                  key={ex}
                  onClick={() => onSubmit(ex)}
                  className="fc-chip block w-full px-4 py-2.5 text-left text-[13px]"
                  style={{ borderRadius: "12px" }}
                >
                  <span
                    className="mr-2 font-mono text-[11px]"
                    style={{ color: "var(--seafoam)" }}
                  >
                    ›
                  </span>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <MessageBubble
            key={i}
            m={m}
            onSelectResult={onSelectResult}
            onSubmit={onSubmit}
            isLast={i === messages.length - 1}
            saved={saved}
            onToggleSave={onToggleSave}
          />
        ))}

        {stage !== "idle" && (
          <div className="flex items-center gap-2.5 px-1 text-[12px]" style={{ color: "var(--ink-dim)" }}>
            <span className="flex gap-1">
              {[0, 160, 320].map((d) => (
                <span key={d} className="fc-dot" style={{ width: 6, height: 6, borderRadius: 999, background: "var(--seafoam)", animationDelay: `${d}ms` }} />
              ))}
            </span>
            {STAGE_LABEL[stage]}…
          </div>
        )}

        {current && stage === "idle" && <QuickInsights r={current} />}
        {messages.length > 0 && <PromoCard onLearn={onLearn} />}

        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3" style={{ borderTop: "1px solid var(--border-soft)" }}>
        <div
          className="flex items-center gap-2 rounded-xl px-2 py-1.5"
          style={{ border: "1px solid var(--border)", background: "var(--panel)" }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask about salinity, temperature, floats, regions…"
            className="flex-1 bg-transparent px-2 py-1.5 text-[13px] outline-none"
            style={{ color: "var(--ink)" }}
          />
          <button
            onClick={send}
            disabled={stage !== "idle" || !input.trim()}
            className="rounded-lg px-4 py-2 text-[13px] font-semibold transition disabled:opacity-30"
            style={{ background: "var(--seafoam)", color: "#062018" }}
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  m,
  onSelectResult,
  onSubmit,
  isLast,
  saved,
  onToggleSave,
}: {
  m: ChatMessage;
  onSelectResult: (r: ChatResponse) => void;
  onSubmit: (q: string) => void;
  isLast: boolean;
  saved: string[];
  onToggleSave: (q: string) => void;
}) {
  if (m.role === "user") {
    return (
      <div className="ml-auto max-w-[86%] px-4 py-2.5 text-[13px]"
        style={{ background: "linear-gradient(180deg, var(--seafoam), var(--seafoam-dim))", color: "#052018", borderRadius: "16px 16px 4px 16px", fontWeight: 500 }}>
        <div className="flex items-start justify-between gap-3">
          <span>{m.text}</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 opacity-70">
            <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </div>
      </div>
    );
  }

  const isError = m.role === "error";
  return (
    <div
      className="max-w-[92%] px-4 py-3.5 text-[13px]"
      style={{
        background: isError ? "rgba(255,107,107,0.08)" : "var(--panel)",
        border: `1px solid ${isError ? "rgba(255,107,107,0.35)" : "var(--border-soft)"}`,
        color: isError ? "#ffb4b4" : "var(--ink)",
        borderRadius: "16px 16px 16px 4px",
      }}
    >
      <div className="flex items-start gap-3">
        {!isError && (
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full"
            style={{ background: "rgba(53,224,192,.15)", border: "1px solid rgba(53,224,192,.45)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--seafoam)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
        )}
        <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
      </div>
      {m.response && (
        <>
          <button
            onClick={() => onSelectResult(m.response!)}
            className="mt-3 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition hover:gap-2.5"
            style={{ color: "var(--seafoam)", border: "1px solid rgba(53,224,192,.35)", background: "rgba(53,224,192,.06)" }}
          >
            View results
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
          <div className="mt-2.5 flex items-center justify-between border-t pt-2.5 text-[11px]" style={{ borderColor: "var(--border-soft)", color: "var(--ink-faint)" }}>
            <span>{m.response.row_count} row{m.response.row_count === 1 ? "" : "s"} · {m.response.float_ids.length} floats</span>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => onToggleSave(m.response!.question)}
                title={saved.includes(m.response.question) ? "Remove from Saved" : "Save this question"}
                className="text-[13px] transition hover:scale-110"
                style={{ color: saved.includes(m.response.question) ? "var(--amber)" : "var(--ink-faint)" }}
              >
                {saved.includes(m.response.question) ? "★" : "☆"}
              </button>
              {m.time && <span>{m.time}</span>}
            </div>
          </div>
          {isLast && m.response.suggestions?.length > 0 && (
            <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border-soft)" }}>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>
                Try next
              </p>
              <div className="flex flex-col gap-1.5">
                {m.response.suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => onSubmit(s)}
                    className="fc-chip px-3 py-1.5 text-left text-[12px]"
                    style={{ borderRadius: "10px" }}
                  >
                    <span className="mr-1.5" style={{ color: "var(--seafoam)" }}>›</span>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
