/**
 * Strip markdown so Mentor Chat reads like normal WhatsApp text.
 * No **, ##, tables, or code fences left in the bubble.
 */
export function toPlainChatText(input: string): string {
  let s = String(input || "").replace(/\r\n/g, "\n");

  // Drop model/system footnotes that clutter chat
  s = s.replace(/^.*Sumber:\s*.*$/gim, "");
  s = s.replace(/^.*Catatan:\s*Angka dipakai.*$/gim, "");
  s = s.replace(/^.*owner_stated_in_chat.*$/gim, "");
  s = s.replace(/^.*business:[0-9a-f-]{36}.*$/gim, "");

  // Fenced code → plain
  s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, "$1");

  // Markdown tables → plain lines (drop |---| separator rows)
  s = s.replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*\n?/gm, "");
  s = s.replace(/^\s*\|(.+?)\|\s*$/gm, (_m, cols: string) => {
    const cells = cols
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c && !/^:?-{3,}:?$/.test(c));
    return cells.length ? cells.join(" — ") : "";
  });

  // ATX headings
  s = s.replace(/^#{1,6}\s+/gm, "");

  // Bold / italic / strike (closed pairs first)
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, "$1");
  s = s.replace(/\*\*(.+?)\*\*/g, "$1");
  s = s.replace(/__(.+?)__/g, "$1");
  s = s.replace(/\*(.+?)\*/g, "$1");
  s = s.replace(/~~(.+?)~~/g, "$1");

  // Orphan markdown markers (truncated mid-bold etc.)
  s = s.replace(/\*{1,3}/g, "");
  s = s.replace(/_{2,}/g, "");

  // Inline code + links + images
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Horizontal rules
  s = s.replace(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/gm, "");

  // List markers → plain dash
  s = s.replace(/^\s*[-*+]\s+/gm, "- ");

  // Letter-section dump leftovers
  s = s.replace(/^\s*([A-J])\.\s+/gm, "");

  // Soften ugly UUIDs if model echoed them
  s = s.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "");

  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/** True when the model likely hit max_tokens / cut mid-thought. */
export function looksTruncatedReply(text: string): boolean {
  const t = String(text || "").trim();
  if (t.length < 80) return false;
  if (/\*{1,3}\s*$/.test(t)) return true;
  if (/\*\*\d+\.?\s*$/.test(t)) return true;
  if (/(^|\n)\s*\d+\.\s*\*?\*?\s*$/.test(t)) return true;
  if (/(^|\n)\s*[-•]\s*$/.test(t)) return true;
  if (/[,:;]\s*$/.test(t)) return true;
  if (/\b(dan|atau|yang|untuk|dengan|karena|jadi|lalu|kemudian)\s*$/i.test(t)) return true;
  // No terminal punctuation on a long answer
  if (t.length > 350 && !/[.!?…]["')\]]?\s*$/.test(t)) return true;
  return false;
}

/** Friendly labels for sources (kept for APIs; UI may hide them). */
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
