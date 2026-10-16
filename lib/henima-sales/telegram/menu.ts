import type { Actor, StaffRow } from "../types";
import { fmtRp } from "../money";
import type { SalesReport } from "../report-service";

type MenuKeyboard = { text: string; data: string }[][];

export function isManager(actor: Actor) {
  return actor.role === "FOUNDER" || actor.role === "LEADER";
}

export function mainMenuKeyboard(actor: Actor): MenuKeyboard {
  const rows: { text: string; data: string }[][] = [
    [
      { text: "Catat penjualan", data: "m:sale" },
      { text: "Riwayat", data: "m:hist" },
    ],
    [
      { text: "Rekap hari ini", data: "m:today" },
      { text: "PDF bulan ini", data: "m:pdf" },
    ],
    [
      { text: "Nota", data: "m:nota" },
      { text: "Target", data: "m:tgt" },
    ],
  ];
  if (isManager(actor)) {
    rows.push([
      { text: "Tim", data: "m:team" },
      { text: "Data sales", data: "m:data" },
    ]);
    rows.push([
      { text: "Rekrut sales", data: "m:hire" },
      { text: "Keuangan", data: "m:fin" },
    ]);
  } else {
    rows.push([{ text: "Bantuan", data: "m:help" }]);
  }
  return rows;
}

export function helpText(actor: Actor) {
  const common = [
    "HENIMA SALES",
    actor.businessName,
    `${actor.nama} · ${actor.role}`,
    "",
    "Ketik santai. Bahasa apa pun. Atau tekan menu.",
    "",
    "PENJUALAN",
    "laku 1 afternoon 130rb atas nama Sinta no 08… qris",
    "sold 2 the distance 250k for Dimas phone 08… cash",
    "",
    "LAPORAN",
    "rekapan hari ini · pdf bulan ini · nota Sinta · riwayat · target",
    "",
    "BIAYA (memotong laba, bukan omzet)",
    "pengeluaran 100rb buat bensin",
  ];
  if (isManager(actor)) {
    common.push(
      "",
      "MANAJEMEN",
      "tim — daftar sales + status akun",
      "data sales — omzet per orang bulan ini",
      "omzet Andi — data satu sales",
      "rekrut sales Andi — undangan Telegram baru",
      "keuangan perusahaan — PDF laba",
    );
  }
  common.push("", "Perintah: /menu  /start  /help");
  return common.join("\n");
}

export function staffStatusLabel(row: Pick<StaffRow, "status" | "telegram_user_id" | "invite_code">) {
  if (row.status === "disabled") return "NONAKTIF";
  if (row.telegram_user_id) return "CONNECTED";
  if (row.invite_code) return `PENDING · /start ${row.invite_code}`;
  return "PENDING";
}

export function formatTeamRoster(staff: StaffRow[]) {
  const people = staff.filter((s) => s.role !== "FOUNDER");
  if (!people.length) {
    return "Belum ada sales.\nRekrut: ketik rekrut sales Nama";
  }
  const lines = ["TIM PENJUALAN", ""];
  for (const s of people) {
    lines.push(`${s.nama} · ${s.role}`);
    lines.push(staffStatusLabel(s));
    lines.push("");
  }
  lines.push("Rekrut: rekrut sales Nama");
  lines.push("Data: data sales  ·  omzet Nama");
  return lines.join("\n").trim();
}

export function formatSalesBriefing(report: SalesReport, focusName?: string) {
  const title = focusName
    ? `DATA SALES · ${focusName.toUpperCase()}`
    : report.scope === "self"
      ? "DATA KAMU"
      : report.scope === "team"
        ? "DATA TIM"
        : "DATA PERUSAHAAN";
  const lines = [
    title,
    report.range.label,
    "",
    `Transaksi  ${report.totalOrders}`,
    `Volume     ${report.totalQty} pcs`,
    `Omzet      ${fmtRp(report.totalRevenue)}`,
  ];
  if (report.opexTotal) {
    lines.push(`HPP        ${fmtRp(report.hppTotal || 0)}`);
    lines.push(`Laba kotor ${fmtRp(report.grossProfit ?? 0)}`);
    lines.push(`Biaya      ${fmtRp(report.opexTotal)}`);
    lines.push(`Laba bersih ${fmtRp(report.profitTotal || 0)}`);
  }
  if (report.byProduct.length) {
    lines.push("", "PRODUK");
    for (const p of report.byProduct.slice(0, 6)) {
      lines.push(`${p.name}  ${p.qty} pcs  ${fmtRp(p.omzet)}`);
    }
  }
  if (report.ranking.length && report.scope !== "self") {
    lines.push("", "PER SALES");
    report.ranking.slice(0, 12).forEach((s, i) => {
      lines.push(`${i + 1}. ${s.nama}  ${s.qty} pcs  ${fmtRp(s.revenue)}  ${s.count} trx`);
    });
  }
  return lines.join("\n");
}

export function recruitPrompt() {
  return "Nama sales baru?\nContoh: rekrut sales Andi";
}

export function parseRecruitName(text: string): string | null {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (/^(?:\/)?(?:rekrut|recruit|undang|hire|tambah(?:\s+sales)?|add\s+sales)(?:\s+sales)?(?:\s+baru)?$/.test(t)) {
    return "";
  }
  const m = t.match(
    /^(?:\/)?(?:rekrut|recruit|undang|hire|tambah(?:\s+sales)?|add\s+sales)(?:\s+sales)?(?:\s+baru)?[:\s]+(.+)$/i,
  );
  if (!m) return null;
  const nama = m[1].replace(/["']/g, "").trim();
  if (!nama || /^(sales|baru|nama)$/i.test(nama)) return "";
  return nama.slice(0, 60);
}
