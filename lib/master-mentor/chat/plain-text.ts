/**
 * Strip markdown so Mentor Chat reads like normal WhatsApp text.
 * No **, ##, tables, or code fences left in the bubble.
 */
export function toPlainChatText(input: string): string {
  let s = String(input || "").replace(/\r\n/g, "\n");

  // Fenced code → plain
  s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, "$1");

  // Markdown tables → "Kolom — nilai" lines (drop separator rows)
  s = s.replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, "");
  s = s.replace(/^\s*\|(.+)\|\s*$/gm, (_m, cols: string) =>
    cols
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean)
      .join(" — "),
  );

  // ATX headings
  s = s.replace(/^#{1,6}\s+/gm, "");

  // Bold / italic / strike
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, "$1");
  s = s.replace(/\*\*(.+?)\*\*/g, "$1");
  s = s.replace(/__(.+?)__/g, "$1");
  s = s.replace(/\*(.+?)\*/g, "$1");
  s = s.replace(/_(.+?)_/g, "$1");
  s = s.replace(/~~(.+?)~~/g, "$1");

  // Inline code + links + images
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Horizontal rules (often look like “titik-titik”)
  s = s.replace(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/gm, "");

  // List markers → plain dash (no markdown asterisks)
  s = s.replace(/^\s*[-*+]\s+/gm, "- ");
  s = s.replace(/^\s*\d+\.\s+/gm, (m) => m);

  // Letter-section dump leftovers: "A. " / "## E." already stripped hashes
  s = s.replace(/^\s*([A-J])\.\s+/gm, "");

  // Soften ugly UUID source lines if model echoed them
  s = s.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "");

  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/** Friendly labels for sources footer (no raw UUID). */
export function friendlySourceLabel(raw: string): string {
  const s = raw.trim();
  if (/owner_stated/i.test(s)) return "angka dari chat";
  if (/^business:/i.test(s) || /^[0-9a-f-]{36}$/i.test(s)) return "profil bisnis";
  if (/financial|finance|uang/i.test(s)) return "catatan uang";
  if (/phase.?4|intelligence|gercep/i.test(s)) return "angka operasional";
  if (/decision/i.test(s)) return "keputusan";
  if (/strateg/i.test(s)) return "rencana";
  if (/owner/i.test(s)) return "profil kamu";
  return s.length > 40 ? "memori bisnis" : s;
}
