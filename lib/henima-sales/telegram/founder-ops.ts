import { todayWib } from "@/lib/date";
import type { SalesDb } from "../db";
import { telegramConfigured } from "./api";
import { deepseekConfigured } from "./deepseek";
import { parseIdrAmountToken } from "./nl-sale";
import { getSalesSettings, upsertSalesSettings } from "../settings-service";
import { listProducts, listStaff, setStaffStatus, upsertSalesProduct } from "../staff-service";
import { upsertTarget } from "../target-service";
import type { Actor, TargetPeriod } from "../types";
import { fmtRp } from "../money";

export type FounderCommand =
  | { type: "refuse_os" }
  | { type: "status" }
  | { type: "help" }
  | { type: "disable"; nama: string }
  | { type: "enable"; nama: string }
  | { type: "tagline"; tagline: string }
  | { type: "brand"; name: string }
  | { type: "target"; period: TargetPeriod; qty: number }
  | { type: "price"; product: string; price: number }
  | { type: "none" };

export function founderOpsHelp() {
  return [
    "KENDALI FOUNDER",
    "Telegram ini mengatur perusahaan Henima Sales — bukan terminal server.",
    "",
    "Yang bisa diubah dari sini:",
    "tagline Parfum premium",
    "nama bisnis Henima Scent",
    "target bulan 30",
    "harga afternoon 199999",
    "nonaktifkan sales Andi",
    "aktifkan sales Andi",
    "rekrut sales Andi",
    "status sistem",
    "",
    "Tidak dijalankan: shell, SSH, eval, tulis file, deploy kode.",
  ].join("\n");
}

