/** Tema visual khusus modul Kasir — lebih hidup, tetap brand Gercep (teal + ungu). */
import type { CSSProperties } from "react";

export const KASIR = {
  bg: {
    base: "#050508",
    mesh: "radial-gradient(ellipse 90% 55% at 15% -8%, rgba(45,212,191,.16) 0%, transparent 52%), radial-gradient(ellipse 70% 45% at 105% 95%, rgba(139,92,246,.14) 0%, transparent 50%), #050508",
    meshSoft: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(45,212,191,.1) 0%, transparent 55%), #050508",
  },
  surface: {
    card: "#13131F",
    cardGlass: "rgba(19,19,31,0.92)",
    header: "rgba(12,12,20,0.95)",
    elevated: "#1A1A28",
    input: "rgba(255,255,255,0.04)",
  },
  border: {
    subtle: "rgba(255,255,255,0.07)",
    accent: "rgba(45,212,191,0.4)",
  },
  text: {
    primary: "#FAFAFE",
    secondary: "#A8A7C0",
    muted: "#5E5D78",
  },
  accent: {
    teal: "#2DD4BF",
    purple: "#A78BFA",
    pink: "#F472B6",
    amber: "#FBBF24",
    sky: "#38BDF8",
  },
  gradient: {
    brand: "linear-gradient(135deg, #2DD4BF 0%, #8B5CF6 100%)",
    brandSoft: "linear-gradient(135deg, rgba(45,212,191,.2), rgba(139,92,246,.15))",
    headerLine: "linear-gradient(90deg, transparent 0%, rgba(45,212,191,.55) 35%, rgba(139,92,246,.55) 65%, transparent 100%)",
    text: "linear-gradient(135deg, #2DD4BF, #A78BFA)",
    kpi: {
      omzet: { bg: "linear-gradient(145deg, rgba(45,212,191,.22), rgba(45,212,191,.05))", border: "rgba(45,212,191,.35)", color: "#2DD4BF" },
      order: { bg: "linear-gradient(145deg, rgba(167,139,250,.25), rgba(139,92,246,.06))", border: "rgba(167,139,250,.4)", color: "#A78BFA" },
      laba: { bg: "linear-gradient(145deg, rgba(251,191,36,.22), rgba(251,191,36,.05))", border: "rgba(251,191,36,.35)", color: "#FBBF24" },
      foodCost: { bg: "linear-gradient(145deg, rgba(244,114,182,.22), rgba(244,114,182,.05))", border: "rgba(244,114,182,.35)", color: "#F472B6" },
    },
  },
  shadow: {
    fab: "0 10px 40px rgba(45,212,191,.28), 0 4px 16px rgba(0,0,0,.45)",
    card: "0 8px 28px rgba(0,0,0,.35)",
    menuActive: "0 0 0 1.5px rgba(45,212,191,.45), 0 12px 32px rgba(45,212,191,.15)",
  },
} as const;

export const kasirFonts = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');body{margin:0}`;

export const kasirBtnGrad: CSSProperties = {
  width: "100%",
  padding: "13px",
  borderRadius: "14px",
  border: "none",
  background: KASIR.gradient.brand,
  color: "#050508",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "'Space Grotesk', sans-serif",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  marginBottom: "8px",
  boxShadow: "0 6px 20px rgba(45,212,191,.25)",
};

export const kasirShell: CSSProperties = {
  background: KASIR.bg.mesh,
  color: KASIR.text.primary,
  fontFamily: "'Space Grotesk', sans-serif",
  minHeight: "100vh",
};
