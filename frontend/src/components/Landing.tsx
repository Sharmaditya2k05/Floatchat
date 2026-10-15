import { useEffect, useRef, useState } from "react";

/* Cinematic FloatChat entry hero. Typing a question or clicking a chip
   carries straight through into the app via onEnter. */

export type EnterPayload = { q?: string; view?: "how" | "data" | "fisheries" };

const PLACEHOLDERS = [
  "How has surface temperature near the equator changed in 2023…",
  "Average salinity in the Arabian Sea between 0 and 200 m…",
  "Which floats are nearest to 15°N, 68°E…",
  "How many active floats are in the Bay of Bengal…",
];

const CHIPS: { label: string; q: string; icon: JSX.Element }[] = [
  {
    label: "Salinity near the equator",
    q: "Show me salinity near the equator in March 2023",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 8c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0M2 15c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0" /></svg>,
  },
  {
    label: "Fishing zones near Kochi",
    q: "Current fishing zones near Kochi",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 16s1-4 5-4 5 6 9 6 5-4 5-4" /><path d="M2 12s1-4 5-4 5 6 9 6 5-4 5-4" /><circle cx="18" cy="8" r="1.5" fill="currentColor" stroke="none" /></svg>,
  },
  {
    label: "Bay of Bengal",
    q: "How many active floats are in the Bay of Bengal?",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3zM9 3v15M15 6v15" /></svg>,
  },
];

export default function Landing({
  leaving,
  onEnter,
}: {
  leaving: boolean;
  onEnter: (p: EnterPayload) => void;
}) {
  const [text, setText] = useState("");
  const [phIdx, setPhIdx] = useState(0);
  const [anim, setAnim] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Muted autoplay can be blocked by the attribute alone — nudge it on mount,
  // and again on the first user interaction as a fallback (the poster image
  // covers the paused state until then, so it never looks broken).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
    const kick = () => v.play().catch(() => {});
    const opts = { once: true, passive: true } as const;
    window.addEventListener("pointerdown", kick, opts);
    window.addEventListener("keydown", kick, opts);
    window.addEventListener("touchstart", kick, opts);
    return () => {
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
      window.removeEventListener("touchstart", kick);
    };
  }, []);

  // rotate the ghost placeholder while the field is empty
  useEffect(() => {
    if (text) return;
    const id = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 3200);
    return () => clearInterval(id);
  }, [text]);

  // drop the entrance class once it has played
  useEffect(() => {
    const id = setTimeout(() => setAnim(false), 2600);
    return () => clearTimeout(id);
  }, []);

  function submit() {
    onEnter({ q: text.trim() || undefined });
  }

  return (
    <div className={`lp${anim ? " anim" : ""}${leaving ? " leaving" : ""}`}>
      <video
        ref={videoRef}
        className="lp-video"
        autoPlay
        muted
        loop
        playsInline
        poster="/content.png"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_124724_bc041163-d651-425f-aea3-2acc1efc2c96.mp4"
      />
      <div className="lp-scrim" />

      <div className="lp-frame">
        <header className="lp-nav">
          <a className="lp-brand" href="#" aria-label="FloatChat home" onClick={(e) => e.preventDefault()}>
            <span className="lp-mark">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M4 5.5h13a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-2.5 2.5H10l-3.5 3v-3H4a2.5 2.5 0 0 1-2.5-2.5V8A2.5 2.5 0 0 1 4 5.5z" stroke="#38e3c6" strokeWidth="1.5" />
                <path d="M5.5 11.2q2-2.4 4 0t4 0" stroke="#38e3c6" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="5.5" cy="11.2" r="1.15" fill="#f6bb52" />
              </svg>
            </span>
            <span className="lp-word">FloatChat</span>
          </a>

          <nav className="lp-links">
            <a onClick={() => onEnter({})}>Explore</a>
            <a onClick={() => onEnter({ view: "fisheries" })}>Fisheries</a>
            <a onClick={() => onEnter({ view: "how" })}>How it works</a>
            <a onClick={() => onEnter({ view: "data" })}>The data</a>
          </nav>

          <button className="lp-cta" onClick={() => onEnter({})}>Launch app</button>
        </header>

        <main className="lp-hero">
          <div>
            <h1 className="lp-h1">Ask the ocean. <em>Get real answers.</em></h1>
            <p className="lp-sub">
              FloatChat turns a plain-language question into a grounded answer, a live float map, and the
              exact data behind it — from real ARGO ocean floats.
            </p>
          </div>

          <form
            className="lp-card"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {text ? (
              <div className="lp-ph" style={{ color: "#eaf6fb" }}>{text}</div>
            ) : (
              <div className="lp-ph" aria-hidden>
                {PLACEHOLDERS[phIdx]}
                <span className="cursor" />
              </div>
            )}
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Ask a question about the ocean"
              style={{ position: "absolute", opacity: 0, inset: "12px 20px auto", height: 24, width: "70%" }}
            />

            <div className="lp-tools">
              <div className="lp-chips">
                {CHIPS.map((c) => (
                  <button type="button" key={c.label} className="lp-chip" onClick={() => onEnter({ q: c.q })}>
                    {c.icon}
                    {c.label}
                  </button>
                ))}
              </div>

              <div className="lp-right">
                <span className="lp-model">Grounded · <b>ARGO 2023</b></span>
                <span className="lp-icon" title="English, Hindi, Tamil, Bengali, Telugu" onClick={() => inputRef.current?.focus()}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.8 5.8 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.8-3.8-9S9.5 5.5 12 3z" />
                  </svg>
                </span>
                <button type="submit" className="lp-send" aria-label="Ask">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#3a1e08" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5M6 11l6-6 6 6" />
                  </svg>
                </button>
              </div>
            </div>
          </form>
        </main>

        <footer className="lp-proof">
          <span className="cap">Real data from the global ARGO ocean-observing programme</span>
          <div className="lp-orgs">
            <span>ARGO</span><span className="dot">·</span>
            <span>INCOIS</span><span className="dot">·</span>
            <span>MoES</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