export function looksLikeOsProgram(text: string) {
  const t = text.toLowerCase().replace(/\s+/g, " ").trim();
  return /\b((?:me|ng)?(?:pro)?gram(?:kan)?\s+(?:server|vps|hosting)|memprogram|ngerogram|merogram|jalankan kode|run (?:code|command|shell)|remote code|ssh\b|sudo\b|eval\(|exec\(|rm\s+-rf|child_process|tulis file|write file|deploy (?:kode|script)|terminal server|bash -c)\b/.test(
    t,
  );
}

export function needsFounderApproval(cmd: FounderCommand) {
  return cmd.type === "price" || cmd.type === "disable";
}

export function parseFounderCommand(text: string): FounderCommand {
  const raw = (text || "").replace(/\s+/g, " ").trim();
  if (!raw) return { type: "none" };
  const t = raw.toLowerCase();
  if (looksLikeOsProgram(t)) return { type: "refuse_os" };
  if (/^(status sistem|status server|health|cek sistem|cek server)$/.test(t)) return { type: "status" };
  if (/^(kendali|atur perusahaan|founder help|ops)$/.test(t)) return { type: "help" };

  const off = raw.match(
    /^(?:nonaktif(?:kan)?|matikan|pecat|offboard|disable)\s+(?:sales\s+)?(.+)$/i,
  );
  if (off) return { type: "disable", nama: off[1].trim() };

  const on = raw.match(/^(?:aktif(?:kan)?|nyalakan|enable)\s+(?:sales\s+)?(.+)$/i);
  if (on) return { type: "enable", nama: on[1].trim() };

  const tag = raw.match(/^(?:tagline|slogan)\s+(.+)$/i);
  if (tag) return { type: "tagline", tagline: tag[1].trim() };

  const brand = raw.match(/^(?:nama bisnis|ganti brand|brand)\s+(.+)$/i);
  if (brand) return { type: "brand", name: brand[1].trim() };

  const tgt = t.match(
    /^(?:set\s+)?target\s+(hari(?:an)?|harian|minggu(?:an)?|bulan(?:an)?|daily|weekly|monthly)\s+(\d{1,4})\b/,
  );
  if (tgt) {
    const period: TargetPeriod = /hari|daily/.test(tgt[1]) ? "daily" : /minggu|week/.test(tgt[1]) ? "weekly" : "monthly";
    return { type: "target", period, qty: Number(tgt[2]) };
  }

  const price = raw.match(/^(?:harga|price)\s+(.+?)\s+([\d.,]+)\s*(rb|ribu|k|jt|juta)?$/i);
  if (price) {
    const amount = parseIdrAmountToken(price[2], price[3]);
    if (amount && amount > 0) return { type: "price", product: price[1].trim(), price: amount };
  }

  return { type: "none" };
}

async function findStaffByName(db: SalesDb, actor: Actor, nama: string) {
  const staff = await listStaff(db, actor);
  const q = nama.toLowerCase();
  return (
    staff.find((s) => s.nama.toLowerCase() === q) ||
    staff.find((s) => s.nama.toLowerCase().includes(q) && s.role !== "FOUNDER")
  );
}

export async function executeFounderCommand(db: SalesDb, actor: Actor, cmd: FounderCommand): Promise<string> {
  if (actor.role !== "FOUNDER") return "Kendali ini hanya untuk founder.";
  if (cmd.type === "refuse_os") {
    return founderOpsHelp();
  }
  if (cmd.type === "help") return founderOpsHelp();
  if (cmd.type === "status") {
    return [
      "STATUS SISTEM HENIMA SALES",
      `Telegram bot: ${telegramConfigured() ? "siap" : "token belum ada"}`,
      `DeepSeek: ${deepseekConfigured() ? "siap" : "belum terpasang"}`,
      "",
      "Ini kesehatan modul penjualan. Bukan akses OS server.",
    ].join("\n");
  }
  if (cmd.type === "disable" || cmd.type === "enable") {
    const row = await findStaffByName(db, actor, cmd.nama);
    if (!row) return `Sales "${cmd.nama}" tidak ketemu. Ketik tim.`;
    if (row.role === "FOUNDER") return "Akun founder tidak bisa dinonaktifkan dari sini.";
    const next = cmd.type === "disable" ? "disabled" : "active";
    const saved = await setStaffStatus(db, actor, row.id, next);
    return cmd.type === "disable"
      ? `${saved.nama} dinonaktifkan. Telegram dan kode undangan diputus. Riwayat tetap.`
      : `${saved.nama} diaktifkan kembali.`;
  }
  if (cmd.type === "tagline") {
    const cur = await getSalesSettings(db, actor.businessId, actor.businessName);
    await upsertSalesSettings(db, actor, { displayName: cur.displayName, tagline: cmd.tagline });
    return `Tagline disimpan:\n${cmd.tagline}`;
  }
  if (cmd.type === "brand") {
    const cur = await getSalesSettings(db, actor.businessId, actor.businessName);
    await upsertSalesSettings(db, actor, { displayName: cmd.name, tagline: cur.tagline });
    return `Nama bisnis disimpan:\n${cmd.name}`;
  }
  if (cmd.type === "target") {
    await upsertTarget(db, actor, {
      periodType: cmd.period,
      quantityTarget: cmd.qty,
      effectiveFrom: todayWib(),
    });
    const label = cmd.period === "daily" ? "harian" : cmd.period === "weekly" ? "mingguan" : "bulanan";
    return `Target ${label} perusahaan: ${cmd.qty} pcs.`;
  }
  if (cmd.type === "price") {
    const products = await listProducts(db, actor.businessId);
    const q = cmd.product.toLowerCase();
    const hit = products.find((p) => p.name.toLowerCase() === q) || products.find((p) => p.name.toLowerCase().includes(q));
    if (!hit) return `Produk "${cmd.product}" tidak ada di katalog.`;
    await upsertSalesProduct(db, actor, {
      id: hit.id,
      name: hit.name,
      price: cmd.price,
      cost: hit.cost,
      stock: hit.stock ?? 0,
      unit: hit.unit,
    });
    return `Harga ${hit.name} → ${fmtRp(cmd.price)}`;
  }
  return founderOpsHelp();
}
