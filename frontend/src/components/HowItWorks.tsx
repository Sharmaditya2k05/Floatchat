import { useState } from "react";

/* ================================================================== *
 *  FloatChat — "How it works".
 *  Comprehensive but approachable: every part of the project explained,
 *  in plain language, with light visuals and a few interactive bits
 *  (the step-by-step flow, the pipeline tabs, and the glossary).
 * ================================================================== */

const SECTIONS = [
  ["what", "What is FloatChat?"],
  ["problem", "Why it exists"],
  ["floats", "What's a “float”?"],
  ["data", "The data, cleaned"],
  ["fisheries", "For fishermen too"],
  ["architecture", "How it's put together"],
  ["how", "Your question, step by step"],
  ["pipeline", "A closer look"],
  ["honest", "How we keep it honest"],
  ["built", "What it's built with"],
  ["multilingual", "In your language"],
  ["words", "Words, explained"],
];

export default function HowItWorks() {
  return (
    <div className="fc-how relative flex min-h-0 flex-1 overflow-hidden">
      {/* Deep-sea background: an SVG scene as the always-available base, with
          the real photo layered on top when frontend/public/how-bg.jpg exists
          (a missing background-image just renders transparent, revealing the
          SVG), then a scrim so text stays readable. */}
      <div className="pointer-events-none absolute inset-0 z-0"><DeepSeaScene /></div>
      <div className="pointer-events-none absolute inset-0 z-0"
        style={{ backgroundImage: "url('/content.png')", backgroundSize: "cover", backgroundPosition: "center" }} />
      <div className="pointer-events-none absolute inset-0 z-0"
        style={{ background: "linear-gradient(180deg, rgba(4,10,18,.5), rgba(4,10,18,.7))" }} />

      <SideNav />
      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-10">
          <What />
          <Problem />
          <Floats />
          <DataCleaned />
          <Fisheries />
          <Architecture />
          <How />
          <PipelineDetail />
          <Honest />
          <Built />
          <Multilingual />
          <Words />
          <footer
            className="mt-16 border-t py-8 text-center text-[12px]"
            style={{ borderColor: "var(--border-soft)", color: "var(--ink-faint)" }}
          >
            FloatChat · ANALYTICA 2026 · PS26-033 · ocean data from the global ARGO programme (MoES / INCOIS)
          </footer>
        </div>
      </div>
    </div>
  );
}

