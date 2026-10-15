import { useEffect, useState } from "react";

interface SeasonalTip {
  season: string;
  species: string[];
  tip: string;
}
interface Source {
  name: string;
  detail: string;
  tag: string;
}
interface FisheriesData {
  sources: Source[];
  summary: {
    pfz_advisories: number;
    sst_observations: number;
    chlorophyll_observations: number;
    active_advisories: number;
    data_from: string | null;
    data_to: string | null;
  };
  active_pfz: { columns: string[]; rows: unknown[][] };
  recent_sst: { columns: string[]; rows: unknown[][] };
  recent_chl: { columns: string[]; rows: unknown[][] };
  pfz_geojson: GeoJSON.FeatureCollection;
  species: string[];
  example_questions: string[];
  seasonal_tips: SeasonalTip[];
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
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}` : s;
}

export default function FisheriesView({ onAsk }: { onAsk: (q: string) => void }) {
  const [data, setData] = useState<FisheriesData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/fisheries/overview")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed to load"))))
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="fc-how relative flex min-h-0 flex-1 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{ backgroundImage: "url('/1.png')", backgroundSize: "cover", backgroundPosition: "center" }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{ background: "linear-gradient(180deg, rgba(4,10,18,.74), rgba(4,10,18,.88))" }}
      />

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-8 py-10">
          <p
            className="font-mono text-[11px] uppercase tracking-widest"
            style={{ color: "var(--amber)" }}
          >
            Fisheries Intelligence
          </p>
          <h2
            className="mt-2 font-display text-[27px] font-semibold tracking-tight"
            style={{ color: "var(--ink)" }}
          >
            From ocean data to fishing grounds
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--ink-dim)" }}>
            Real-time PFZ advisories, SST maps, and chlorophyll data — ask in plain language
            where the fish are, and get a grounded answer backed by satellite observations.
          </p>

          {error && (
            <p
              className="mt-6 rounded-xl p-4 text-[13px]"
              style={{ background: "var(--panel)", border: "1px solid var(--coral)", color: "var(--coral)" }}
            >
              Fisheries data is not loaded yet ({error}). The tables need to be populated
              with PFZ, SST, and chlorophyll data.
            </p>
          )}

          {!data && !error && (
            <p className="mt-6 text-[13px]" style={{ color: "var(--ink-faint)" }}>
              Loading fisheries overview...
            </p>
          )}

          {data && (
            <>
              {/* Summary stats */}
              <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {[
                  ["PFZ Advisories", fmtInt(data.summary.pfz_advisories)],
                  ["Active Now", fmtInt(data.summary.active_advisories)],
                  ["SST Obs", fmtInt(data.summary.sst_observations)],
                  ["Chlorophyll Obs", fmtInt(data.summary.chlorophyll_observations)],
                ].map(([l, v]) => (
                  <div key={l} className="fc-panel p-4">
                    <p className="font-display text-[20px] font-semibold" style={{ color: "var(--ink)" }}>
                      {v}
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>
                      {l}
                    </p>
                  </div>
                ))}
              </div>

              {/* Ask a fisheries question */}
              <h3 className="mt-9 font-display text-[17px] font-semibold" style={{ color: "var(--ink)" }}>
                Ask about fishing conditions
              </h3>
              <p className="mt-1 text-[12.5px]" style={{ color: "var(--ink-faint)" }}>
                Click any question to get a grounded answer with map and data.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.example_questions.map((q) => (
                  <button
                    key={q}
                    onClick={() => onAsk(q)}
                    className="fc-chip px-3 py-2 text-left text-[12.5px]"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Active species */}
              {data.species.length > 0 && (
                <>
                  <h3 className="mt-9 font-display text-[17px] font-semibold" style={{ color: "var(--ink)" }}>
                    Species in active advisories
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {data.species.map((s) => (
                      <button
                        key={s}
                        onClick={() => onAsk(`Which fishing zones have ${s} right now?`)}
                        className="rounded-full px-3 py-1.5 font-mono text-[11px] transition"
                        style={{
                          background: "rgba(246,187,82,.12)",
                          color: "var(--amber)",
                          border: "1px solid rgba(246,187,82,.25)",
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Seasonal guide */}
              <h3 className="mt-9 font-display text-[17px] font-semibold" style={{ color: "var(--ink)" }}>
                Seasonal fishing guide
              </h3>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                {data.seasonal_tips.map((tip) => (
                  <div key={tip.season} className="fc-panel p-4">
                    <span
                      className="rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider"
                      style={{
                        background: "rgba(53,224,192,.14)",
                        color: "var(--seafoam)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {tip.season}
                    </span>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {tip.species.map((s) => (
                        <span
                          key={s}
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{ background: "rgba(246,187,82,.12)", color: "var(--amber)" }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--ink-dim)" }}>
                      {tip.tip}
                    </p>
                  </div>
                ))}
              </div>

              {/* Data sources */}
              <h3 className="mt-9 font-display text-[17px] font-semibold" style={{ color: "var(--ink)" }}>
                Where the fisheries data comes from
              </h3>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                {data.sources.map((s) => (
                  <div key={s.name} className="fc-panel p-4">
                    <span
                      className="rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider"
                      style={{
                        background: "rgba(246,187,82,.14)",
                        color: "var(--amber)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {s.tag}
                    </span>
                    <p className="mt-2 font-display text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>
                      {s.name}
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--ink-dim)" }}>
                      {s.detail}
                    </p>
                  </div>
                ))}
              </div>

              {/* Active PFZ table */}
              {data.active_pfz.rows.length > 0 && (
                <>
                  <h3 className="mt-9 font-display text-[17px] font-semibold" style={{ color: "var(--ink)" }}>
                    Active PFZ advisories
                  </h3>
                  <div className="mt-3 fc-panel overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left font-mono text-[11.5px]">
                        <thead>
                          <tr>
                            {data.active_pfz.columns.map((c) => (
                              <th
                                key={c}
                                className="whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-wider"
                                style={{
                                  background: "var(--panel-2)",
                                  color: "var(--ink-dim)",
                                  borderBottom: "1px solid var(--border)",
                                  fontSize: "9.5px",
                                }}
                              >
                                {c.replace(/_/g, " ")}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.active_pfz.rows.map((row, i) => (
                            <tr
                              key={i}
                              style={{ background: i % 2 ? "rgba(120,160,200,0.03)" : "transparent" }}
                            >
                              {row.map((v, j) => (
                                <td
                                  key={j}
                                  className="whitespace-nowrap px-3 py-1.5"
                                  style={{
                                    color: typeof v === "number" ? "var(--seafoam-dim)" : "var(--ink-dim)",
                                    borderBottom: "1px solid var(--border-soft)",
                                  }}
                                >
                                  {fmtCell(v)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* Recent SST */}
              {data.recent_sst.rows.length > 0 && (
                <>
                  <h3 className="mt-9 font-display text-[17px] font-semibold" style={{ color: "var(--ink)" }}>
                    Recent SST observations
                  </h3>
                  <div className="mt-3 fc-panel overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left font-mono text-[11.5px]">
                        <thead>
                          <tr>
                            {data.recent_sst.columns.map((c) => (
                              <th
                                key={c}
                                className="whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-wider"
                                style={{
                                  background: "var(--panel-2)",
                                  color: "var(--ink-dim)",
                                  borderBottom: "1px solid var(--border)",
                                  fontSize: "9.5px",
                                }}
                              >
                                {c.replace(/_/g, " ")}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.recent_sst.rows.map((row, i) => (
                            <tr
                              key={i}
                              style={{ background: i % 2 ? "rgba(120,160,200,0.03)" : "transparent" }}
                            >
                              {row.map((v, j) => (
                                <td
                                  key={j}
                                  className="whitespace-nowrap px-3 py-1.5"
                                  style={{
                                    color: typeof v === "number" ? "var(--seafoam-dim)" : "var(--ink-dim)",
                                    borderBottom: "1px solid var(--border-soft)",
                                  }}
                                >
                                  {fmtCell(v)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* Recent Chlorophyll */}
              {data.recent_chl.rows.length > 0 && (
                <>
                  <h3 className="mt-9 font-display text-[17px] font-semibold" style={{ color: "var(--ink)" }}>
                    Recent chlorophyll observations
                  </h3>
                  <div className="mt-3 fc-panel overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left font-mono text-[11.5px]">
                        <thead>
                          <tr>
                            {data.recent_chl.columns.map((c) => (
                              <th
                                key={c}
                                className="whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-wider"
                                style={{
                                  background: "var(--panel-2)",
                                  color: "var(--ink-dim)",
                                  borderBottom: "1px solid var(--border)",
                                  fontSize: "9.5px",
                                }}
                              >
                                {c.replace(/_/g, " ")}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.recent_chl.rows.map((row, i) => (
                            <tr
                              key={i}
                              style={{ background: i % 2 ? "rgba(120,160,200,0.03)" : "transparent" }}
                            >
                              {row.map((v, j) => (
                                <td
                                  key={j}
                                  className="whitespace-nowrap px-3 py-1.5"
                                  style={{
                                    color: typeof v === "number" ? "var(--seafoam-dim)" : "var(--ink-dim)",
                                    borderBottom: "1px solid var(--border-soft)",
                                  }}
                                >
                                  {fmtCell(v)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* Offline-friendly summary */}
              <div
                className="mt-9 fc-panel p-5"
                style={{ border: "1px solid rgba(246,187,82,.25)" }}
              >
                <div className="flex items-center gap-2">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: "var(--amber)" }}
                  >
                    <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
                  </svg>
                  <h3 className="font-display text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
                    Works offline too
                  </h3>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: "var(--ink-dim)" }}>
                  Answers are generated from pre-loaded data using an offline rule engine when
                  there's no internet connectivity. Fishermen at sea get the same grounded answers
                  from the last synced PFZ advisories, SST data, and chlorophyll observations.
                  The app will auto-sync when connectivity returns.
                </p>
              </div>

              <footer
                className="mt-12 border-t py-8 text-center text-[12px]"
                style={{ borderColor: "var(--border-soft)", color: "var(--ink-faint)" }}
              >
                Fisheries data from NOAA OISST · NOAA VIIRS · derived fishing zones · combined with
                ARGO ocean-float measurements — every row carries its source
              </footer>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
