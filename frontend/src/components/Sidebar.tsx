/* Left icon rail. Items switch the main view or the results tab. */

export type NavKey = "chat" | "map" | "chart" | "table" | "data" | "fisheries" | "query" | "saved" | "about";

const S = { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const ITEMS: { key: NavKey; label: string; icon: JSX.Element }[] = [
  { key: "chat", label: "Chat", icon: <svg {...S}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg> },
  { key: "map", label: "Map", icon: <svg {...S}><path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3zM9 3v15M15 6v15" /></svg> },
  { key: "chart", label: "Chart", icon: <svg {...S}><path d="M3 3v18h18M7 15l3-4 3 3 5-7" /></svg> },
  { key: "table", label: "Table", icon: <svg {...S}><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M3 10h18M3 15h18M10 4v16" /></svg> },
  { key: "data", label: "Data", icon: <svg {...S}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></svg> },
  { key: "fisheries", label: "Fisheries", icon: <svg {...S}><path d="M2 16s1-4 5-4 5 6 9 6 5-4 5-4" /><path d="M2 12s1-4 5-4 5 6 9 6 5-4 5-4" /><circle cx="18" cy="8" r="1.5" fill="currentColor" stroke="none" /></svg> },
  { key: "query", label: "Query", icon: <svg {...S}><path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 6l-2 12" /></svg> },
  { key: "saved", label: "Saved", icon: <svg {...S}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg> },
  { key: "about", label: "About", icon: <svg {...S}><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></svg> },
];

export default function Sidebar({
  active,
  onSelect,
  theme,
  onTheme,
}: {
  active: NavKey;
  onSelect: (k: NavKey) => void;
  theme: "dark" | "light";
  onTheme: (t: "dark" | "light") => void;
}) {
  return (
    <nav
      className="flex w-[68px] shrink-0 flex-col items-center py-3"
      style={{ borderRight: "1px solid var(--border-soft)", background: "var(--deep)" }}
    >
      <div
        className="mb-4 grid h-10 w-10 place-items-center rounded-xl"
        style={{ background: "linear-gradient(145deg,#123,#0a1a2e)", border: "1px solid var(--border)", boxShadow: "var(--glow)" }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M4 5.5h13a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-2.5 2.5H10l-3.5 3v-3H4a2.5 2.5 0 0 1-2.5-2.5V8A2.5 2.5 0 0 1 4 5.5z" stroke="var(--seafoam)" strokeWidth="1.5" />
          <path d="M5.5 11.2q2-2.4 4 0t4 0" stroke="var(--seafoam)" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="5.5" cy="11.2" r="1.15" fill="var(--amber)" />
        </svg>
      </div>

      <div className="flex flex-1 flex-col items-center gap-1">
        {ITEMS.map((it) => {
          const on = active === it.key;
          return (
            <button
              key={it.key}
              onClick={() => onSelect(it.key)}
              title={it.label}
              className="group relative flex w-14 flex-col items-center gap-1 rounded-xl py-2 transition"
              style={{ background: on ? "var(--panel)" : "transparent", color: on ? "var(--seafoam)" : "var(--ink-faint)" }}
            >
              {on && <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r" style={{ background: "var(--seafoam)" }} />}
              {it.icon}
              <span className="text-[9.5px] font-medium">{it.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-col items-center">
        <div className="flex flex-col gap-1 rounded-xl p-1" style={{ background: "var(--panel)", border: "1px solid var(--border-soft)" }} title="Theme">
          <button
            onClick={() => onTheme("light")}
            title="Light mode"
            className="grid h-7 w-7 place-items-center rounded-lg transition"
            style={{ background: theme === "light" ? "var(--raised)" : "transparent", color: theme === "light" ? "var(--amber)" : "var(--ink-faint)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          </button>
          <button
            onClick={() => onTheme("dark")}
            title="Dark mode"
            className="grid h-7 w-7 place-items-center rounded-lg transition"
            style={{ background: theme === "dark" ? "var(--raised)" : "transparent", color: theme === "dark" ? "var(--seafoam)" : "var(--ink-faint)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