/* ------------------------- shared bits --------------------------- */
function SideNav() {
  const [active, setActive] = useState("what");
  return (
    <nav
      className="relative z-10 hidden w-56 shrink-0 overflow-y-auto px-4 py-10 lg:block"
      style={{ borderRight: "1px solid var(--border-soft)" }}
    >
      <p className="mb-3 px-3 font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>
        On this page
      </p>
      <ul className="space-y-1">
        {SECTIONS.map(([id, label]) => (
          <li key={id}>
            <a
              href={`#${id}`}
              onClick={() => setActive(id)}
              className="block rounded-lg px-3 py-1.5 text-[13px] transition"
              style={{
                color: active === id ? "var(--seafoam)" : "var(--ink-dim)",
                background: active === id ? "rgba(53,224,192,0.08)" : "transparent",
              }}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 border-t py-11 first:border-t-0 first:pt-0"
      style={{ borderColor: "var(--border-soft)" }}>
      <h2 className="font-display text-[27px] font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
        {title}
      </h2>
      {intro && (
        <p className="mt-3 text-[16px] leading-relaxed" style={{ color: "var(--ink)" }}>{intro}</p>
      )}
      <div className="mt-5 space-y-4 text-[14.5px] leading-relaxed" style={{ color: "var(--ink-dim)" }}>
        {children}
      </div>
    </section>
  );
}

function Card({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--panel)", border: `1px solid ${accent ?? "var(--border-soft)"}` }}>
      {children}
    </div>
  );
}

/* ============================= WHAT ============================== */
function What() {
  const steps = [
    ["1", "You ask", "A question in plain English or an Indian language — like “how salty is the water near the equator in March 2023?”", "var(--seafoam)"],
    ["2", "We look it up", "FloatChat turns it into a database search and runs it over real ocean measurements.", "var(--amber)"],
    ["3", "You see the answer", "A one-line answer, a map of the floats, and a chart — plus the exact search it ran, so you can trust it.", "#7aa2ff"],
  ];
  return (
    <Section id="what" title="What is FloatChat?"
      intro="FloatChat lets anyone explore ocean data just by asking a question — no special software, no file formats, no training needed.">
      <p>
        Scientists have measured the ocean for decades using floating robots. That data is hugely useful, but
        it normally lives inside technical files only a few experts can open. FloatChat removes that barrier:
        you ask in everyday words, and it hands back a clear, trustworthy answer.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {steps.map(([n, title, body, color]) => (
          <div key={n} className="rounded-xl p-4" style={{ background: "var(--panel)", border: "1px solid var(--border-soft)" }}>
            <div className="grid h-8 w-8 place-items-center rounded-full font-display text-[15px] font-bold"
              style={{ background: `${color}22`, color: color as string, border: `1px solid ${color}55` }}>{n}</div>
            <p className="mt-3 font-display text-[15px] font-semibold" style={{ color: "var(--ink)" }}>{title}</p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--ink-dim)" }}>{body}</p>
          </div>
        ))}
      </div>
      <Card accent="var(--seafoam)44">
        <p className="text-[14px]">
          <strong style={{ color: "var(--seafoam)" }}>The golden rule:</strong> every answer is “grounded”.
          FloatChat only shows numbers that came from a real search over real records — and always shows the
          search and the floats it used. It never makes numbers up.
        </p>
      </Card>
    </Section>
  );
}

/* ============================ PROBLEM =========================== */
function Problem() {
  const personas = [
    ["Ocean scientist", "“Average salinity in the Arabian Sea in 2022, from 0 to 200 m.”"],
    ["Student", "“Show me a temperature-vs-depth graph for float 2902xxx.”"],
    ["Fisherman", "“Is the water warm enough for tuna near Kochi this week?”"],
    ["Fisheries officer", "“Which fishing zones have sardine right now?”"],
    ["Policy analyst", "“How did surface temperature near the equator change month by month?”"],
    ["Curious member of the public", "“How many active floats are in the Bay of Bengal?”"],
  ];
  return (
    <Section id="problem" title="Why it exists"
      intro="The ocean data exists and is public — but it's locked behind formats and tools only specialists know.">
      <p>
        The measurements ship as <strong style={{ color: "var(--amber)" }}>NetCDF</strong> files with their own
        conventions, opened through specialist software. In practice only a small group of trained scientists
        can pull out and chart what they need. Students, officials, fisheries officers — even many researchers —
        are effectively locked out. FloatChat opens the door to all of them.
      </p>
      <div>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>Who it's for</p>
        <div className="space-y-2">
          {personas.map(([who, q]) => (
            <div key={who} className="flex flex-col gap-0.5 rounded-lg p-3 sm:flex-row sm:items-baseline sm:gap-3"
              style={{ background: "var(--panel)", border: "1px solid var(--border-soft)" }}>
              <span className="shrink-0 font-display text-[13px] font-semibold" style={{ color: "var(--seafoam)", minWidth: 190 }}>{who}</span>
              <span className="text-[13px]" style={{ color: "var(--ink-dim)" }}>{q}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Why", "So anyone can ask and get correct, visual answers — not just experts."],
          ["Where", "A pilot on the Indian Ocean (from the coast of Africa across to Indonesia)."],
          ["When", "A fixed, pre-loaded window of data, so a live demo never depends on the network."],
        ].map(([k, v]) => (
          <Card key={k as string}>
            <p className="font-display text-[14px] font-semibold" style={{ color: "var(--amber)" }}>{k}</p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--ink-dim)" }}>{v}</p>
          </Card>
        ))}
      </div>
      <p className="text-[13px]" style={{ color: "var(--ink-faint)" }}>
        The reference problem is ANALYTICA 2026 <strong>PS26-033</strong>, from India's Ministry of Earth
        Sciences and its ocean-information agency, INCOIS.
      </p>
    </Section>
  );
}

/* ============================ FLOATS =========================== */
function Floats() {
  return (
    <Section id="floats" title="What's a “float”?"
      intro="A float is a robot that drifts in the ocean — think of it as a weather balloon for the sea.">
      <p>
        About 4,000 of them operate worldwide as part of a global project called{" "}
        <strong style={{ color: "var(--seafoam)" }}>ARGO</strong>, running since the year 2000. Every ~10 days
        each float sinks about 2 km deep, then rises back up while recording the water. At the surface it beams
        its readings home by satellite. One trip up is called a{" "}
        <strong style={{ color: "var(--amber)" }}>profile</strong> — a stack of readings at many depths in one
        place and time.
      </p>
      <FloatCycleDiagram />
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Temperature", "how warm or cold the water is", "var(--amber)"],
          ["Salinity", "how salty the water is", "var(--seafoam)"],
          ["Depth", "how far down each reading was taken", "#7aa2ff"],
        ].map(([t, d, c]) => (
          <Card key={t as string}>
            <p className="font-display text-[15px] font-semibold" style={{ color: c as string }}>{t}</p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--ink-dim)" }}>{d}</p>
          </Card>
        ))}
      </div>
      <p className="text-[13px]" style={{ color: "var(--ink-faint)" }}>
        Each float has a unique ID number (its “WMO ID”), like a licence plate, so its whole history can be
        followed over time.
      </p>
    </Section>
  );
}

function FloatCycleDiagram() {
  return (
    <div className="overflow-x-auto rounded-xl p-4" style={{ background: "var(--abyss)", border: "1px solid var(--border-soft)" }}>
      <svg viewBox="0 0 560 190" width="100%" style={{ minWidth: 500 }}>
        <line x1="20" y1="28" x2="540" y2="28" stroke="var(--seafoam)" strokeWidth="1.5" opacity="0.6" />
        <text x="24" y="20" fill="var(--seafoam)" fontSize="11" fontFamily="monospace">surface — beams data home</text>
        <line x1="20" y1="165" x2="540" y2="165" stroke="var(--ink-faint)" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
        <text x="24" y="180" fill="var(--ink-faint)" fontSize="11" fontFamily="monospace">~2 km deep</text>
        <path d="M60 28 C 90 28, 100 165, 150 165 L 250 165 C 295 165, 295 28, 335 28"
          fill="none" stroke="var(--amber)" strokeWidth="2.5" strokeLinecap="round" />
        {[[300, 54], [307, 84], [315, 114], [325, 144]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3.5" fill="var(--seafoam)" />
        ))}
        <text x="346" y="32" fill="var(--ink)" fontSize="11" fontFamily="monospace">measures on the way up</text>
        <text x="150" y="156" fill="var(--ink-faint)" fontSize="10" fontFamily="monospace" textAnchor="middle">drifts ~10 days</text>
        <text x="78" y="108" fill="var(--amber)" fontSize="10" fontFamily="monospace">sinks</text>
        <text x="352" y="108" fill="var(--amber)" fontSize="10" fontFamily="monospace">rises</text>
      </svg>
    </div>
  );
}

