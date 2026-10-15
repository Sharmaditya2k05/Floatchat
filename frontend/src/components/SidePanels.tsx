import type { ChatResponse } from "../types";

/* Left-column panels for the Query (history) and Saved (bookmarks) nav items. */

export function HistoryPanel({
  items,
  onOpen,
}: {
  items: ChatResponse[];
  onOpen: (r: ChatResponse) => void;
}) {
  return (
    <Frame title="Query history" subtitle="Every question you've asked this session, with its SQL.">
      {items.length === 0 ? (
        <Empty icon="query" text="No queries yet. Ask something in Chat and it'll show up here." />
      ) : (
        <div className="space-y-2">
          {items.map((r, i) => (
            <button
              key={i}
              onClick={() => onOpen(r)}
              className="w-full rounded-xl p-3 text-left transition hover:brightness-110"
              style={{ background: "var(--panel)", border: "1px solid var(--border-soft)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>{r.question}</p>
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                  style={{ background: r.engine === "llm" ? "rgba(53,224,192,.14)" : "var(--panel-2)", color: r.engine === "llm" ? "var(--seafoam)" : "var(--ink-faint)", border: "1px solid var(--border)" }}>
                  {r.engine === "llm" ? "AI" : "rule"}
                </span>
              </div>
              <pre className="mt-2 overflow-hidden font-mono text-[10.5px] leading-snug" style={{ color: "var(--seafoam-dim)", maxHeight: 42 }}>
                {r.sql}
              </pre>
              <p className="mt-1.5 text-[11px]" style={{ color: "var(--ink-faint)" }}>
                {r.row_count} row{r.row_count === 1 ? "" : "s"} · {r.float_ids.length} floats · reopen →
              </p>
            </button>
          ))}
        </div>
      )}
    </Frame>
  );
}

export function SavedPanel({
  items,
  onRun,
  onRemove,
}: {
  items: string[];
  onRun: (q: string) => void;
  onRemove: (q: string) => void;
}) {
  return (
    <Frame title="Saved questions" subtitle="Tap the ☆ on any answer to bookmark it. Saved across sessions.">
      {items.length === 0 ? (
        <Empty icon="saved" text="No saved questions yet. Tap the star on an answer to save it." />
      ) : (
        <div className="space-y-2">
          {items.map((q) => (
            <div key={q} className="flex items-center gap-2 rounded-xl p-3"
              style={{ background: "var(--panel)", border: "1px solid var(--border-soft)" }}>
              <button onClick={() => onRun(q)} className="flex-1 text-left text-[13px] font-medium transition hover:opacity-80" style={{ color: "var(--ink)" }}>
                <span className="mr-1.5" style={{ color: "var(--amber)" }}>★</span>
                {q}
              </button>
              <button onClick={() => onRun(q)} title="Run" className="shrink-0 rounded-md px-2 py-1 text-[11px]" style={{ color: "var(--seafoam)", border: "1px solid rgba(53,224,192,.35)" }}>
                Run
              </button>
              <button onClick={() => onRemove(q)} title="Remove" className="shrink-0 text-[15px]" style={{ color: "var(--ink-faint)" }}>×</button>
            </div>
          ))}
        </div>
      )}
    </Frame>
  );
}

function Frame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pb-3 pt-5">
        <h2 className="font-display text-[17px] font-semibold" style={{ color: "var(--ink)" }}>{title}</h2>
        <p className="mt-1 text-[12px]" style={{ color: "var(--ink-faint)" }}>{subtitle}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
    </div>
  );
}

function Empty({ icon, text }: { icon: "query" | "saved"; text: string }) {
  return (
    <div className="mt-16 flex flex-col items-center gap-3 text-center" style={{ color: "var(--ink-faint)" }}>
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.6">
        {icon === "query"
          ? <path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 6l-2 12" />
          : <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />}
      </svg>
      <p className="max-w-[240px] text-[13px]">{text}</p>
    </div>
  );
}
