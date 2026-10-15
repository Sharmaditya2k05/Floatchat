import { useEffect, useState } from "react";

// Shown once per browser session: this deployment only holds a slice of the
// ARGO archive, so questions outside that window return no rows.
const KEY = "fc-data-limit-seen";

function monthYear(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString([], { month: "short", year: "numeric" });
}

export default function DataLimitNotice() {
  const [open, setOpen] = useState(() => {
    try { return sessionStorage.getItem(KEY) !== "1"; } catch { return true; }
  });
  const [range, setRange] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/data/overview").then((r) => r.json())
      .then((d) => {
        const from = monthYear(d?.summary?.time_from);
        const to = monthYear(d?.summary?.time_to);
        if (from && to) setRange(from === to ? from : `${from} – ${to}`);
      })
      .catch(() => { /* keep the generic wording */ });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    try { sessionStorage.setItem(KEY, "1"); } catch { /* private mode */ }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(3, 7, 14, 0.62)", backdropFilter: "blur(3px)" }}
      onClick={close}>
      <div role="dialog" aria-modal="true" aria-labelledby="fc-limit-title"
        className="w-full max-w-[440px] rounded-2xl p-6"
        style={{ background: "var(--panel)", border: "1px solid var(--border)", boxShadow: "0 24px 60px -20px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: "color-mix(in srgb, var(--amber) 16%, transparent)", color: "var(--amber)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 id="fc-limit-title" className="font-display text-[17px] font-semibold leading-tight" style={{ color: "var(--ink)" }}>
              Limited dataset on this server
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--ink-dim)" }}>
              Because of storage and memory limits on this free-tier server, only part of the ARGO archive is loaded.
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-2 rounded-xl p-3.5 text-[13px]"
          style={{ background: "var(--panel-2)", border: "1px solid var(--border-soft)", color: "var(--ink-dim)" }}>
          <li>
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>ARGO floats:</span>{" "}
            Indian Ocean, {range ?? "a limited time window"}
          </li>
          <li>
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>Fisheries:</span>{" "}
            last 14 days of satellite SST and chlorophyll, refreshed daily
          </li>
        </ul>

        <p className="mt-3 text-[12.5px]" style={{ color: "var(--ink-faint)" }}>
          Questions about dates outside this window will return no matching records.
        </p>

        <div className="mt-5 flex justify-end">
          <button onClick={close} autoFocus
            className="rounded-lg px-4 py-2 text-[13px] font-semibold transition hover:opacity-90"
            style={{ background: "var(--seafoam)", color: "var(--abyss)" }}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
