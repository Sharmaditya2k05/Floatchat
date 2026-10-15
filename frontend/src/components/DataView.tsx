import { useEffect, useState } from "react";

/* The "Data" tab — a live preview of what's stored in the database and
   where it was extracted from. */

interface TablePreview {
  name: string;
  description: string;
  count: number | null;
  columns: string[];
  rows: unknown[][];
}
interface Source {
  name: string;
  detail: string;
  tag: string;
}
interface Overview {
  sources: Source[];
  tables: TablePreview[];
  summary: {
    profiles: number;
    measurements: number;
    floats: number;
    time_from: string | null;
    time_to: string | null;
    region: string;
  };
}

function fmtInt(n: number | null): string {
  return n == null ? "—" : n.toLocaleString();
}
function fmtCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(3);
  if (typeof v === "boolean") return v ? "true" : "false";
  const s = String(v);
  // shorten ISO timestamps
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}` : s;
}

export default function DataView() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/data/overview")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed to load"))))
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="fc-how relative flex min-h-0 flex-1 overflow-hidden">
      {/* deep-sea background, matching How it works */}
      <div className="pointer-events-none absolute inset-0 z-0"
        style={{ backgroundImage: "url('/1.png')", backgroundSize: "cover", backgroundPosition: "center" }} />
      <div className="pointer-events-none absolute inset-0 z-0"
        style={{ background: "linear-gradient(180deg, rgba(4,10,18,.74), rgba(4,10,18,.88))" }} />

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-8 py-10">
        <p className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--seafoam)" }}>
          The data
        </p>
        <h2 className="mt-2 font-display text-[27px] font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
          What's stored, and where it came from
        </h2>

        {error && (
          <p className="mt-6 rounded-xl p-4 text-[13px]" style={{ background: "var(--panel)", border: "1px solid var(--coral)", color: "var(--coral)" }}>
            Couldn't reach the database ({error}). Make sure the backend and Postgres are running.
          </p>
        )}

        {!data && !error && (
          <p className="mt-6 text-[13px]" style={{ color: "var(--ink-faint)" }}>Loading a live preview from the database…</p>
        )}

        {data && (
          <>
            {/* summary */}
            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                ["Floats", fmtInt(data.summary.floats)],
                ["Profiles", fmtInt(data.summary.profiles)],
                ["Measurements", fmtInt(data.summary.measurements)],
                ["Coverage", data.summary.region],
              ].map(([l, v]) => (
                <div key={l} className="fc-panel p-4">
                  <p className="font-display text-[20px] font-semibold" style={{ color: "var(--ink)" }}>{v}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>{l}</p>
                </div>
              ))}
            </div>
            {data.summary.time_from && (
              <p className="mt-3 text-[12.5px]" style={{ color: "var(--ink-dim)" }}>
                Time span: <b style={{ color: "var(--ink)" }}>{fmtCell(data.summary.time_from)}</b> →{" "}
                <b style={{ color: "var(--ink)" }}>{fmtCell(data.summary.time_to)}</b> · read-only, quality-controlled.
              </p>
            )}

            {/* sources */}
            <h3 className="mt-9 font-display text-[17px] font-semibold" style={{ color: "var(--ink)" }}>Where it's extracted from</h3>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
              {data.sources.map((s) => (
                <div key={s.name} className="fc-panel p-4">
                  <span className="rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider"
                    style={{ background: "rgba(53,224,192,.14)", color: "var(--seafoam)", border: "1px solid var(--border)" }}>{s.tag}</span>
                  <p className="mt-2 font-display text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>{s.name}</p>
                  <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--ink-dim)" }}>{s.detail}</p>
                </div>
              ))}
            </div>

            {/* tables */}
            <h3 className="mt-9 font-display text-[17px] font-semibold" style={{ color: "var(--ink)" }}>What's stored — live preview</h3>
            <p className="mt-1 text-[12.5px]" style={{ color: "var(--ink-faint)" }}>
              A few real rows straight from each table (read-only).
            </p>
            <div className="mt-4 space-y-5">
              {data.tables.map((t) => (
                <div key={t.name} className="fc-panel overflow-hidden">
                  <div className="flex items-baseline justify-between gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border-soft)" }}>
                    <div>
                      <span className="font-mono text-[13px] font-semibold" style={{ color: "var(--seafoam)" }}>{t.name}</span>
                      <span className="ml-3 text-[12px]" style={{ color: "var(--ink-dim)" }}>{t.description}</span>
                    </div>
                    <span className="shrink-0 font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
                      {fmtInt(t.count)}{t.name === "measurements" ? " (≈)" : ""} rows
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left font-mono text-[11.5px]">
                      <thead>
                        <tr>
                          {t.columns.map((c) => (
                            <th key={c} className="whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-wider"
                              style={{ background: "var(--panel-2)", color: "var(--ink-dim)", borderBottom: "1px solid var(--border)", fontSize: "9.5px" }}>
                              {c.replace(/_/g, " ")}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {t.rows.map((row, i) => (
                          <tr key={i} style={{ background: i % 2 ? "rgba(120,160,200,0.03)" : "transparent" }}>
                            {row.map((v, j) => (
                              <td key={j} className="whitespace-nowrap px-3 py-1.5"
                                style={{ color: typeof v === "number" ? "var(--seafoam-dim)" : "var(--ink-dim)", borderBottom: "1px solid var(--border-soft)" }}>
                                {fmtCell(v)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            <footer className="mt-12 border-t py-8 text-center text-[12px]" style={{ borderColor: "var(--border-soft)", color: "var(--ink-faint)" }}>
              Live from PostgreSQL + PostGIS · read-only · quality-controlled ARGO data
            </footer>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
