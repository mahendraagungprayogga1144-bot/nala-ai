"use client";
import { useState, useEffect, useRef } from "react";

const MONO = "'JetBrains Mono', 'SF Mono', monospace";

/* ═══════════════ BOOT SEQUENCE — Jarvis-style OS startup ═══════════════ */
const BOOT_LINES = [
  { text: "GERCEP OS v4.5.2 — NEURAL BUSINESS KERNEL", color: "#2DD4BF" },
  { text: "> memuat neural core ................ [OK]", color: "#8B8AA0" },
  { text: "> sinkronisasi modul bisnis ......... [OK]", color: "#8B8AA0" },
  { text: "> koneksi marketplace nodes ......... [OK]", color: "#8B8AA0" },
  { text: "> AI inference engine ............... [ONLINE]", color: "#8B8AA0" },
  { text: "> enkripsi quantum-grade ............ [AKTIF]", color: "#8B8AA0" },
  { text: "AKSES DIBERIKAN — SELAMAT DATANG, OPERATOR", color: "#4ADE80" },
];

export function BootSequence() {
  const [visibleLines, setVisibleLines] = useState(0);
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const lineIv = setInterval(() => {
      setVisibleLines(v => {
        if (v >= BOOT_LINES.length) { clearInterval(lineIv); return v; }
        return v + 1;
      });
    }, 220);
    const progIv = setInterval(() => {
      setProgress(p => Math.min(100, p + 3 + Math.random() * 5));
    }, 60);
    const fadeT = setTimeout(() => setFading(true), 2600);
    const goneT = setTimeout(() => { setGone(true); document.body.style.overflow = ""; }, 3400);
    return () => {
      clearInterval(lineIv); clearInterval(progIv);
      clearTimeout(fadeT); clearTimeout(goneT);
      document.body.style.overflow = "";
    };
  }, []);

  const skip = () => { setFading(true); setTimeout(() => { setGone(true); document.body.style.overflow = ""; }, 400); };

  if (gone) return null;

  return (
    <div onClick={skip}
      className="fixed inset-0 z-[200] flex items-center justify-center cursor-pointer"
      style={{
        background: "radial-gradient(ellipse at 50% 40%, #07101a 0%, #030307 70%)",
        opacity: fading ? 0 : 1,
        transition: "opacity 0.8s ease",
        pointerEvents: fading ? "none" : "auto",
      }}>
      {/* Scanlines */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(45,212,191,0.02) 3px, rgba(45,212,191,0.02) 4px)",
      }} />
      {/* Scan sweep */}
      <div className="absolute left-0 right-0 h-[2px] pointer-events-none" style={{
        background: "linear-gradient(90deg, transparent, rgba(45,212,191,0.6), transparent)",
        boxShadow: "0 0 20px rgba(45,212,191,0.5)",
        animation: "gc-scan 2.2s linear infinite",
      }} />

      <div className="relative flex flex-col items-center px-6 w-full max-w-[520px]">
        {/* Pulsing core logo */}
        <div className="relative mb-8 h-24 w-24 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-[#2DD4BF]/30" style={{ animation: "gc-ring 2s ease-out infinite" }} />
          <div className="absolute inset-2 rounded-full border border-[#8B5CF6]/30" style={{ animation: "gc-ring 2s ease-out infinite 0.5s" }} />
          <div className="absolute inset-0 rounded-full" style={{
            border: "1px dashed rgba(45,212,191,0.4)",
            animation: "gc-spin 8s linear infinite",
          }} />
          <img src="/logo-gercep.png" alt="" className="h-14 w-14 rounded-xl object-cover relative"
            style={{ boxShadow: "0 0 40px rgba(45,212,191,0.6), 0 0 80px rgba(139,92,246,0.3)" }} />
        </div>

        {/* Terminal lines */}
        <div className="w-full mb-6 space-y-1.5 min-h-[150px]">
          {BOOT_LINES.slice(0, visibleLines).map((l, i) => (
            <p key={i} className="text-[10px] sm:text-[11px] tracking-wide"
              style={{ fontFamily: MONO, color: l.color, textShadow: `0 0 10px ${l.color}40`, animation: "gc-lineIn 0.15s ease-out" }}>
              {l.text}
            </p>
          ))}
          <span className="inline-block w-2 h-3 bg-[#2DD4BF]" style={{ animation: "gc-blink 0.8s step-start infinite" }} />
        </div>

        {/* Progress bar */}
        <div className="w-full h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(45,212,191,0.1)" }}>
          <div className="h-full rounded-full transition-all duration-100" style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, #2DD4BF, #8B5CF6)",
            boxShadow: "0 0 15px rgba(45,212,191,0.8)",
          }} />
        </div>
        <div className="w-full flex justify-between mt-2">
          <span className="text-[8px] tracking-[0.3em] text-[#3A3B52]" style={{ fontFamily: MONO }}>INITIALIZING NEURAL LINK</span>
          <span className="text-[8px] text-[#2DD4BF]" style={{ fontFamily: MONO }}>{Math.floor(progress)}%</span>
        </div>
        <p className="mt-6 text-[8px] text-[#3A3B52] tracking-widest uppercase" style={{ fontFamily: MONO }}>klik untuk skip</p>
      </div>

      <style>{`
        @keyframes gc-scan { 0% { top: -2%; } 100% { top: 102%; } }
        @keyframes gc-ring { 0% { transform: scale(0.6); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
        @keyframes gc-spin { to { transform: rotate(360deg); } }
        @keyframes gc-blink { 50% { opacity: 0; } }
        @keyframes gc-lineIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}

/* ═══════════════ HUD OVERLAY — command center frame ═══════════════ */
function useClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const fn = () => setTime(new Date().toLocaleTimeString("id-ID", { hour12: false, timeZone: "Asia/Jakarta" }));
    fn();
    const iv = setInterval(fn, 1000);
    return () => clearInterval(iv);
  }, []);
  return time;
}

function useTelemetry() {
  const [t, setT] = useState({ trx: 1204, inf: 98.7, nodes: 512, lat: 12 });
  useEffect(() => {
    const iv = setInterval(() => {
      setT({
        trx: 1100 + Math.floor(Math.random() * 300),
        inf: +(97.5 + Math.random() * 2.4).toFixed(1),
        nodes: 500 + Math.floor(Math.random() * 24),
        lat: 8 + Math.floor(Math.random() * 9),
      });
    }, 1400);
    return () => clearInterval(iv);
  }, []);
  return t;
}

function CornerBracket({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const base = "absolute w-8 h-8 sm:w-12 sm:h-12 pointer-events-none";
  const style: React.CSSProperties = { borderColor: "rgba(45,212,191,0.35)" };
  if (pos === "tl") return <div className={`${base} top-20 left-3 border-l-2 border-t-2`} style={style} />;
  if (pos === "tr") return <div className={`${base} top-20 right-3 border-r-2 border-t-2`} style={style} />;
  if (pos === "bl") return <div className={`${base} bottom-10 left-3 border-l-2 border-b-2`} style={style} />;
  return <div className={`${base} bottom-10 right-3 border-r-2 border-b-2`} style={style} />;
}

export function HudOverlay() {
  const time = useClock();
  const tel = useTelemetry();

  const tickerItems = [
    `TRX/S: ${tel.trx.toLocaleString("id-ID")}`,
    `AI INFERENCE: ${tel.inf}%`,
    `NODES AKTIF: ${tel.nodes}`,
    `LATENCY: ${tel.lat}ms`,
    "NEURAL LINK: STABLE",
    "MARKETPLACE SYNC: OK",
    "KEUANGAN CORE: ONLINE",
    "PAJAK ENGINE: STANDBY",
    "SEKTOR: ID-JKT-01",
    "ENKRIPSI: AES-512 QUANTUM",
  ];

  return (
    <div className="fixed inset-0 z-40 pointer-events-none select-none">
      {/* Subtle scanlines over everything */}
      <div className="absolute inset-0" style={{
        background: "repeating-linear-gradient(0deg, transparent 0px, transparent 4px, rgba(45,212,191,0.012) 4px, rgba(45,212,191,0.012) 5px)",
      }} />

      {/* Corner brackets */}
      <CornerBracket pos="tl" /><CornerBracket pos="tr" /><CornerBracket pos="bl" /><CornerBracket pos="br" />

      {/* Top-left system label */}
      <div className="absolute top-[84px] left-6 sm:left-8 hidden sm:block">
        <p className="text-[8px] tracking-[0.35em] text-[#2DD4BF]/60" style={{ fontFamily: MONO }}>GERCEP OS // COMMAND CENTER</p>
        <div className="mt-1 flex gap-[3px]">
          {[...Array(12)].map((_, i) => (
            <span key={i} className="h-[3px] w-[8px]" style={{
              background: i < 9 ? "rgba(45,212,191,0.5)" : "rgba(45,212,191,0.12)",
            }} />
          ))}
        </div>
      </div>

      {/* Top-right clock + status */}
      <div className="absolute top-[84px] right-6 sm:right-8 text-right hidden sm:block">
        <p className="text-[11px] text-[#2DD4BF]" style={{ fontFamily: MONO, textShadow: "0 0 12px rgba(45,212,191,0.5)" }}>{time} WIB</p>
        <p className="text-[8px] tracking-[0.25em] text-[#4ADE80]/70 mt-0.5" style={{ fontFamily: MONO }}>
          <span className="inline-block h-[6px] w-[6px] rounded-full bg-[#4ADE80] mr-1.5" style={{ animation: "gc-blink 1.6s step-start infinite" }} />
          SYSTEMS ONLINE
        </p>
      </div>

      {/* Left edge vertical label */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 hidden lg:flex flex-col items-center gap-3">
        <span className="text-[7px] tracking-[0.4em] text-[#8B5CF6]/50" style={{ fontFamily: MONO, writingMode: "vertical-rl" }}>AI CORE ACTIVE</span>
        <div className="flex flex-col gap-[3px]">
          {[...Array(8)].map((_, i) => (
            <span key={i} className="w-[3px] h-[10px]" style={{
              background: "rgba(139,92,246,0.35)",
              animation: `gc-pulse 1.8s ease-in-out infinite ${i * 0.15}s`,
            }} />
          ))}
        </div>
      </div>

      {/* Right edge ticks */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:flex flex-col items-center gap-3">
        <div className="flex flex-col gap-[3px]">
          {[...Array(8)].map((_, i) => (
            <span key={i} className="w-[3px] h-[10px]" style={{
              background: "rgba(45,212,191,0.35)",
              animation: `gc-pulse 1.8s ease-in-out infinite ${i * 0.15}s`,
            }} />
          ))}
        </div>
        <span className="text-[7px] tracking-[0.4em] text-[#2DD4BF]/50" style={{ fontFamily: MONO, writingMode: "vertical-rl" }}>NEURAL GRID 2045</span>
      </div>

      {/* Bottom telemetry ticker */}
      <div className="absolute bottom-0 left-0 right-0 h-7 overflow-hidden flex items-center"
        style={{ background: "rgba(3,3,7,0.85)", borderTop: "1px solid rgba(45,212,191,0.15)", backdropFilter: "blur(10px)" }}>
        <div className="flex whitespace-nowrap" style={{ animation: "gc-ticker 30s linear infinite" }}>
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <span key={i} className="mx-6 text-[8px] tracking-[0.2em]"
              style={{ fontFamily: MONO, color: i % 3 === 0 ? "#2DD4BF" : i % 3 === 1 ? "#8B8AA0" : "#8B5CF6", opacity: 0.8 }}>
              ▸ {item}
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes gc-ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes gc-pulse { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
        @keyframes gc-blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}

/* ═══════════════ AI CORE ORB — Jarvis-style assistant presence ═══════════════ */
export function AICore() {
  const [bars, setBars] = useState<number[]>([4, 8, 6, 10, 5]);
  useEffect(() => {
    const iv = setInterval(() => {
      setBars(Array.from({ length: 5 }, () => 3 + Math.random() * 10));
    }, 180);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="fixed bottom-12 right-5 z-40 pointer-events-none flex flex-col items-center gap-2">
      <div className="relative h-16 w-16 flex items-center justify-center">
        {/* Expanding rings */}
        <div className="absolute inset-0 rounded-full border border-[#2DD4BF]/40" style={{ animation: "gc-ring 2.4s ease-out infinite" }} />
        <div className="absolute inset-0 rounded-full border border-[#8B5CF6]/30" style={{ animation: "gc-ring 2.4s ease-out infinite 0.8s" }} />
        {/* Rotating dashed orbit */}
        <div className="absolute inset-1 rounded-full" style={{ border: "1px dashed rgba(45,212,191,0.35)", animation: "gc-spin 10s linear infinite" }} />
        {/* Core */}
        <div className="relative h-9 w-9 rounded-full flex items-center justify-center" style={{
          background: "radial-gradient(circle at 35% 35%, #2DD4BF, #0d9488 45%, #042f2e 100%)",
          boxShadow: "0 0 25px rgba(45,212,191,0.7), 0 0 60px rgba(45,212,191,0.25)",
          animation: "gc-breathe 2.6s ease-in-out infinite",
        }}>
          {/* Waveform */}
          <div className="flex items-center gap-[2px]">
            {bars.map((h, i) => (
              <span key={i} className="w-[2px] rounded-full bg-[#032726]" style={{ height: `${h}px`, transition: "height 0.15s ease" }} />
            ))}
          </div>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[7px] tracking-[0.3em] text-[#2DD4BF]/80" style={{ fontFamily: MONO }}>GERCEP CORE</p>
        <p className="text-[6px] tracking-[0.25em] text-[#4ADE80]/60" style={{ fontFamily: MONO }}>● ONLINE</p>
      </div>
      <style>{`
        @keyframes gc-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        @keyframes gc-ring { 0% { transform: scale(0.7); opacity: 1; } 100% { transform: scale(1.7); opacity: 0; } }
        @keyframes gc-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* ═══════════════ DECODE TEXT — sci-fi character scramble reveal ═══════════════ */
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@*+=<>[]{}";

export function DecodeText({ text, delay = 0, className, style }: {
  text: string; delay?: number; className?: string; style?: React.CSSProperties;
}) {
  const [display, setDisplay] = useState(text);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const startT = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(startT);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    let frame = 0;
    const totalFrames = Math.max(20, text.length * 2.2);
    const iv = setInterval(() => {
      frame++;
      const revealed = Math.floor((frame / totalFrames) * text.length);
      let out = "";
      for (let i = 0; i < text.length; i++) {
        if (text[i] === " ") { out += " "; continue; }
        if (i < revealed) out += text[i];
        else out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      setDisplay(out);
      if (frame >= totalFrames) { setDisplay(text); clearInterval(iv); }
    }, 35);
    return () => clearInterval(iv);
  }, [started, text]);

  return <span ref={ref} className={className} style={style}>{display}</span>;
}
