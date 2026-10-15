export default function TableView({
  columns,
  rows,
}: {
  columns: string[];
  rows: unknown[][];
}) {
  if (!rows.length) {
    return (
      <div
        className="flex h-full items-center justify-center text-[13px]"
        style={{ color: "var(--ink-faint)" }}
      >
        The query returned no rows.
      </div>
    );
  }
  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse text-left font-mono text-[11.5px]">
        <thead className="sticky top-0 z-10">
          <tr>
            {columns.map((c) => (
              <th
                key={c}
                className="px-3 py-2.5 font-semibold uppercase tracking-wider"
                style={{
                  background: "var(--panel-2)",
                  color: "var(--ink-dim)",
                  borderBottom: "1px solid var(--border)",
                  fontSize: "10px",
                }}
              >
                {c.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 500).map((row, i) => (
            <tr
              key={i}
              style={{
                background: i % 2 ? "rgba(120,160,200,0.03)" : "transparent",
              }}
            >
              {row.map((v, j) => (
                <td
                  key={j}
                  className="px-3 py-1.5"
                  style={{
                    color:
                      typeof v === "number" ? "var(--seafoam-dim)" : "var(--ink-dim)",
                    borderBottom: "1px solid var(--border-soft)",
                  }}
                >
                  {v === null
                    ? "—"
                    : typeof v === "number"
                      ? Number.isInteger(v)
                        ? v
                        : v.toFixed(3)
                      : String(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
