import { PDFDocument, rgb } from "pdf-lib";
import { embedBrandFonts } from "@/lib/henima-sales/pdf-fonts";
import { toPlainChatText } from "./plain-text";

/**
 * Detect owner asking for a HENIMA business/company document as PDF.
 * Scoped to company docs — not random world PDFs.
 */
export function wantsBusinessPdf(question: string): boolean {
  const q = question.trim();
  if (!q) return false;
  if (/(buat|bikin|susun|unduh|download|export|jadikan|generate).{0,48}(pdf|dokumen)/i.test(q)) {
    return true;
  }
  return /\b(pdf|proposal|profil\s+perusahaan|company\s+profile|visi\s*misi|visi\s+perusahaan|misi\s+perusahaan|pitch(\s*deck)?|mou\b|kerja\s*sama|partnership|sop\b|peraturan\s+(perusahaan|karyawan|kepegawaian|penggajian)|kebijakan\s+(hr|sdm|gaji|penggajian)|panduan\s+wawancara|interview\s+guide|job\s*desc|deskripsi\s+pekerjaan|kontrak\s+kerja|company\s+deck|ringkasan\s+perusahaan|dokumen\s+(bisnis|perusahaan|internal)|brief\s+perusahaan|company\s+brief)\b/i.test(
    q,
  );
}

export function businessPdfTitle(question: string): string {
  const q = question.toLowerCase();
  if (/proposal|investor|pitch/.test(q)) return "Proposal Bisnis HENIMA";
  if (/profil|company\s+profile|ringkasan\s+perusahaan/.test(q)) return "Profil Perusahaan HENIMA";
  if (/visi|misi/.test(q)) return "Visi & Misi HENIMA";
  if (/penggajian|gaji|payroll/.test(q)) return "Kebijakan Penggajian HENIMA";
  if (/peraturan|kebijakan\s+hr|kepegawaian/.test(q)) return "Peraturan Internal HENIMA";
  if (/wawancara|interview/.test(q)) return "Panduan Wawancara HENIMA";
  if (/sop/.test(q)) return "SOP Internal HENIMA";
  if (/kerja\s*sama|mou|partnership/.test(q)) return "Dokumen Kerja Sama HENIMA";
  if (/job\s*desc|deskripsi\s+pekerjaan/.test(q)) return "Job Description HENIMA";
  return "Dokumen Bisnis HENIMA";
}

export function buildBusinessPdfSystem(locale: "id" | "en" = "id"): string {
  if (locale === "en") {
    return [
      "You are HENIMA's internal business document writer.",
      "Write a complete company document ready to become a PDF.",
      "ONLY use facts from Business Memory, operational intelligence, and figures the owner typed in chat.",
      "Never invent revenue, cash, stock, headcount, or legal claims. If missing, write 'not recorded yet' and continue with conditional wording.",
      "Plain text only — no markdown (** ## tables).",
      "Use clear section titles as plain lines. Full document, not a chat stub.",
      "For HR/payroll/interview docs: practical internal draft; note that formal legal review may still be needed.",
      "End with: Document grounded in HENIMA memory / chat figures — estimates labeled when used.",
    ].join("\n");
  }
  return [
    "Kamu penulis dokumen internal perusahaan HENIMA.",
    "Tulis dokumen bisnis/perusahaan LENGKAP siap dijadikan PDF.",
    "HANYA pakai fakta dari Business Memory, angka operasional Gercep, dan angka yang owner tulis di chat.",
    "JANGAN mengarang omzet, kas, stok, jumlah karyawan, atau klaim hukum. Kalau belum ada di data, tulis 'belum tercatat' lalu lanjut bersyarat.",
    "Teks polos saja — tanpa markdown (** ## tabel).",
    "Pakai judul bagian sebagai baris biasa. Dokumen utuh, bukan chat singkat.",
    "Untuk HR/penggajian/wawancara: draft internal praktis; sebutkan boleh perlu review legal formal.",
    "Fokus HENIMA / bisnis owner — bukan dokumen generik perusahaan lain.",
    "Di akhir: satu baris 'Dokumen disusun dari memori HENIMA / angka chat — estimate diberi label.'",
  ].join("\n");
}

export function businessPdfUserHint(question: string, locale: "id" | "en" = "id"): string {
  if (locale === "en") {
    return [
      "Owner asked for a HENIMA business/company document (PDF).",
      "Write the FULL document body now.",
      `Request: ${question}`,
    ].join("\n");
  }
  return [
    "Owner minta dokumen bisnis/perusahaan HENIMA (PDF).",
    "Tulis ISI DOKUMEN LENGKAP sekarang (bukan ringkasan chat).",
    `Permintaan: ${question}`,
  ].join("\n");
}

export function pdfFileSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "henima-dokumen"
  );
}

/** Render plain text into a branded multi-page PDF (base64). */
export async function henimaBusinessTextToPdf(title: string, body: string): Promise<string> {
  const doc = await PDFDocument.create();
  const { sans, sansBold } = await embedBrandFonts(doc);
  const margin = 48;
  const size = 11;
  const leading = 16;
  const pageW = 595;
  const pageH = 842;
  const maxW = pageW - margin * 2;
  const ink = rgb(0.1, 0.1, 0.1);
  let page = doc.addPage([pageW, pageH]);
  let y = pageH - margin;

  const draw = (text: string, font: typeof sans, fontSize: number) => {
    const safe = text.replace(/[^\u0000-\u024F\u1E00-\u1EFF]/g, " ").replace(/\s+/g, " ").trim();
    if (!safe) return;
    if (y < margin + fontSize) {
      page = doc.addPage([pageW, pageH]);
      y = pageH - margin;
    }
    page.drawText(safe, { x: margin, y, size: fontSize, font, color: ink });
    y -= fontSize + 5;
  };

  draw(title || "Dokumen HENIMA", sansBold, 16);
  y -= 6;
  draw("HENIMA · Dokumen internal bisnis", sans, 9);
  y -= 10;

  const plain = toPlainChatText(body);
  for (const raw of plain.replace(/\r/g, "").split("\n")) {
    if (!raw.trim()) {
      y -= leading / 2;
      continue;
    }
    let rest = raw.trim();
    const isHeading = rest.length < 80 && !/[.!?]$/.test(rest) && /^[A-Z0-9À-ÿ]/.test(rest);
    const font = isHeading ? sansBold : sans;
    const fontSize = isHeading ? 12 : size;
    while (rest) {
      let cut = rest.length;
      while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), fontSize) > maxW) cut -= 1;
      if (cut < rest.length) {
        const space = rest.lastIndexOf(" ", cut);
        if (space > 24) cut = space;
      }
      draw(rest.slice(0, cut), font, fontSize);
      rest = rest.slice(cut).trim();
    }
  }

  return Buffer.from(await doc.save()).toString("base64");
}