/* =========================== DATA CLEANED ======================= */
function DataCleaned() {
  const qc = [
    ["1", "good", "var(--seafoam)", true],
    ["2", "probably good", "var(--seafoam)", true],
    ["3", "bad, correctable", "var(--amber)", false],
    ["4", "bad", "var(--coral)", false],
    ["9", "missing", "var(--coral)", false],
  ];
  return (
    <Section id="data" title="The data, cleaned"
      intro="Raw ocean readings are messy. Before FloatChat can trust them, they get a careful clean-up.">
      <p>
        Not every reading a float sends is reliable — sensors glitch, values go missing. So each measurement
        comes with a small <strong style={{ color: "var(--ink)" }}>quality tag</strong> from 1 (good) to 9
        (missing). FloatChat keeps only the trustworthy ones and throws the rest away.
      </p>
      <div className="flex flex-wrap gap-2">
        {qc.map(([flag, label, color, keep]) => (
          <div key={flag as string} className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: "var(--panel)", border: `1px solid ${keep ? "var(--seafoam)" : "var(--border-soft)"}55` }}>
            <span className="font-mono text-[13px] font-semibold" style={{ color: color as string }}>{flag}</span>
            <span className="text-[12px]" style={{ color: "var(--ink-dim)" }}>{label}</span>
            <span className="text-[10px]" style={{ color: keep ? "var(--seafoam)" : "var(--ink-faint)" }}>{keep ? "keep" : "drop"}</span>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="font-display text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Corrected values preferred</p>
          <p className="mt-1 text-[13px]" style={{ color: "var(--ink-dim)" }}>
            Months later, scientists publish carefully corrected (“delayed-mode”) versions of the readings.
            When a good corrected value exists, FloatChat uses it instead of the raw one.
          </p>
        </Card>
        <Card>
          <p className="font-display text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Depth done properly</p>
          <p className="mt-1 text-[13px]" style={{ color: "var(--ink-dim)" }}>
            Floats actually measure pressure, not depth. FloatChat converts pressure to true depth in metres
            (using the standard TEOS-10 formula), so a filter like “above 200 m” is exact.
          </p>
        </Card>
      </div>
      <Card accent="var(--border)">
        <p className="text-[13px]">
          <strong style={{ color: "var(--ink)" }}>Where the data comes from.</strong> The pilot uses the same
          Indian-Ocean ARGO floats catalogued by INCOIS on{" "}
          <span style={{ color: "var(--seafoam)" }}>data.gov.in</span>. That catalog entry is just a link with
          no file attached, so FloatChat pulls the identical floats from ARGO's official global data servers
          (via a tool called <span className="font-mono" style={{ color: "var(--amber)" }}>argopy</span>) —
          same floats, same quality flags, kept current.
        </p>
      </Card>
    </Section>
  );
}

/* =========================== FISHERIES ========================== */
function Fisheries() {
  const layers = [
    ["Fishing-zone advisories", "PFZ", "“Potential Fishing Zones” — where satellite readings suggest fish are gathering, which species, and until when. FloatChat derives these from the two grids below using INCOIS's own recipe, and can load official INCOIS advisories when exported.", "var(--amber)"],
    ["Sea-surface temperature", "SST", "Daily satellite maps of how warm the surface is (NOAA OISST). Tuna like ~20–30 °C, sardine ~22–28 °C — so temperature tells you who's likely around.", "var(--coral)"],
    ["Chlorophyll (ocean colour)", "Chl-a", "How green the water is, seen from satellite (NOAA VIIRS; ISRO OCM archives too). More chlorophyll = more plankton = more food = more fish.", "var(--seafoam)"],
  ];
  const examples = [
    "Current fishing zones near Kochi",
    "Is the water warm enough for tuna near Chennai?",
    "Which zones have sardine right now?",
    "Show me chlorophyll hotspots in the Bay of Bengal",
  ];
  return (
    <Section id="fisheries" title="For fishermen too"
      intro="The same engine that answers scientists also answers the people who go to sea. A separate Fisheries tab adds the three things fishermen actually look at.">
      <p>
        India has more than four million people who fish for a living. INCOIS already tells them where to go,
        but the satellite data behind those bulletins is out of reach. FloatChat pulls the same kind of data
        from open satellite feeds, loads it next to the float data, and lets you ask about it in your own
        words — and, because it lives in the same database, the same safety checks and the same “never make
        numbers up” rule apply. Every row records where it came from.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {layers.map(([title, tag, body, color]) => (
          <div key={tag as string} className="rounded-xl p-4" style={{ background: "var(--panel)", border: "1px solid var(--border-soft)" }}>
            <span className="rounded-full px-2 py-0.5 font-mono text-[10px]"
              style={{ background: `${color}22`, color: color as string, border: `1px solid ${color}55` }}>{tag}</span>
            <p className="mt-2 font-display text-[14.5px] font-semibold" style={{ color: "var(--ink)" }}>{title}</p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--ink-dim)" }}>{body}</p>
          </div>
        ))}
      </div>
      <FisheriesDiagram />
      <div>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>Ask it like this</p>
        <div className="flex flex-wrap gap-2">
          {examples.map((q) => (
            <span key={q} className="rounded-full px-3 py-1.5 text-[12.5px]" style={{ background: "var(--panel)", border: "1px solid var(--border-soft)", color: "var(--ink-dim)" }}>“{q}”</span>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="font-display text-[14px] font-semibold" style={{ color: "var(--ink)" }}>It knows the coast</p>
          <p className="mt-1 text-[13px]" style={{ color: "var(--ink-dim)" }}>
            Say a port — Kochi, Chennai, Visakhapatnam, Mumbai, Mangalore, Tuticorin, Paradip, Goa — and it
            looks near there. Say a fish — tuna, sardine, mackerel, seer fish, pomfret, hilsa, prawn — and it
            filters for it. “This week” and “right now” work too. Fish and place names are understood in Hindi,
            Tamil, Bengali, Telugu and Malayalam.
          </p>
        </Card>
        <Card>
          <p className="font-display text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Works when the signal drops</p>
          <p className="mt-1 text-[13px]" style={{ color: "var(--ink-dim)" }}>
            Out at sea there is often no internet. The rule-based backup answers from the last data that was
            synced, with no AI service needed — the same short, grounded answer, just from slightly older
            advisories. It catches up when the boat is back in range.
          </p>
        </Card>
      </div>
      <p className="text-[13px]" style={{ color: "var(--ink-faint)" }}>
        On the map, fishing zones show in <span style={{ color: "var(--amber)" }}>amber</span> and floats in{" "}
        <span style={{ color: "var(--seafoam)" }}>seafoam</span>; tap a zone to see its species, temperature and
        how long the advice is valid. A seasonal guide on the Fisheries tab explains which fish to expect in each
        monsoon period.
      </p>
    </Section>
  );
}

function FisheriesDiagram() {
  return (
    <div className="overflow-x-auto rounded-xl p-4" style={{ background: "var(--abyss)", border: "1px solid var(--border-soft)" }}>
      <svg viewBox="0 0 560 150" width="100%" style={{ minWidth: 500 }}>
        <defs>
          <marker id="ah3" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--ink-faint)" />
          </marker>
        </defs>
        {[["Satellite SST (NOAA)", "var(--coral)"], ["Ocean colour (VIIRS)", "var(--seafoam)"], ["ARGO float SST", "#7aa2ff"]].map(([t, c], i) => (
          <g key={t}>
            <rect x="14" y={12 + i * 44} width="150" height="32" rx="8" fill="var(--panel)" stroke={c} strokeWidth="1.2" />
            <text x="89" y={32 + i * 44} fill="var(--ink)" fontSize="11" fontFamily="monospace" textAnchor="middle">{t}</text>
            <line x1="164" y1={28 + i * 44} x2="212" y2="72" stroke="var(--ink-faint)" strokeWidth="1.2" markerEnd="url(#ah3)" />
          </g>
        ))}
        <rect x="214" y="48" width="130" height="48" rx="9" fill="var(--panel)" stroke="var(--amber)" strokeWidth="1.4" />
        <text x="279" y="68" fill="var(--ink)" fontSize="12" fontFamily="'Space Grotesk',sans-serif" fontWeight="600" textAnchor="middle">Fishing zones</text>
        <text x="279" y="84" fill="var(--ink-faint)" fontSize="9.5" fontFamily="monospace" textAnchor="middle">PFZ recipe · warm + green</text>
        <line x1="344" y1="72" x2="392" y2="72" stroke="var(--ink-faint)" strokeWidth="1.2" markerEnd="url(#ah3)" />
        <rect x="394" y="48" width="150" height="48" rx="9" fill="var(--panel)" stroke="var(--seafoam)" strokeWidth="1.4" />
        <text x="469" y="68" fill="var(--ink)" fontSize="12" fontFamily="'Space Grotesk',sans-serif" fontWeight="600" textAnchor="middle">FloatChat</text>
        <text x="469" y="84" fill="var(--ink-faint)" fontSize="9.5" fontFamily="monospace" textAnchor="middle">ask · map · answer</text>
        <text x="14" y="140" fill="var(--ink-faint)" fontSize="10.5" fontFamily="monospace">satellites → fishing zones → stored next to the float data → ask in plain words</text>
      </svg>
    </div>
  );
}

/* ========================= ARCHITECTURE ========================= */
function Architecture() {
  return (
    <Section id="architecture" title="How it's put together"
      intro="Three parts work together: the page you see, a “brain” that turns questions into safe searches, and the database of measurements.">
      <ArchitectureDiagram />
      <p>
        The <strong style={{ color: "var(--seafoam)" }}>page</strong> runs in your browser. It sends your
        question to the <strong style={{ color: "var(--amber)" }}>brain</strong>, which writes and checks a
        search, runs it against the <strong style={{ color: "#7aa2ff" }}>database</strong>, and sends back the
        answer, map, and chart. The database itself is filled once, ahead of time, by a separate loading step.
      </p>
      <p className="text-[13px]" style={{ color: "var(--ink-faint)" }}>
        Inside the database, the measurements are organised into three connected tables so common questions
        (maps, counts, “nearest float”) are answered instantly without digging through millions of readings.
        Three more tables hold the fisheries layer (fishing-zone advisories, surface temperature, chlorophyll):
      </p>
      <SchemaDiagram />
    </Section>
  );
}

function ArchitectureDiagram() {
  const box = (x: number, y: number, w: number, h: number, title: string, sub: string, color: string) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="9" fill="var(--panel)" stroke={color} strokeWidth="1.3" />
      <text x={x + w / 2} y={y + h / 2 - 2} fill="var(--ink)" fontSize="12.5" fontFamily="'Space Grotesk',sans-serif" fontWeight="600" textAnchor="middle">{title}</text>
      <text x={x + w / 2} y={y + h / 2 + 14} fill="var(--ink-faint)" fontSize="9.5" fontFamily="monospace" textAnchor="middle">{sub}</text>
    </g>
  );
  const arrow = (x1: number, y1: number, x2: number, y2: number) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink-faint)" strokeWidth="1.4" markerEnd="url(#ah)" />
  );
  return (
    <div className="overflow-x-auto rounded-xl p-4" style={{ background: "var(--abyss)", border: "1px solid var(--border-soft)" }}>
      <svg viewBox="0 0 640 348" width="100%" style={{ minWidth: 600 }}>
        <defs>
          <marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--ink-faint)" />
          </marker>
        </defs>

        {box(230, 12, 180, 48, "Frontend", "React · Leaflet · Plotly", "var(--seafoam)")}
        {arrow(320, 60, 320, 84)}
        <text x="330" y="77" fill="var(--ink-faint)" fontSize="9" fontFamily="monospace">your question ↓</text>

        {box(215, 86, 210, 48, "FastAPI backend", "/chat · /floats · /fisheries", "var(--seafoam)")}
        {arrow(320, 134, 320, 158)}

        {/* the brain group */}
        <rect x="26" y="164" width="588" height="80" rx="12" fill="none" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 5" />
        <text x="38" y="159" fill="var(--amber)" fontSize="10" fontFamily="monospace">the brain — your question becomes safe SQL</text>
        {box(42, 182, 168, 48, "Find context", "RAG · schema docs", "var(--amber)")}
        {arrow(210, 206, 236, 206)}
        {box(238, 182, 150, 48, "Write SQL", "LLM + rule engine", "var(--amber)")}
        {arrow(388, 206, 414, 206)}
        {box(416, 182, 168, 48, "Check it's safe", "sqlglot · read-only", "var(--amber)")}

        {arrow(320, 244, 320, 268)}
        {box(220, 268, 200, 54, "PostgreSQL + PostGIS", "ARGO tables + fisheries tables", "#7aa2ff")}

        {/* ingestion feeds the database from the side */}
        {box(432, 274, 196, 44, "Ingestion (offline)", "argopy · PFZ / SST / chl-a CSVs", "var(--ink-faint)")}
        {arrow(432, 296, 422, 296)}
      </svg>
    </div>
  );
}

