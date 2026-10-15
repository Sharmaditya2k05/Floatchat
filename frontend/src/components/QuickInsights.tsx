import type { ChatResponse } from "../types";

/* Four KPI tiles derived from the current result — mirrors a dashboard
   summary. Everything shown is computed from the returned rows. */

type Tile = { icon: JSX.Element; label: string; value: string; sub: string; color: string };

/** Find a numeric metric column by fuzzy name match (handles LLM-varied
 *  aliases like mean_temperature / avg_surface_temp_c / max_salinity). */
function detectMetric(cols: string[], rows: unknown[][]): { col: string; name: string; unit: string } | null {
  for (const c of cols) {
    const lc = c.toLowerCase();
    if (/lat|lon|wmo|cycle|profile_id|\bmonth\b|time|date|\byear\b|count|\bn_/.test(lc)) continue;
    const i = cols.indexOf(c);
    if (!rows.some((r) => typeof r[i] === "number")) continue;
    if (/temp|sst/.test(lc)) return { col: c, name: "Temperature", unit: "°C" };
    if (/sal|psal/.test(lc)) return { col: c, name: "Salinity", unit: "PSU" };
    if (/depth/.test(lc)) return { col: c, name: "Depth", unit: "m" };
    if (/pres/.test(lc)) return { col: c, name: "Pressure", unit: "dbar" };
  }
  return null;
}

function fmt(v: number, unit: string): string {
  const s = Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(unit === "PSU" ? 2 : 1);
  return `${s} ${unit}`.trim();
}

function nums(rows: unknown[][], i: number): number[] {
  return rows.map((r) => r[i]).filter((v): v is number => typeof v === "number");
}

export default function QuickInsights({ r }: { r: ChatResponse }) {
  const tiles = buildTiles(r);
  if (!tiles.length) return null;
  return (
    <div className="fc-panel p-4">
      <p className="mb-3 font-display text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Quick insights</p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl p-3" style={{ background: "var(--panel-2)", border: "1px solid var(--border-soft)" }}>
            <div className="mb-2" style={{ color: t.color }}>{t.icon}</div>
            <p className="text-[11px]" style={{ color: "var(--ink-dim)" }}>{t.label}</p>
            <p className="mt-0.5 font-display text-[17px] font-semibold leading-tight" style={{ color: "var(--ink)" }}>{t.value}</p>
            <p className="mt-0.5 text-[10.5px]" style={{ color: "var(--ink-faint)" }}>{t.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildTiles(r: ChatResponse): Tile[] {
  const tiles: Tile[] = [];
  const cols = r.columns;

  // primary metric column (fuzzy match on the returned columns)
  const detected = detectMetric(cols, r.rows);
  const mi = detected ? cols.indexOf(detected.col) : -1;
  const meta = detected;
  const vals = mi >= 0 ? nums(r.rows, mi) : [];

  if (meta && vals.length) {
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const icon = meta.name === "Temperature" ? <ThermoIcon /> : <WaveIcon />;
    tiles.push({
      icon, color: "var(--amber)",
      label: `Mean ${meta.name}`,
      value: fmt(mean, meta.unit),
      sub: contextSub(r),
    });
    if (vals.length > 1) {
      const yr = r.question.match(/\b(20\d\d)\b/);
      tiles.push({
        icon: <RangeIcon />, color: "var(--seafoam)",
        label: `${meta.name} Range`,
        value: `${fmt(Math.min(...vals), "")} – ${fmt(Math.max(...vals), meta.unit)}`,
        sub: yr ? `Min – Max in ${yr[1]}` : "Min – Max",
      });
    }
  }

  // a count tile: months (time series) / floats / rows
  if (r.chart_kind === "timeseries") {
    tiles.push({ icon: <CalIcon />, color: "#7aa2ff", label: "Months Analyzed", value: String(r.row_count), sub: monthRange(r) });
  } else if (r.float_ids.length) {
    tiles.push({ icon: <FloatIcon />, color: "#7aa2ff", label: "Floats", value: String(r.float_ids.length), sub: "Distinct WMO ids" });
  } else {
    tiles.push({ icon: <RowsIcon />, color: "#7aa2ff", label: "Rows Returned", value: String(r.row_count), sub: "Matching records" });
  }

  // data source (always)
  tiles.push({ icon: <WaveIcon />, color: "var(--seafoam)", label: "Data Source", value: "ARGO Floats", sub: "Real-time · Quality controlled" });

  // if no metric, prepend a headline tile from the single-row result
  if (!meta && r.rows.length === 1) {
    const firstNum = cols.findIndex((_, i) => typeof r.rows[0][i] === "number");
    if (firstNum >= 0) {
      tiles.unshift({
        icon: <RangeIcon />, color: "var(--amber)",
        label: cols[firstNum].replace(/_/g, " "),
        value: String(r.rows[0][firstNum]),
        sub: contextSub(r),
      });
    }
  }

  return tiles.slice(0, 4);
}

function monthRange(r: ChatResponse): string {
  const xs = r.series?.x ?? [];
  if (xs.length < 1) return "Monthly";
  const fmtMon = (v: unknown) => {
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? String(v) : d.toLocaleString("en", { month: "short", year: "numeric" });
  };
  const first = fmtMon(xs[0]);
  const last = fmtMon(xs[xs.length - 1]);
  return first === last ? first : `${first} – ${last}`;
}

function contextSub(r: ChatResponse): string {
  const q = r.question.toLowerCase();
  const yr = q.match(/\b(20\d\d)\b/);
  const region = /arabian/.test(q) ? "Arabian Sea" : /bengal|bob/.test(q) ? "Bay of Bengal" :
    /equator/.test(q) ? "Near equator" : "Indian Ocean";
  return yr ? `${region} (${yr[1]})` : region;
}

/* --- small inline icons --- */
const S = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const ThermoIcon = () => <svg {...S}><path d="M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0z" /></svg>;
const RangeIcon = () => <svg {...S}><path d="M3 17l6-6 4 4 8-8" /><path d="M17 7h4v4" /></svg>;
const CalIcon = () => <svg {...S}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
const FloatIcon = () => <svg {...S}><circle cx="12" cy="6" r="2.5" /><path d="M12 9v4M8 20c0-3 1-5 4-7 3 2 4 4 4 7" /></svg>;
const RowsIcon = () => <svg {...S}><rect x="3" y="4" width="18" height="4" rx="1" /><rect x="3" y="10" width="18" height="4" rx="1" /><rect x="3" y="16" width="18" height="4" rx="1" /></svg>;
const WaveIcon = () => <svg {...S}><path d="M2 8c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0M2 14c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0" /></svg>;
