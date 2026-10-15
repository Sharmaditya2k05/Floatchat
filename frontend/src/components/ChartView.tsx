import Plotly from "plotly.js-dist-min";
import { useEffect, useRef } from "react";
import type { ChatResponse } from "../types";

export default function ChartView({ response }: { response: ChatResponse }) {
  const divRef = useRef<HTMLDivElement>(null);
  const series = response.series;

  useEffect(() => {
    if (!divRef.current || !series) return;

    const plot = () => {
      if (!divRef.current) return;
      const cs = getComputedStyle(document.documentElement);
      const isLight = document.documentElement.dataset.theme === "light";
      const v = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
      const ink = v("--ink-dim", "#9fb2c8");
      const faint = v("--ink-faint", "#61789a");
      const seafoam = v("--seafoam", "#35e0c0");
      const amber = v("--amber", "#f5b544");
      const panel = v("--panel", "#0e1826");
      const grid = isLight ? "rgba(20,45,70,0.10)" : "rgba(120,160,200,0.12)";
      const zero = isLight ? "rgba(20,45,70,0.18)" : "rgba(120,160,200,0.2)";
      const isProfile = series.kind === "profile";

      const trace = {
        x: series.x, y: series.y, mode: "lines+markers",
        line: { color: seafoam, width: 2.2, shape: isProfile ? "spline" : "linear" },
        marker: { size: 6, color: amber, line: { color: panel, width: 1 } },
        fill: isProfile ? undefined : "tozeroy",
        fillcolor: isLight ? "rgba(14,154,134,0.10)" : "rgba(53,224,192,0.08)",
      };
      const axis = { gridcolor: grid, zerolinecolor: zero, linecolor: zero, tickfont: { color: ink, size: 11 }, titlefont: { color: faint, size: 12 } };
      const layout = {
        paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
        font: { family: "Inter, sans-serif", color: ink },
        margin: { t: 24, r: 22, b: 48, l: 62 },
        xaxis: { ...axis, title: { text: prettify(series.x_label) }, side: isProfile ? ("top" as const) : ("bottom" as const) },
        yaxis: { ...axis, title: { text: prettify(series.y_label) }, autorange: isProfile ? ("reversed" as const) : true },
      };
      Plotly.react(divRef.current, [trace], layout, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["lasso2d", "select2d"] });
    };

    plot();
    const obs = new MutationObserver(plot);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      obs.disconnect();
      if (divRef.current) Plotly.purge(divRef.current);
    };
  }, [series]);

  if (!series) {
    return (
      <div className="flex h-full items-center justify-center text-[13px]" style={{ color: "var(--ink-faint)" }}>
        No chartable series for this query — see the Table or Map tab.
      </div>
    );
  }
  return <div ref={divRef} className="h-full w-full" />;
}

function prettify(label: string): string {
  return label.replace(/_/g, " ").replace("psu", "(PSU)").replace("temp c", "temperature (°C)").replace("depth m", "depth (m)");
}