function SchemaDiagram() {
  const table = (x: number, y: number, name: string, cols: string[], color: string) => (
    <g>
      <rect x={x} y={y} width="170" height={26 + cols.length * 15} rx="8" fill="var(--abyss)" stroke={color} strokeWidth="1.3" />
      <text x={x + 10} y={y + 17} fill={color} fontSize="12" fontFamily="'Space Grotesk',sans-serif" fontWeight="600">{name}</text>
      {cols.map((c, i) => (
        <text key={i} x={x + 10} y={y + 33 + i * 15} fill="var(--ink-dim)" fontSize="10" fontFamily="monospace">{c}</text>
      ))}
    </g>
  );
  return (
    <div className="overflow-x-auto rounded-xl p-4" style={{ background: "var(--abyss)", border: "1px solid var(--border-soft)" }}>
      <svg viewBox="0 0 590 270" width="100%" style={{ minWidth: 540 }}>
        <defs>
          <marker id="ah2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--ink-faint)" />
          </marker>
        </defs>
        {table(15, 18, "floats", ["one row per robot", "its ID + history"], "var(--seafoam)")}
        {table(210, 18, "profiles", ["one row per trip up", "where + when", "surface readings"], "var(--amber)")}
        {table(405, 18, "measurements", ["one row per depth", "temperature", "salinity"], "#7aa2ff")}
        <line x1="185" y1="38" x2="210" y2="38" stroke="var(--ink-faint)" strokeWidth="1.4" markerEnd="url(#ah2)" />
        <line x1="380" y1="43" x2="405" y2="43" stroke="var(--ink-faint)" strokeWidth="1.4" markerEnd="url(#ah2)" />
        <text x="15" y="118" fill="var(--ink-faint)" fontSize="10.5" fontFamily="monospace">a float has many trips · each trip has many depth readings</text>
        <line x1="15" y1="134" x2="575" y2="134" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 5" />
        <text x="15" y="150" fill="var(--amber)" fontSize="10" fontFamily="monospace">fisheries layer</text>
        {table(15, 158, "pfz_advisories", ["fishing zones", "species · valid until"], "var(--amber)")}
        {table(210, 158, "sst_composites", ["surface temperature", "from satellite"], "var(--coral)")}
        {table(405, 158, "chlorophyll", ["ocean colour", "plankton = food"], "var(--seafoam)")}
        <text x="15" y="258" fill="var(--ink-faint)" fontSize="10.5" fontFamily="monospace">all three carry a position and a date, so they join the float data on the same map</text>
      </svg>
    </div>
  );
}

