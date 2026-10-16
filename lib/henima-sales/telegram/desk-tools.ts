import { todayWib } from "@/lib/date";
import { addDaysYmd, lastNMonthsRange, periodRange, type PeriodKind } from "../dates";
import type { SalesDb } from "../db";
import { createExpense, listExpenses } from "../expense-service";
import { fmtRp } from "../money";
import { buildSalesReport } from "../report-service";
import { salesInviteShareText } from "../sales-guide";
import { listOrders } from "../order-service";
import { createStaff, listProducts, listStaff } from "../staff-service";
import type { Actor, ProductRow } from "../types";
import { formatCashPosition } from "./agent";
import { createAgentTask, listAgentTasks, salesCsv, salesXlsxBase64, saveAgentNote, setAgentTaskStatus, taskAfterWork, type TaskStatus } from "./agent-memory";
import { executeFounderCommand, needsFounderApproval, parseFounderCommand } from "./founder-ops";
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
  telegramUserId?: number | null;
};

const TOOL_ALIAS: Record<string, string> = {
  get_sales_summary: "lihat_keuangan",
  calculate_profit: "lihat_keuangan",
  analyze_sales_performance: "data_sales",
  generate_business_report: "data_sales",
  generate_pdf_report: "kirim_pdf",
  get_inventory: "lihat_produk",
  get_product_details: "lihat_produk",
};

export function resolveDeskTool(name: string) {
  const key = (name || "").trim();
  return TOOL_ALIAS[key] || key;
}

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
    fn("get_sales_transactions", "Daftar transaksi penjualan pada periode.", PERIOD_PROP),
    fn("generate_spreadsheet", "Kirim Excel XLSX penjualan. format=csv hanya jika user minta csv.", { ...PERIOD_PROP, format: { type: "string", enum: ["xlsx", "csv"] } }),
    fn("tulis_dokumen", "Kirim dokumen teks (txt atau md): proposal, SOP, briefing, surat, catatan.", {
      judul: { type: "string" },
      isi: { type: "string" },
      format: { type: "string", enum: ["txt", "md"] },
    }, ["judul", "isi"]),
    fn("save_business_note", "Simpan catatan bisnis jangka panjang.", { content: { type: "string" } }, ["content"]),
    fn("create_task", "Buat tugas status pending.", { title: { type: "string" }, detail: { type: "string" } }, ["title"]),
    fn("lihat_tugas", "Daftar tugas dengan status menunggu, dikerjakan, selesai, atau gagal."),
    fn("ubah_tugas", "Ubah status tugas. Jangan completed kalau pekerjaan gagal.", {
      id: { type: "string" },
      status: { type: "string", enum: ["pending", "running", "completed", "failed"] },
      hasil: { type: "string" },
    }, ["id", "status"]),
    fn("get_sales_summary", "Alias ringkasan penjualan.", PERIOD_PROP),
    fn("calculate_profit", "Hitung omzet, HPP, laba kotor, biaya, laba bersih.", PERIOD_PROP),
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

export async function runDeskTool(rawName: string, rawArgs: unknown, ctx: DeskToolCtx): Promise<DeskToolResult> {
  const name = resolveDeskTool(rawName);
  const args = (rawArgs && typeof rawArgs === "object" ? rawArgs : {}) as Record<string, unknown>;
  const { db, actor } = ctx;
  try {
    if (name === "get_sales_transactions") {
      const range = rangeFromArgs(args);
      const { rows } = await listOrders(db, actor, { from: range.from, to: range.to, pageSize: 8 });
      if (!rows.length) return { text: `Tidak ada transaksi ${range.label}.` };
      return {
        text: rows
          .map((o) => `${o.order_date} · ${o.payment_status} · ${fmtRp(Number(o.total || 0))}`)
          .join("\n"),
      };
    }
    if (name === "generate_spreadsheet") {
      const range = rangeFromArgs(args);
      const report = await buildSalesReport(db, actor, { kind: "custom", from: range.from, to: range.to });
      const rows = report.lines.map((line) => ({
        date: line.date,
        customer: line.customerName,
        qty: line.qty,
        omzet: line.cash + line.cashless,
        hpp: line.hpp,
        laba: line.profit,
      }));
      const wantCsv = String(args.format || "xlsx").toLowerCase() === "csv";
      const opened = await createAgentTask(db, actor, `Excel ${range.label}`, `${rows.length} baris`, "running");
      try {
        const file = wantCsv
          ? { content: salesCsv(rows), filename: `henima-${range.from}-${range.to}.csv`, mime: "text/csv", encoding: "utf8" as const }
          : {
              content: salesXlsxBase64(rows),
              filename: `henima-${range.from}-${range.to}.xlsx`,
              mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              encoding: "base64" as const,
            };
        if (!file.content) throw new Error("file kosong");
        if (opened.ok) await setAgentTaskStatus(db, actor, opened.id, taskAfterWork(true), `${file.filename} terkirim`);
        return {
          text: `${wantCsv ? "CSV" : "Excel"} ${range.label}: ${rows.length} baris. Omzet ${fmtRp(report.totalRevenue)}, laba kotor ${fmtRp(report.grossProfit ?? 0)}.`,
          effects: [{ type: "send_file", filename: file.filename, content: file.content, mime: file.mime, encoding: file.encoding, caption: `Penjualan ${range.label}` }],
        };
      } catch (err) {
        if (opened.ok) await setAgentTaskStatus(db, actor, opened.id, "failed", err instanceof Error ? err.message : "gagal buat file");
        return { text: "File gagal dibuat. Tugas ditandai GAGAL." };
      }
    }
    if (name === "tulis_dokumen") {
      const judul = String(args.judul || "catatan").replace(/[^\w .-]+/g, "").trim().slice(0, 60) || "catatan";
      const isi = String(args.isi || "").trim();
      if (isi.length < 2) return { text: "Isi dokumen kosong." };
      const ext = String(args.format || "md").toLowerCase() === "txt" ? "txt" : "md";
      return {
        text: `Dokumen ${judul}.${ext} siap dikirim.`,
        effects: [{
          type: "send_file",
          filename: `${judul}.${ext}`,
          content: isi,
          mime: "text/plain",
          encoding: "utf8",
          caption: judul,
        }],
      };
    }
    if (name === "save_business_note") {
      const saved = await saveAgentNote(db, actor, ctx.telegramUserId ?? null, String(args.content || ""));
      return { text: saved.message };
    }
    if (name === "create_task") {
      const made = await createAgentTask(db, actor, String(args.title || ""), args.detail ? String(args.detail) : undefined, "pending");
      return { text: made.text };
    }
    if (name === "lihat_tugas") {
      const listed = await listAgentTasks(db, actor);
      return { text: listed.text };
    }
    if (name === "ubah_tugas") {
      const status = String(args.status || "") as TaskStatus;
      if (!["pending", "running", "completed", "failed"].includes(status)) return { text: "Status harus pending, running, completed, atau failed." };
      return { text: await setAgentTaskStatus(db, actor, String(args.id || ""), status, args.hasil ? String(args.hasil) : undefined) };
    }
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
      if (needsFounderApproval(cmd)) {
        return { text: "Perubahan harga atau menonaktifkan sales butuh balasan YA di chat. Ketik perintahnya langsung, lalu YA." };
      }
      return { text: await executeFounderCommand(db, actor, cmd) };
    }
    return { text: `Tool ${name} tidak ada.` };
  } catch (err) {
    return { text: err instanceof Error ? err.message : "Tool gagal." };
  }
}
