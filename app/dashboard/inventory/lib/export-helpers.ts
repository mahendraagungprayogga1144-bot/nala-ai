export function downloadFile(content: string | Blob, filename: string, mime: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatWibNow(): string {
  return new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatWibDate(): string {
  return new Date().toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function fmtRpFull(n: number): string {
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

export function fmtRpShort(n: number): string {
  if (n >= 1_000_000_000) return "Rp" + (n / 1_000_000_000).toFixed(1).replace(".", ",") + " M";
  if (n >= 1_000_000) return "Rp" + (n / 1_000_000).toFixed(1).replace(".", ",") + " jt";
  if (n >= 1_000) return "Rp" + (n / 1_000).toFixed(0) + " rb";
  return fmtRpFull(n);
}

export function slugFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "inventory";
}

export function openPrintWindow(html: string) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("Izinkan pop-up untuk mencetak laporan.");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