/* ============================= HOW ============================== */
const STEPS = [
  ["Understand", "It reads your question and, if it's in another language, translates it to English first.", "detect language"],
  ["Find the right data", "It works out which records you mean — the region or port, the dates, the depth, a fish species — and whether that's float data or the fisheries layer.", "retrieve context"],
  ["Write the search", "It writes a precise database query (the technical name is SQL) to fetch exactly those records.", "generate SQL"],
  ["Check it's safe", "Before running anything, it makes sure the query only reads data — it can't change or damage the database.", "validate"],
  ["Run it", "It runs the search over the real ocean database and gets back the matching rows.", "execute (read-only)"],
  ["Draw it", "It turns the rows into a map (floats in seafoam, fishing zones in amber) and a depth or time chart.", "build map + chart"],
  ["Answer in words", "It writes one plain sentence — using only the numbers that came back from the search.", "grounded answer"],
];

function How() {
  const [step, setStep] = useState(0);
  return (
    <Section id="how" title="Your question, step by step"
      intro="Behind that single “Ask” button, seven quick things happen. Tap through them.">
      <div className="flex flex-wrap gap-1.5">
        {STEPS.map(([label], i) => (
          <button key={i} onClick={() => setStep(i)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] transition"
            style={{
              background: step === i ? "var(--raised)" : "var(--panel)",
              border: `1px solid ${step === i ? "var(--seafoam)" : "var(--border-soft)"}`,
              color: step === i ? "var(--ink)" : "var(--ink-dim)",
            }}>
            <span className="font-mono text-[11px]" style={{ color: "var(--seafoam)" }}>{i + 1}</span>
            {label}
          </button>
        ))}
      </div>
      <div className="rounded-xl p-6" style={{ background: "var(--panel)", border: "1px solid var(--seafoam)44" }}>
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-[19px] font-semibold" style={{ color: "var(--ink)" }}>
            {step + 1}. {STEPS[step][0]}
          </p>
          <span className="rounded-full px-2.5 py-1 font-mono text-[10px]"
            style={{ background: "var(--amber)22", color: "var(--amber)", border: "1px solid var(--amber)55" }}>
            {STEPS[step][2]}
          </span>
        </div>
        <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--ink-dim)" }}>{STEPS[step][1]}</p>
        <div className="mt-4 flex items-center gap-1">
          {STEPS.map((_, i) => (
            <div key={i} className="h-1 flex-1 rounded-full" style={{ background: i <= step ? "var(--seafoam)" : "var(--border)" }} />
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ========================= PIPELINE DETAIL ====================== */
function PipelineDetail() {
  const [tab, setTab] = useState(0);
  const tabs: [string, React.ReactNode][] = [
    ["Loading the data", (
      <>
        <p>A tool called <span className="font-mono" style={{ color: "var(--amber)" }}>argopy</span> downloads the Indian-Ocean floats from ARGO's official servers, in small tiles so it never chokes.</p>
        <p>Each download is tidied into one row per depth reading, cleaned (keep the trustworthy readings, prefer corrected values, work out the depth), and loaded into the database in bulk. This happens once, ahead of time.</p>
        <p>The fisheries layer is loaded by a second small step that pulls open satellite feeds — NOAA's daily sea-surface temperature and VIIRS chlorophyll for the Indian coast — and derives fishing zones from them; INCOIS/ISRO exports can be loaded the same way. On the live server this runs by itself every night, so the fishing-zone picture is never more than a day or two behind the satellites. Every row records where it came from.</p>
      </>
    )],
    ["Turning questions into searches", (
      <>
        <p>To write a correct search, the system needs to know the exact names of the tables and columns. So it first looks up the most relevant notes about the database — a technique called <strong style={{ color: "var(--seafoam)" }}>RAG</strong> (retrieval-augmented generation) — and hands them to the AI along with a few worked examples.</p>
        <p>This stops the AI from inventing table or column names, which is the usual way these systems go wrong.</p>
      </>
    )],
    ["AI, or no AI", (
      <>
        <p>If an AI service is connected, it writes the search and phrases the answer. If it's ever unavailable, a built-in <strong style={{ color: "var(--seafoam)" }}>rule-based backup</strong> handles the common question types on its own.</p>
        <p>Either way the search goes through the exact same safety checks — so FloatChat keeps working even with no internet, and a demo never breaks.</p>
      </>
    )],
  ];
  return (
    <Section id="pipeline" title="A closer look"
      intro="For the curious — a little more on the trickier parts, still in plain terms.">
      <div className="flex flex-wrap gap-1 rounded-xl p-1" style={{ background: "var(--panel)", border: "1px solid var(--border-soft)" }}>
        {tabs.map(([label], i) => (
          <button key={i} onClick={() => setTab(i)}
            className="flex-1 rounded-lg px-3 py-1.5 text-[12.5px] transition"
            style={{
              background: tab === i ? "var(--raised)" : "transparent",
              color: tab === i ? "var(--ink)" : "var(--ink-faint)",
              fontWeight: tab === i ? 600 : 500,
              minWidth: 120,
            }}>
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-3 rounded-xl p-5" style={{ background: "var(--panel)", border: "1px solid var(--border-soft)" }}>
        {tabs[tab][1]}
      </div>
    </Section>
  );
}

/* ============================ HONEST =========================== */
function Honest() {
  const points = [
    ["It never makes numbers up", "Every number in an answer comes straight from real measurements the search returned. If the data doesn't have it, FloatChat won't say it."],
    ["It shows its work", "Every answer comes with the exact search it ran and the IDs of the floats it used — so a scientist can verify it came from real records."],
    ["It can only look, never touch", "The search is checked to be a read-only lookup over the allowed tables. It can't change, delete, or damage anything, and a 5-second limit stops runaway searches."],
    ["It works even offline", "With no internet or AI service, the rule-based backup still answers the common questions — so a live demo never fails."],
  ];
  return (
    <Section id="honest" title="How we keep it honest"
      intro="An AI that answers questions is only useful if you can trust it. Four things make sure you can.">
      <div className="grid gap-3 sm:grid-cols-2">
        {points.map(([t, d]) => (
          <div key={t} className="flex gap-3 rounded-xl p-4" style={{ background: "var(--panel)", border: "1px solid var(--border-soft)" }}>
            <span className="mt-0.5 text-[16px]" style={{ color: "var(--seafoam)" }}>✓</span>
            <div>
              <p className="font-display text-[14.5px] font-semibold" style={{ color: "var(--ink)" }}>{t}</p>
              <p className="mt-1 text-[13px]" style={{ color: "var(--ink-dim)" }}>{d}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ============================ BUILT ============================ */
function Built() {
  const parts = [
    ["The page you're on", "React + Vite + Tailwind", "the chat screen, map, and charts in your browser"],
    ["The brain", "Python + FastAPI", "takes your question and turns it into a safe search"],
    ["The database", "PostgreSQL + PostGIS", "stores every measurement; PostGIS handles map & distance questions"],
    ["The map & charts", "Leaflet + Plotly", "draws the float map and the depth / time graphs"],
    ["Finding the right notes", "TF-IDF (or MiniLM)", "picks the database notes relevant to your question, offline"],
    ["Writing the search", "Grok / OpenAI / Llama + a rule-based backup", "quality when online, still works offline"],
    ["Safety check", "sqlglot", "reads the search and rejects anything that isn't a safe lookup"],
    ["The ocean data", "ARGO via argopy", "real float measurements, cleaned and loaded once"],
    ["The fisheries data", "NOAA OISST · NOAA VIIRS · INCOIS/ISRO exports", "satellite surface temperature and chlorophyll, and fishing zones derived from them, loaded next to the floats"],
  ];
  return (
    <Section id="built" title="What it's built with"
      intro="The main pieces, and what each one does.">
      <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--border-soft)" }}>
        <table className="w-full text-left text-[13px]">
          <tbody>
            {parts.map(([role, tech, what], i) => (
              <tr key={role} style={{ background: i % 2 ? "rgba(120,160,200,0.03)" : "transparent" }}>
                <td className="px-3 py-2.5 align-top font-display font-semibold" style={{ color: "var(--ink)", minWidth: 150 }}>{role}</td>
                <td className="px-3 py-2.5 align-top font-mono text-[11.5px]" style={{ color: "var(--seafoam)", minWidth: 130 }}>{tech}</td>
                <td className="px-3 py-2.5 align-top" style={{ color: "var(--ink-dim)" }}>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ========================= MULTILINGUAL ========================= */
function Multilingual() {
  const examples = [
    ["बंगाल की खाड़ी", "Bay of Bengal", "Hindi"],
    ["வங்காள விரிகுடா", "Bay of Bengal", "Tamil"],
    ["লবণাক্ততা", "salinity", "Bengali"],
    ["అరేబియా సముద్రం", "Arabian Sea", "Telugu"],
    ["मछली पकड़ने का क्षेत्र", "fishing zone", "Hindi"],
    ["மத்தி", "sardine", "Tamil"],
    ["ইলিশ", "hilsa", "Bengali"],
    ["ചൂര · കൊച്ചി", "tuna · Kochi", "Malayalam"],
  ];
  return (
    <Section id="multilingual" title="In your language"
      intro="You don't have to ask in English. Hindi, Tamil, Bengali, Telugu and Malayalam all work.">
      <p>
        When an AI service is connected, your question is translated first. Even without one, FloatChat keeps a
        built-in dictionary of ocean words, fish names, ports and place names, so it still understands the
        essentials. The answer can come back in your language too.
      </p>
      <div className="flex flex-wrap gap-2">
        {examples.map(([src, dst, lang]) => (
          <div key={src} className="rounded-lg px-3 py-2" style={{ background: "var(--panel)", border: "1px solid var(--border-soft)" }}>
            <span style={{ color: "var(--ink)" }}>{src}</span>
            <span className="mx-2" style={{ color: "var(--seafoam)" }}>→</span>
            <span className="font-mono text-[12px]" style={{ color: "var(--ink-dim)" }}>{dst}</span>
            <span className="ml-2 text-[10px]" style={{ color: "var(--ink-faint)" }}>{lang}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ============================ WORDS =========================== */
function Words() {
  const terms: [string, string][] = [
    ["ARGO", "The worldwide project running ~4,000 ocean-measuring robots since the year 2000. Named after the ship in Greek myth."],
    ["Float", "One of those robots — it drifts, dives, rises, and records the water as it goes."],
    ["Profile", "One trip from deep to the surface, giving readings at many depths in one place and time."],
    ["Cycle", "One full dive-and-rise of a float, usually about 10 days."],
    ["WMO ID", "The unique ID number that names each float, like a licence plate."],
    ["Salinity", "How salty the water is (measured in PSU — practical salinity units)."],
    ["Temperature", "How warm or cold the water is, in °C."],
    ["Pressure vs depth", "Floats measure pressure; FloatChat converts it to true depth in metres."],
    ["Quality flag", "A tag from 1 (good) to 9 (missing) on every reading. Only good ones are kept."],
    ["Corrected value", "A carefully re-checked version of a reading, published later. Preferred when available."],
    ["NetCDF", "The technical file format ocean data ships in — powerful, but hard for non-experts to open."],
    ["Database", "The organised store holding all the measurements so they can be searched fast."],
    ["PostGIS", "An add-on to the database that understands locations — powering the map and “nearest float” questions."],
    ["SQL", "The precise language used to search a database. FloatChat writes it for you."],
    ["NL→SQL", "Turning a natural-language question into a database search."],
    ["RAG", "Looking up the relevant facts first, then letting the AI answer using them — so it can't invent details."],
    ["Grounded answer", "An answer built only from real search results — nothing invented."],
    ["sqlglot", "The safety checker that reads each search and blocks anything that isn't a safe lookup."],
    ["argopy", "A tool that downloads ARGO float data from the official servers."],
    ["INCOIS", "India's national ocean-information agency, which uses this kind of data. Part of the Ministry of Earth Sciences."],
    ["PFZ", "“Potential Fishing Zone” — an INCOIS advisory saying where fish are likely right now, based on satellite readings."],
    ["SST", "Sea-surface temperature — how warm the top of the ocean is, mapped from satellites. Different fish prefer different temperatures."],
    ["Chlorophyll-a", "The green pigment in plankton, measured from satellite “ocean colour”. More of it means more fish food, so productive fishing grounds."],
    ["OCM", "ISRO's Ocean Colour Monitor — the Indian satellite sensor that measures chlorophyll."],
  ];
  const [open, setOpen] = useState<string | null>(terms[0][0]);
  return (
    <Section id="words" title="Words, explained"
      intro="Anything above sound unfamiliar? Here it is in one line each.">
      <div className="space-y-1.5">
        {terms.map(([term, def]) => {
          const isOpen = open === term;
          return (
            <div key={term} className="overflow-hidden rounded-lg" style={{ border: "1px solid var(--border-soft)", background: "var(--panel)" }}>
              <button onClick={() => setOpen(isOpen ? null : term)}
                className="flex w-full items-center justify-between px-4 py-3 text-left">
                <span className="font-display text-[14px] font-medium" style={{ color: isOpen ? "var(--seafoam)" : "var(--ink)" }}>{term}</span>
                <span style={{ color: "var(--ink-faint)" }}>{isOpen ? "–" : "+"}</span>
              </button>
              {isOpen && (
                <p className="px-4 pb-3 text-[14px] leading-relaxed" style={{ color: "var(--ink-dim)" }}>{def}</p>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ===================== DEEP-SEA BACKGROUND ====================== */
/* Full-bleed underwater scene used behind the page when no real photo is
   supplied at /how-bg.jpg. Static SVG — fully offline. */
function DeepSeaScene() {
  return (
    <svg className="h-full w-full" viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="ds-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#123a58" />
          <stop offset="0.28" stopColor="#0c2a44" />
          <stop offset="0.62" stopColor="#08192b" />
          <stop offset="1" stopColor="#050f1c" />
        </linearGradient>
        <radialGradient id="ds-sun" cx="58%" cy="-4%" r="60%">
          <stop offset="0" stopColor="#a7d8e6" stopOpacity="0.5" />
          <stop offset="0.4" stopColor="#4f9fb8" stopOpacity="0.18" />
          <stop offset="1" stopColor="#4f9fb8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ds-ray" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfeef8" stopOpacity="0.5" />
          <stop offset="1" stopColor="#cfeef8" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="ds-floor" cx="45%" cy="105%" r="55%">
          <stop offset="0" stopColor="#2d6a86" stopOpacity="0.55" />
          <stop offset="1" stopColor="#2d6a86" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="1200" height="760" fill="url(#ds-water)" />
      <rect width="1200" height="760" fill="url(#ds-sun)" />

      {/* surface caustics */}
      <g opacity="0.5" stroke="#bfe6f0" strokeWidth="2" fill="none">
        {Array.from({ length: 7 }).map((_, i) => (
          <path key={i} d={`M${120 + i * 150} 6 q 40 14 80 0 t 80 0`} opacity={0.12 + (i % 3) * 0.05} />
        ))}
      </g>

      {/* god rays from the surface */}
      <g opacity="0.85">
        {[[600, -40], [660, 20], [720, -30], [560, 40], [780, 10], [640, -10]].map(([x, s], i) => (
          <polygon key={i} points={`${x},0 ${x + 34},0 ${x + 34 + s},760 ${x + s},760`} fill="url(#ds-ray)" opacity={0.1 + (i % 3) * 0.05} />
        ))}
      </g>

      {/* seabed glow + floor */}
      <rect y="470" width="1200" height="290" fill="url(#ds-floor)" />
      <path d="M0 620 Q 260 560 520 600 T 1000 585 T 1200 600 L1200 760 L0 760 Z" fill="#0a2130" opacity="0.9" />
      <path d="M0 665 Q 300 620 620 655 T 1200 650 L1200 760 L0 760 Z" fill="#0c2a3a" opacity="0.85" />

      {/* scattered rocks / small coral on the sandy floor */}
      {[[180, 690, 26], [340, 705, 34], [470, 685, 20], [250, 715, 22], [560, 700, 16], [700, 690, 24]].map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx={r} ry={(r as number) * 0.5} fill="#0e2c3c" opacity="0.85" />
      ))}

      {/* coral cluster bottom-right (silhouette) */}
      <g transform="translate(1010 560)" opacity="0.9">
        <path d="M0 180 q-20 -110 10 -170 q10 60 26 30 q6 70 -6 140" fill="none" stroke="#13485a" strokeWidth="10" strokeLinecap="round" />
        <path d="M70 180 q10 -120 -6 -180 q-14 66 -30 26 q-4 80 12 154" fill="none" stroke="#124a4a" strokeWidth="9" strokeLinecap="round" />
        <path d="M130 180 q-16 -90 6 -140 q8 50 22 22 q4 60 -8 118" fill="none" stroke="#155258" strokeWidth="8" strokeLinecap="round" />
        {/* a hint of bioluminescent green */}
        <path d="M40 150 q6 -50 -2 -84" fill="none" stroke="#3f8f6a" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      </g>

      {/* drifting particles */}
      {Array.from({ length: 60 }).map((_, i) => {
        const x = (i * 197) % 1200, y = (i * 313) % 720 + 20, r = 0.6 + (i % 5) * 0.5;
        return <circle key={i} cx={x} cy={y} r={r} fill="#bfe0ea" opacity={0.05 + (i % 4) * 0.04} />;
      })}
    </svg>
  );
}
