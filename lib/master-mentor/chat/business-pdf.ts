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
  if (isPdfExportFollowUp(q)) return true;
  if (/(buat|bikin|buatkan|bikinin|susun|unduh|download|export|jadikan|generate|kirim|kirimkan).{0,48}(pdf|dokumen)/i.test(q)) {
    return true;
  }
  return /\b(pdf|proposal|profil\s+perusahaan|company\s+profile|visi\s*misi|visi\s+perusahaan|misi\s+perusahaan|pitch(\s*deck)?|mou\b|kerja\s*sama|partnership|sop\b|peraturan\s+(perusahaan|karyawan|kepegawaian|penggajian)|kebijakan\s+(hr|sdm|gaji|penggajian)|panduan\s+wawancara|interview\s+guide|job\s*desc|deskripsi\s+pekerjaan|kontrak\s+kerja|surat\s+perjanjian|perjanjian\s+kerja|calon\s+karyawan|offer\s+letter|sistem\s+(henima|kerja|operasional)|penggajian|gaji\s+karyawan|laporan\s+(mingguan|harian|bulanan)|rencana\s+mingguan|company\s+deck|ringkasan\s+perusahaan|dokumen\s+(bisnis|perusahaan|internal)|brief\s+perusahaan|company\s+brief)\b/i.test(
    q,
  );
}

/**
 * Short follow-up: "buatkan pdfnya" / "kirim pdf" → export last mentor reply.
 */
export function isPdfExportFollowUp(question: string): boolean {
  const q = question.trim().toLowerCase().replace(/[!?.,]+$/g, "").trim();
  if (!q || q.length > 100) return false;
  if (/^(pdf|pdfnya)(\s+(dong|bro|ya|please|pls|sekarang))?$/.test(q)) return true;
  if (/^(tolong\s+)?(buatkan|bikinin|bikin|buat|kirim|kirimkan|unduh|download|export)\s+(pdf|pdfnya|dokumen|dokumennya)(\s+(dong|bro|ya|please|pls|sekarang))?$/.test(q)) {
    return true;
  }
  if (/^(mentor\s+)?(kirim|kirimkan)\s+(pdf|pdfnya)/.test(q)) return true;
  return false;
}

export function businessPdfTitle(question: string, priorUserAsk?: string | null): string {
  const q = `${question} ${priorUserAsk || ""}`.toLowerCase();
  if (/proposal|investor|pitch/.test(q)) return "Proposal Bisnis HENIMA";
  if (/profil|company\s+profile|ringkasan\s+perusahaan/.test(q)) return "Profil Perusahaan HENIMA";
  if (/visi|misi/.test(q)) return "Visi & Misi HENIMA";
  if (/surat\s+perjanjian|perjanjian\s+kerja|kontrak\s+kerja|offer\s+letter|calon\s+karyawan/.test(q)) {
    return "Surat Perjanjian / Offer Karyawan HENIMA";
  }
  if (/penggajian|gaji\s+karyawan|payroll|komisi/.test(q)) return "Sistem Penggajian & Komisi HENIMA";
  if (/peraturan|kebijakan\s+hr|kepegawaian/.test(q)) return "Peraturan Internal HENIMA";
  if (/wawancara|interview/.test(q)) return "Panduan Wawancara HENIMA";
  if (/sop|sistem\s+(henima|kerja|operasional)/.test(q)) return "SOP & Sistem Kerja HENIMA";
  if (/laporan\s+mingguan|rencana\s+mingguan|mingguan/.test(q)) return "Rencana / Laporan Mingguan HENIMA";
  if (/kerja\s*sama|mou|partnership/.test(q)) return "Dokumen Kerja Sama HENIMA";
  if (/job\s*desc|deskripsi\s+pekerjaan/.test(q)) return "Job Description HENIMA";
  if (/rekrut|karyawan|sales/.test(q)) return "Rencana Tim & Komisi HENIMA";
  if (/penjualan|omzet|kas|stok/.test(q)) return "Rencana Bisnis HENIMA";
  return "Dokumen Internal HENIMA";
}

export function buildBusinessPdfSystem(locale: "id" | "en" = "id"): string {
  if (locale === "en") {
    return [
      "You are HENIMA's internal business document writer — think like a practical human ops/HR mentor.",
      "Write a COMPLETE company document ready for PDF: SOP, employment offer/agreement draft, payroll system, weekly plan, company profile, etc.",
      "HUMAN LOGIC allowed: sensible process steps, clear rules, fair commission structures, interview rubrics, weekly checklists — drafted for HENIMA Perfume / owner context.",
      "HARD FACTS (revenue, cash, stock counts, legal registration numbers): ONLY from Business Memory, Gercep intel, or figures the owner typed. Never invent those.",
      "If a number is missing, use placeholders like [isi gaji pokok] or 'belum tercatat' — do not fake Rp amounts.",
      "Plain text only — no markdown (** ## tables).",
      "Label drafts that need lawyer/notary review when they are legal-ish (contracts).",
      "End with one line: Draft from HENIMA context — hard numbers only from memory/chat; process text is practical draft.",
    ].join("\n");
  }
  return [
    "Kamu penulis dokumen internal HENIMA — berpikir seperti mentor operasional/HR manusia yang praktis.",
    "Tulis DOKUMEN LENGKAP siap PDF: SOP, surat perjanjian/offer calon karyawan, sistem penggajian, rencana mingguan, profil perusahaan, dll.",
    "BOLEH menyusun draf logis ala manusia: alur kerja, aturan jelas, skema komisi adil, rubrik wawancara, checklist mingguan — disesuaikan konteks HENIMA Perfume / owner.",
    "ANGKA KERAS (omzet, kas, stok, NIB, dll.): HANYA dari Business Memory, intel Gercep, atau angka yang owner tulis di chat. Jangan dikarang.",
    "Kalau angka belum ada, pakai placeholder seperti [isi gaji pokok] atau 'belum tercatat' — jangan mengarang nominal Rp.",
    "Teks polos saja — tanpa markdown (** ## tabel).",
    "Untuk kontrak/perjanjian: sebut ini draf internal; sebaiknya dicek legal/notaris sebelum dipakai resmi.",
    "Fokus HENIMA / bisnis owner — bukan template perusahaan asing generik.",
    "Di akhir satu baris: Draf dari konteks HENIMA — angka keras hanya dari memori/chat; isi proses adalah draf praktis.",
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
