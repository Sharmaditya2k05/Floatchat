export default function PromoCard({ onLearn }: { onLearn: () => void }) {
  return (
    <div className="fc-panel relative overflow-hidden" style={{ minHeight: 210 }}>
      {/* Photo background (falls back to the SVG scene if the file is missing). */}
      <div className="absolute inset-0"><OceanScene /></div>
      <div className="absolute inset-0" style={{ backgroundImage: "url('/1.png')", backgroundSize: "cover", backgroundPosition: "center right" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(6,16,28,.9) 0%, rgba(6,16,28,.62) 42%, rgba(6,16,28,.15) 100%)" }} />
      <div className="relative p-5">
        <p className="font-display text-[17px] font-semibold" style={{ color: "#eaf6ff", textShadow: "0 1px 8px rgba(0,0,0,.6)" }}>
          Explore the ocean like never before
        </p>
        <p className="mt-1.5 max-w-[62%] text-[13px] leading-relaxed" style={{ color: "#cfe2ee", textShadow: "0 1px 6px rgba(0,0,0,.6)" }}>
          Ask anything about salinity, temperature, floats, currents, and more. Our AI understands the ocean.
        </p>
        <button
          onClick={onLearn}
          className="mt-5 flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-medium transition hover:brightness-110"
          style={{ background: "rgba(10,22,34,.72)", color: "var(--seafoam)", border: "1px solid rgba(53,224,192,.4)", backdropFilter: "blur(4px)" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          Learn how it works
        </button>
      </div>
    </div>
  );
}

/* Detailed inline-SVG underwater scene — no external images, fully offline. */
function OceanScene() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 440 220" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="water" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor="#1b5f77" />
          <stop offset="0.45" stopColor="#0f3b52" />
          <stop offset="1" stopColor="#071523" />
        </linearGradient>
        <radialGradient id="glow" cx="72%" cy="-6%" r="70%">
          <stop offset="0" stopColor="#8fe6dd" stopOpacity="0.45" />
          <stop offset="0.5" stopColor="#3aa2a8" stopOpacity="0.12" />
          <stop offset="1" stopColor="#3aa2a8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ray" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bff3ea" stopOpacity="0.5" />
          <stop offset="1" stopColor="#bff3ea" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#071523" stopOpacity="0.85" />
          <stop offset="0.55" stopColor="#071523" stopOpacity="0.35" />
          <stop offset="1" stopColor="#071523" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="440" height="220" fill="url(#water)" />
      <rect width="440" height="220" fill="url(#glow)" />

      {/* god rays from the surface */}
      <g opacity="0.5">
        {[[210, -20], [250, 10], [300, -30], [345, 20], [390, -10]].map(([x, s], i) => (
          <polygon key={i} points={`${x},0 ${x + 16},0 ${x + 16 + s},220 ${x + s},220`} fill="url(#ray)" opacity={0.16 + (i % 3) * 0.05} />
        ))}
      </g>

      {/* drifting particles */}
      {Array.from({ length: 26 }).map((_, i) => {
        const x = (i * 61) % 440, y = (i * 97) % 200 + 6, r = 0.6 + (i % 4) * 0.4;
        return <circle key={i} cx={x} cy={y} r={r} fill="#cdeee7" opacity={0.12 + (i % 3) * 0.06} />;
      })}

      {/* fish */}
      {[[120, 70, "#7fe9d3", 1], [95, 92, "#f5b544", 0.8], [150, 60, "#8fd3ff", 0.7]].map(([x, y, c, sc], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${sc})`} opacity="0.8">
          <path d="M0 0 q8 -5 16 0 q-8 5 -16 0z" fill={c as string} />
          <path d="M16 0 l6 -4 v8z" fill={c as string} />
          <circle cx="4" cy="-1" r="0.9" fill="#04202a" />
        </g>
      ))}

      {/* turtle */}
      <g transform="translate(238 108) rotate(-8)" opacity="0.9">
        <ellipse cx="0" cy="0" rx="30" ry="21" fill="#1c6d63" />
        <ellipse cx="0" cy="0" rx="30" ry="21" fill="none" stroke="#0c3b36" strokeWidth="1.2" />
        {/* shell plates */}
        <g stroke="#0c3b36" strokeWidth="1" fill="#248a7c" opacity="0.9">
          <path d="M0 -12 l9 6 -4 11 -10 0 -4 -11z" />
          <path d="M0 -12 l-9 6" fill="none" />
        </g>
        <circle cx="33" cy="-3" r="8" fill="#1c6d63" />
        <circle cx="37" cy="-4" r="1.1" fill="#04202a" />
        <path d="M-20 -16 l-16 -10 q-2 8 6 14z" fill="#1c6d63" />
        <path d="M-20 16 l-16 10 q-2 -8 6 -14z" fill="#1c6d63" />
        <path d="M20 -16 l14 -12 q4 8 -4 15z" fill="#1c6d63" />
      </g>

      {/* coral reef along the bottom */}
      <path d="M0 200 Q 70 182 150 194 T 300 188 T 440 192 L440 220 L0 220 Z" fill="#0a1a24" />
      {[["#e07a4e", 30], ["#d95b8a", 70], ["#2fa3a0", 110], ["#b568d6", 360], ["#e08a3e", 400], ["#2f9aa8", 420]].map(([c, x], i) => (
        <g key={i} transform={`translate(${x} 200)`} opacity="0.85">
          <path d="M0 0 q-7 -20 2 -34 q3 12 8 6 q3 14 -3 28 M0 0 q7 -16 3 -30" fill="none" stroke={c as string} strokeWidth="3.4" strokeLinecap="round" />
        </g>
      ))}
      {/* sea anemones / dots */}
      {[[52, 196], [92, 198], [372, 194], [412, 196]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.2" fill="#2fa3a0" opacity="0.7" />
      ))}

      {/* left scrim so the text stays crisp */}
      <rect width="440" height="220" fill="url(#scrim)" />
    </svg>
  );
}
