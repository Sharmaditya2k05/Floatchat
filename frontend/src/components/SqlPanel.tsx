import { useState } from "react";

const KEYWORDS = new Set([
  "select", "from", "where", "and", "or", "not", "null", "is", "as", "join", "left", "right",
  "inner", "outer", "on", "group", "by", "order", "having", "limit", "offset", "distinct",
  "asc", "desc", "between", "in", "like", "count", "avg", "sum", "min", "max", "date_trunc",
  "case", "when", "then", "else", "end", "union", "all",
]);

function Highlighted({ sql }: { sql: string }) {
  // tokenize into strings, numbers, words, and everything else; color each.
  const parts: { t: string; c: string }[] = [];
  const re = /('[^']*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([^\sA-Za-z0-9_']+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    if (m[1]) parts.push({ t: m[1], c: "#e0955e" }); // string
    else if (m[2]) parts.push({ t: m[2], c: "#d9a441" }); // number
    else if (m[3]) {
      const low = m[3].toLowerCase();
      if (KEYWORDS.has(low)) parts.push({ t: m[3], c: "#4dd6b0" }); // keyword — teal
      else parts.push({ t: m[3], c: "#cdd8e6" }); // identifier
    } else if (m[4]) parts.push({ t: m[4], c: "" }); // whitespace
    else parts.push({ t: m[5], c: "#8aa0b8" }); // punctuation
  }
  return (
    <pre className="font-mono overflow-x-auto whitespace-pre-wrap text-[12px] leading-[1.7]">
      {parts.map((p, i) => (
        <span key={i} style={p.c ? { color: p.c } : undefined}>{p.t}</span>
      ))}
    </pre>
  );
}

export default function SqlPanel({
  sql,
  engine,
  floatIds,
}: {
  sql: string;
  engine: string;
  floatIds: number[];
}) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(sql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  }
  return (
    <div className="fc-panel overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid var(--border-soft)" }}>
        <div className="flex items-center gap-2.5">
          <span className="font-display text-[13px] font-semibold" style={{ color: "var(--ink)" }}>Query (SQL)</span>
          <span
            className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
            style={{
              background: engine === "llm" ? "rgba(53,224,192,0.14)" : "var(--panel-2)",
              color: engine === "llm" ? "var(--seafoam)" : "var(--ink-faint)",
              border: "1px solid var(--border)",
            }}
          >
            {engine === "llm" ? "AI-written" : "rule-based"}
          </span>
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] transition"
          style={{ border: "1px solid var(--border)", color: copied ? "var(--seafoam)" : "var(--ink-dim)" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="px-4 py-3">
        <div style={{ background: "#0b1420", border: "1px solid #1e3350", borderRadius: 10, padding: "10px 12px" }}>
          <Highlighted sql={sql} />
        </div>
        {floatIds.length > 0 && (
          <p className="mt-2.5 font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
            <span style={{ color: "var(--amber)" }}>source floats</span>{" "}
            {floatIds.slice(0, 20).join(", ")}
            {floatIds.length > 20 ? ` +${floatIds.length - 20} more` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
