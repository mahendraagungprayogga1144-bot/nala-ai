import { todayWib } from "@/lib/date";
import { addDaysYmd, lastNMonthsRange, periodRange, type PeriodKind } from "../dates";
import type { SalesDb } from "../db";
import { createExpense, listExpenses } from "../expense-service";
import { fmtRp } from "../money";
import { buildSalesReport } from "../report-service";
import { salesInviteShareText } from "../sales-guide";
import { createStaff, listProducts, listStaff } from "../staff-service";
import type { Actor, ProductRow } from "../types";
import { formatCashPosition } from "./agent";
import { executeFounderCommand, parseFounderCommand } from "./founder-ops";
import { formatSalesBriefing, formatTeamRoster } from "./menu";
import type { BotEffect } from "./session";

export type DeskTool = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export type DeskToolCtx = {
  db: SalesDb;
  actor: Actor;
  catalog: ProductRow[];
};

export type DeskToolResult = { text: string; effects?: BotEffect[] };

function fn(name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []): DeskTool {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: { type: "object", properties, required },
    },
  };
}

const PERIOD_PROP = {
  periode: {
    type: "string",
    enum: ["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "this_year", "all"],
  },
  bulan: { type: "number", description: "N bulan terakhir, contoh 3" },
};

function rangeFromArgs(args: Record<string, unknown>) {
  const bulan = Number(args.bulan);
  if (bulan >= 1 && bulan <= 24) return lastNMonthsRange(bulan);
  const periode = String(args.periode || "this_month") as PeriodKind;
  return periodRange(periode);
}

export function deskToolsFor(actor: Actor): DeskTool[] {
  const tools: DeskTool[] = [
    fn("lihat_keuangan", "Omzet, HPP, biaya, laba/sisa uang operasional. Wajib untuk pertanyaan uang/profit.", PERIOD_PROP),
    fn("data_sales", "Performa per sales atau satu nama.", { ...PERIOD_PROP, nama: { type: "string" } }),
    fn("lihat_tim", "Daftar sales dan status CONNECTED/PENDING."),
    fn("lihat_produk", "Katalog parfum (harga, HPP, stok)."),
    fn("lihat_biaya", "Daftar pengeluaran operasional.", PERIOD_PROP),
    fn("catat_biaya", "Catat pengeluaran. Potong laba, bukan omzet.", {
      amount: { type: "number" },
      note: { type: "string" },
      kemarin: { type: "boolean" },
    }, ["amount"]),
    fn("kirim_pdf", "Kirim laporan PDF periode itu.", PERIOD_PROP),
    fn("kirim_nota", "Kirim nota/invoice customer.", { nama: { type: "string" } }),
    fn("lihat_riwayat", "Transaksi terbaru."),
    fn("lihat_target", "Target dan pencapaian."),
  ];
  if (actor.role === "FOUNDER" || actor.role === "LEADER") {
    tools.push(fn("rekrut_sales", "Buat sales baru + kode undangan Telegram.", { nama: { type: "string" } }, ["nama"]));
  }
  if (actor.role === "FOUNDER") {
    tools.push(
      fn("atur_perusahaan", "Ubah tagline, brand, target, harga, status sales, atau cek sistem. Pakai kalimat founder.", {
        perintah: { type: "string", description: "Contoh: tagline Parfum premium / target bulan 30 / harga afternoon 199999 / nonaktifkan sales Andi / status sistem" },
      }, ["perintah"]),
    );
  }
  return tools;
}

export async function runDeskTool(name: string, rawArgs: unknown, ctx: DeskToolCtx): Promise<DeskToolResult> {
  const args = (rawArgs && typeof rawArgs === "object" ? rawArgs : {}) as Record<string, unknown>;
  const { db, actor } = ctx;
  try {
    if (name === "lihat_keuangan") {
      const range = rangeFromArgs(args);
      const report = await buildSalesReport(db, actor, { kind: "custom", from: range.from, to: range.to });
      return { text: formatCashPosition(report) };
    }
    if (name === "data_sales") {
      const range = rangeFromArgs(args);
      const query = args.nama ? String(args.nama) : undefined;
      let salesId: string | undefined;
      let focus: string | undefined;
      if (query) {
        const staff = await listStaff(db, actor);
        const q = query.toLowerCase();
        const hit = staff.find((s) => s.nama.toLowerCase() === q) || staff.find((s) => s.nama.toLowerCase().includes(q));
        if (!hit) return { text: `Sales "${query}" tidak ada. Pakai lihat_tim.` };
        salesId = hit.id;
        focus = hit.nama;
      }
      const report = await buildSalesReport(db, actor, { kind: "custom", from: range.from, to: range.to, salesId });
      return { text: formatSalesBriefing(report, focus) };
    }
    if (name === "lihat_tim") {
      const staff = await listStaff(db, actor);
      return { text: formatTeamRoster(staff) };
    }
    if (name === "lihat_produk") {
      const products = ctx.catalog.length ? ctx.catalog : await listProducts(db, actor.businessId);
      if (!products.length) return { text: "Katalog kosong." };
      return {
        text: products.map((p) => `${p.name} · jual ${fmtRp(p.price || 0)} · HPP ${fmtRp(p.cost || 0)} · stok ${p.stock ?? 0}`).join("\n"),
      };
    }
    if (name === "lihat_biaya") {
      const range = rangeFromArgs(args);
      const rows = await listExpenses(db, actor, { from: range.from, to: range.to });
      const total = rows.reduce((s, r) => s + r.amount, 0);
      if (!rows.length) return { text: `Belum ada biaya (${range.label}).` };
      return {
        text: [`BIAYA ${range.label}`, ...rows.map((r) => `${r.expense_date} · ${r.note} · ${fmtRp(r.amount)}`), `Total ${fmtRp(total)}`].join("\n"),
      };
    }
    if (name === "catat_biaya") {
      const amount = Math.round(Number(args.amount) || 0);
      const row = await createExpense(db, actor, {
        amount,
        note: String(args.note || "Operasional"),
        expenseDate: args.kemarin ? addDaysYmd(todayWib(), -1) : todayWib(),
      });
      return { text: `Biaya tercatat: ${fmtRp(row.amount)} · ${row.note} (${row.expense_date}). Memotong laba, bukan omzet.` };
    }
    if (name === "kirim_pdf") {
      const range = rangeFromArgs(args);
      return {
        text: `Siap kirim PDF ${range.label}.`,
        effects: [{ type: "send_pdf", kind: "custom", from: range.from, to: range.to }],
      };
    }
    if (name === "kirim_nota") {
      const query = String(args.nama || "").trim() || undefined;
      return { text: query ? `Siap kirim nota ${query}.` : "Siap kirim nota terakhir.", effects: [{ type: "send_nota", query }] };
    }
    if (name === "lihat_riwayat") return { text: "Siap kirim riwayat.", effects: [{ type: "send_riwayat" }] };
    if (name === "lihat_target") return { text: "Siap kirim target.", effects: [{ type: "send_target" }] };
    if (name === "rekrut_sales") {
      if (actor.role === "SALES") return { text: "Rekrut hanya founder/leader." };
      const nama = String(args.nama || "").trim();
      if (nama.length < 2) return { text: "Nama sales wajib." };
      const row = await createStaff(db, actor, { nama, role: "SALES" });
      const share = salesInviteShareText({
        staffName: row.nama,
        code: row.invite_code || "",
        brandName: actor.businessName,
        botUsername: process.env.TELEGRAM_BOT_USERNAME,
      });
      return { text: `Sales ${row.nama} dicatat. Kode ${row.invite_code}.\n\n${share}` };
    }
    if (name === "atur_perusahaan") {
      if (actor.role !== "FOUNDER") return { text: "Hanya founder." };
      const cmd = parseFounderCommand(String(args.perintah || ""));
      if (cmd.type === "none") return { text: "Perintah tidak dikenali. Contoh: tagline … / target bulan 30 / status sistem." };
      return { text: await executeFounderCommand(db, actor, cmd) };
    }
    return { text: `Tool ${name} tidak ada.` };
  } catch (err) {
    return { text: err instanceof Error ? err.message : "Tool gagal." };
  }
}
