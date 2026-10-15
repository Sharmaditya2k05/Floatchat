import { useEffect } from "react";
import type { ResultTab } from "../App";
import type { ChatResponse } from "../types";
import ChartView from "./ChartView";
import MapView from "./MapView";
import SqlPanel from "./SqlPanel";
import TableView from "./TableView";

export default function ResultsPanel({
  response,
  tab,
  onTab,
}: {
  response: ChatResponse | null;
  tab: ResultTab;
  onTab: (t: ResultTab) => void;
}) {
  useEffect(() => {
    if (!response) return;
    if (response.chart_kind === "profile" || response.chart_kind === "timeseries") onTab("chart");
    else if (response.chart_kind === "map") onTab("map");
    else onTab("table");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  if (!response) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl text-center"
        style={{ border: "1px dashed var(--border)", color: "var(--ink-faint)" }}>
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" opacity="0.5">
          <path d="M4 5.5h13a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-2.5 2.5H10l-3.5 3v-3H4a2.5 2.5 0 0 1-2.5-2.5V8A2.5 2.5 0 0 1 4 5.5z" stroke="var(--seafoam)" strokeWidth="1.5" />
          <circle cx="7" cy="11" r="1.2" fill="var(--amber)" />
        </svg>
        <p className="max-w-[240px] text-[13px]">Ask a question to see the map, chart, table, and the SQL behind it.</p>
      </div>
    );
  }

  const tabs: { id: ResultTab; label: string; count?: number }[] = [
    { id: "map", label: "Map" },
    { id: "chart", label: "Chart" },
    { id: "table", label: "Table", count: response.row_count },
  ];
  const legend = mapLegend(response);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--panel)", border: "1px solid var(--border-soft)" }}>
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => onTab(t.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] transition"
              style={{ background: active ? "var(--raised)" : "transparent", color: active ? "var(--ink)" : "var(--ink-faint)", fontWeight: active ? 600 : 500 }}>
              {t.label}
              {t.count !== undefined && (
                <span className="rounded-full px-1.5 text-[10px] font-mono"
                  style={{ background: active ? "rgba(53,224,192,0.14)" : "var(--panel-2)", color: active ? "var(--seafoam)" : "var(--ink-faint)" }}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="fc-panel min-h-0 flex-1 overflow-hidden">
        {tab === "map" && <MapView geojson={response.geojson} legend={legend} />}
        {tab === "chart" && <ChartView response={response} />}
        {tab === "table" && <TableView columns={response.columns} rows={response.rows} />}
      </div>

      <SqlPanel sql={response.sql} engine={response.engine} floatIds={response.float_ids} />
    </div>
  );
}

function mapLegend(r: ChatResponse): string {
  const q = r.question.toLowerCase();
  const yr = q.match(/\b(20\d\d)\b/);
  const region = /arabian/.test(q) ? "Arabian Sea" : /bengal|bob/.test(q) ? "Bay of Bengal"
    : /equator/.test(q) ? "Near equator" : "Indian Ocean";
  return yr ? `${region} · ${yr[1]}` : region;
}
