import { createClient } from "@/lib/supabase/server";
import { loadTeamIds, resolveActorByUserId } from "@/lib/henima-sales/authz";
import { salesDb } from "@/lib/henima-sales/db";
import { namedMonthWindow, periodRange, type PeriodKind } from "@/lib/henima-sales/dates";
import { SALES_ORDER_SOURCE } from "@/lib/henima-sales/types";
import { getPublicShareOrigin } from "@/lib/auth/app-url";
import { officeRepository, type OfficeFacts, type OfficeProductRow, type OfficeWindow, type StockAdjustResult } from "./repository";
import {
  LAPORAN_AGENT_ID,
  MARKETING_AGENT_ID,
  SALES_AGENT_ID,
  SOFTWARE_AGENT_ID,
  SOSMED_AGENT_ID,
  STOK_AGENT_ID,
  WA_AGENT_ID,
  type OfficeAgent,
  type OfficeSnapshot,
} from "./types";
import {
  companyTask,
  fieldTaskTail,
  formatCompanyReport,
  formatCustomers,
  formatFollowUps,
  formatPayments,
  formatProduction,
  formatProducts,
  formatProfit,
  formatRanking,
  formatTarget,
  formatUnpaid,
  loadCompanyBrief,
  productionQueue,
  type CompanyBrief,
} from "./company";
import { describeWa, loadWaDesk, type WaDesk } from "./wa-reply";

const KIND_LABEL: Record<string, string> = {
  checkin_pagi: "check-in pagi",
  checkin_sore: "check-in sore",
  visit: "kunjungan",
  ping: "posisi",
};

function rp(amount: number) {
  return `Rp${Math.round(amount).toLocaleString("id-ID")}`;
}

function wibClock(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function kindLabel(kind: string) {
  return KIND_LABEL[kind] || kind || "titik";
}

function noticesOf(facts: OfficeFacts) {
  return [facts.orders.notice, facts.pemasukan.notice, facts.staff.notice, facts.points.notice, facts.products.notice].filter(
    (item): item is string => Boolean(item),
  );
}

function isCritical(product: OfficeProductRow) {
  return product.stock <= product.min_stock;
}

function orderSummary(facts: OfficeFacts) {
  const rows = facts.orders.ok ? facts.orders.rows.filter((row) => row.payment_status !== "CANCELLED") : [];
  const paid = rows.filter((row) => (row.payment_status || "PAID") === "PAID");
  const omzet = paid.reduce((sum, row) => sum + row.total, 0);
  const book = facts.salesBook ? `Henima Sales (${facts.salesBook})` : "Henima Sales";
  const pemasukan = facts.pemasukan.ok ? facts.pemasukan.rows : 0;
  return { orders: paid, pending: rows.length - paid.length, omzet, book, pemasukan };
}

function laporanTask(facts: OfficeFacts) {
  if (!facts.orders.ok) return facts.orders.notice || "Henima Sales belum terbaca.";
  const { orders, pending, omzet, book } = orderSummary(facts);
  if (!orders.length && !pending) return `${book}: belum ada order hari ini.`;
  const unpaid = pending ? ` ${pending} belum lunas.` : "";
  return `${book} hari ini: ${orders.length} order lunas, omzet ${rp(omzet)}.${unpaid}`;
}

function laporanWorking(facts: OfficeFacts) {
  const { orders, pending } = orderSummary(facts);
  return orders.length > 0 || pending > 0;
}

function staffName(facts: OfficeFacts, staffId: string) {
  return facts.staff.rows.find((row) => row.id === staffId)?.nama || "Sales";
}

function sellersInRange(facts: OfficeFacts) {
  const ids = new Set(
    facts.orders.rows.filter((row) => row.source === SALES_ORDER_SOURCE && row.sales_id).map((row) => row.sales_id as string),
  );
  return [...ids].map((id) => staffName(facts, id));
}

function peopleOut(facts: OfficeFacts) {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const point of facts.points.rows) {
    if (seen.has(point.staff_id)) continue;
    seen.add(point.staff_id);
    names.push(staffName(facts, point.staff_id));
  }
  return names;
}

function salesTask(facts: OfficeFacts) {
  if (!facts.points.ok && !facts.orders.ok) return "Kondisi lapangan belum terbaca.";
  if (!facts.points.ok) {
    const sellers = facts.orders.ok ? sellersInRange(facts) : [];
    const unread = facts.points.notice || "Tracking hari ini belum terbaca.";
    if (sellers.length) return `${sellers.join(", ")} ada order Henima hari ini. ${unread}`;
    if (facts.orders.ok && facts.orders.rows.some((row) => row.source === SALES_ORDER_SOURCE)) {
      return `Ada order Henima hari ini. ${unread}`;
    }
    return unread;
  }
  const out = peopleOut(facts);
  const last = facts.points.rows[0];
  if (out.length && last) {
    const late = last.late ? ", telat" : "";
    return `${out.join(", ")} di lapangan. Terakhir ${staffName(facts, last.staff_id)} ${kindLabel(last.kind)} pukul ${wibClock(last.recorded_at)}${late}.`;
  }
  const sellers = facts.orders.ok ? sellersInRange(facts) : [];
  if (sellers.length) return `${sellers.join(", ")} ada order Henima hari ini. Belum ada titik tracking.`;
  if (facts.orders.ok && facts.orders.rows.some((row) => row.source === SALES_ORDER_SOURCE)) {
    return "Ada order Henima hari ini. Belum ada titik tracking.";
  }
  return "Belum ada yang di lapangan hari ini.";
}

function salesWorking(facts: OfficeFacts) {
  if (facts.points.ok && facts.points.rows.length > 0) return true;
  return facts.orders.ok && facts.orders.rows.some((row) => row.source === SALES_ORDER_SOURCE);
}

function stockTask(facts: OfficeFacts) {
  if (!facts.products.ok) return "Stok belum terbaca.";
  const products = facts.products.rows;
  if (!products.length) return "Belum ada produk di inventory.";
  const critical = products.filter(isCritical).sort((a, b) => a.stock - b.stock);
  if (!critical.length) return `Stok aman. ${products.length} produk, tidak ada yang di bawah batas.`;
  const worst = critical[0];
  const unit = worst.unit ? ` ${worst.unit}` : "";
  return `${critical.length} produk kritis. ${worst.name} sisa ${worst.stock}${unit}.`;
}

function stockStatus(facts: OfficeFacts): OfficeAgent["status"] {
  if (!facts.products.ok) return "idle";
  if (!facts.products.rows.length) return "idle";
  if (facts.products.rows.some(isCritical)) return "error";
  return "working";
}

export type OfficeDraft = { judul: string | null; caption: string; channel: string | null; jadwal: string | null };

function channelLabel(channel: string | null) {
  if (channel === "instagram") return "Instagram";
  if (channel === "tiktok") return "TikTok";
  if (channel === "whatsapp") return "WhatsApp";
  return channel || "kanal lain";
}

function draftLine(draft: OfficeDraft) {
  const title = draft.judul?.trim() || "Tanpa judul";
  const when = draft.jadwal ? `, jadwal ${draft.jadwal}` : "";
  return `${title} (${channelLabel(draft.channel)}${when})`;
}

export async function loadOfficeDrafts(db: Awaited<ReturnType<typeof createClient>>, businessId: string): Promise<OfficeDraft[] | null> {
  const { data, error } = await db
    .from("module_marketing_drafts")
    .select("judul, caption, channel, jadwal, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return null;
  return (data || []).map((row) => ({
    judul: row.judul ? String(row.judul) : null,
    caption: String(row.caption || ""),
    channel: row.channel ? String(row.channel) : null,
    jadwal: row.jadwal ? String(row.jadwal) : null,
  }));
}

function softwareTask(facts: OfficeFacts, drafts: OfficeDraft[] | null) {
  const live = [
    facts.orders.ok ? "penjualan" : null,
    facts.products.ok ? "stok" : null,
    facts.points.ok ? "lapangan" : null,
    drafts ? "draft marketing" : null,
  ].filter((item): item is string => Boolean(item));
  if (!live.length) return "Software belum terbaca. Muat ulang kantor.";
  return `Software hidup: ${live.join(", ")}.`;
}

function sosmedDrafts(drafts: OfficeDraft[]) {
  return drafts.filter((draft) => draft.channel === "instagram" || draft.channel === "tiktok");
}

function marketingDrafts(drafts: OfficeDraft[]) {
  return drafts.filter((draft) => draft.channel === "whatsapp" || Boolean(draft.jadwal));
}

function listDrafts(rows: OfficeDraft[], empty: string) {
  if (!rows.length) return empty;
  return rows
    .slice(0, 5)
    .map((draft) => draftLine(draft))
    .join("; ");
}

export function buildOfficeSnapshot(
  facts: OfficeFacts,
  wa?: WaDesk | null,
  brief?: CompanyBrief | null,
  drafts: OfficeDraft[] | null = null,
): OfficeSnapshot {
  const laporanBusy = brief ? brief.paidCount > 0 || brief.pendingCount > 0 : laporanWorking(facts);
  const salesBusy = salesWorking(facts);
  const jobs = brief && facts.products.ok ? productionQueue(facts.products.rows, brief.products) : [];
  const stock = jobs.length ? "error" : stockStatus(facts);
  const agents: OfficeAgent[] = [
    {
      id: LAPORAN_AGENT_ID,
      business_id: facts.businessId,
      name: "Laporan Harian",
      division: "kantor",
      room: "founder",
      place: "desk",
      status: laporanBusy ? "working" : "idle",
      at_pantry: false,
      current_task: brief ? companyTask(brief) : laporanTask(facts),
      color: "#2DD4BF",
    },
    {
      id: SALES_AGENT_ID,
      business_id: facts.businessId,
      name: "Monitor Sales",
      division: "kantor",
      room: "sales",
      place: "desk",
      status: salesBusy ? "working" : "idle",
      at_pantry: facts.staff.ok && facts.points.ok && !salesBusy,
      current_task: brief ? `${salesTask(facts)} ${fieldTaskTail(brief)}`.trim() : salesTask(facts),
      color: "#A78BFA",
    },
    {
      id: STOK_AGENT_ID,
      business_id: facts.businessId,
      name: "Stok & Produksi",
      division: "kantor",
      room: "ops",
      place: "desk",
      status: stock,
      at_pantry: false,
      current_task: jobs.length ? `${jobs.length} perlu diproduksi. ${jobs[0].name} ${jobs[0].make} ${jobs[0].unit}.` : stockTask(facts),
      color: "#F59E0B",
    },
    {
      id: WA_AGENT_ID,
      business_id: facts.businessId,
      name: "Balas WA",
      division: "kantor",
      room: "sales",
      place: "hall",
      status: wa?.today ? "working" : "idle",
      at_pantry: false,
      current_task: wa?.notice
        ? wa.notice
        : !wa?.path
          ? "Tautan WA belum siap."
          : wa.today
            ? `${wa.today} chat masuk hari ini. Balasan otomatis menyala.`
            : "Tautan siap. Belum ada chat hari ini.",
      color: "#25D366",
    },
    {
      id: SOFTWARE_AGENT_ID,
      business_id: facts.businessId,
      name: "Meja Software",
      division: "software",
      room: "founder",
      place: "hall",
      status: facts.orders.ok && facts.products.ok ? "working" : "idle",
      at_pantry: false,
      current_task: softwareTask(facts, drafts),
      color: "#38BDF8",
    },
    {
      id: SOSMED_AGENT_ID,
      business_id: facts.businessId,
      name: "Divisi Sosmed",
      division: "sosmed",
      room: "sales",
      place: "hall",
      status: drafts && sosmedDrafts(drafts).length ? "working" : "idle",
      at_pantry: false,
      current_task: drafts
        ? sosmedDrafts(drafts).length
          ? `${sosmedDrafts(drafts).length} draft sosmed menunggu. ${draftLine(sosmedDrafts(drafts)[0])}.`
          : "Belum ada draft Instagram atau TikTok."
        : "Draft sosmed belum terbaca.",
      color: "#F472B6",
    },
    {
      id: MARKETING_AGENT_ID,
      business_id: facts.businessId,
      name: "Divisi Marketing",
      division: "marketing",
      room: "ops",
      place: "hall",
      status: drafts && marketingDrafts(drafts).length ? "working" : "idle",
      at_pantry: false,
      current_task: drafts
        ? marketingDrafts(drafts).length
          ? `${marketingDrafts(drafts).length} kampanye tersimpan. ${draftLine(marketingDrafts(drafts)[0])}.`
          : "Belum ada draft kampanye."
        : "Draft marketing belum terbaca.",
      color: "#FB7185",
    },
  ];
  const working = agents.filter((agent) => agent.status === "working");
  return {
    business_id: facts.businessId,
    agents,
    crew_active: working.length,
    crew_total: agents.length,
    tasks_running: working.filter((agent) => agent.current_task).length,
    notices: [...noticesOf(facts), ...(wa?.notice ? [wa.notice] : [])],
    wa_path: wa?.path ?? null,
    wa_url: wa?.path ? `${getPublicShareOrigin()}${wa.path}` : null,
    products: facts.products.ok
      ? facts.products.rows.map((row) => ({
          id: row.id,
          name: row.name,
          stock: row.stock,
          min_stock: row.min_stock,
          unit: row.unit,
        }))
      : [],
  };
}

async function applyHenimaBook(facts: OfficeFacts, preferredBusinessId: string, window: OfficeWindow) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    facts.orders = { ok: false, notice: "Masuk dulu untuk membaca Henima Sales.", rows: [] };
    return;
  }
  try {
    const admin = salesDb();
    const actor = await resolveActorByUserId(admin, user.id, preferredBusinessId);
    let query = admin
      .from("orders")
      .select("total, sales_id, payment_status")
      .eq("business_id", actor.businessId)
      .eq("source", SALES_ORDER_SOURCE)
      .is("deleted_at", null)
      .gte("order_date", window.from)
      .lte("order_date", window.to)
      .limit(1000);
    if (actor.role === "SALES") query = query.eq("sales_id", actor.staffId);
    else if (actor.role === "LEADER") {
      const team = await loadTeamIds(admin, actor);
      query = query.in("sales_id", [actor.staffId, ...team]);
    }
    const { data, error } = await query;
    if (error) {
      facts.orders = { ok: false, notice: "Henima Sales belum bisa dibaca. Coba muat ulang.", rows: [] };
      return;
    }
    facts.orders = {
      ok: true,
      notice: null,
      rows: (data || []).map((row) => ({
        total: Number(row.total) || 0,
        source: SALES_ORDER_SOURCE,
        sales_id: row.sales_id ? String(row.sales_id) : null,
        payment_status: row.payment_status ? String(row.payment_status) : "PAID",
      })),
    };
    facts.salesBook = actor.businessName;
    const { data: staff } = await admin.from("module_sales_staff").select("id, nama, role").eq("business_id", actor.businessId);
    const known = new Set(facts.staff.rows.map((row) => row.id));
    for (const row of staff || []) {
      const id = String(row.id);
      if (known.has(id)) continue;
      facts.staff.rows.push({ id, nama: String(row.nama || "Sales"), role: String(row.role || "") });
    }
  } catch {
    facts.orders = { ok: false, notice: "Henima Sales belum tersambung.", rows: [] };
  }
}

export async function loadOfficeSnapshot(businessId: string): Promise<OfficeSnapshot> {
  const id = businessId.trim();
  if (!id) throw new Error("active_business_id kosong.");
  const db = await createClient();
  const facts = await officeRepository.loadFacts(db, id);
  const today = periodRange("today");
  await applyHenimaBook(facts, id, { from: today.from, to: today.to });
  const wa = await loadWaDesk(id);
  const brief = await loadCompanyBrief(id, today);
  const drafts = await loadOfficeDrafts(db, id);
  return buildOfficeSnapshot(facts, wa, brief.ok ? brief : null, drafts);
}

const MONTH_NAMES: readonly { month: number; names: readonly string[] }[] = [
  { month: 1, names: ["januari"] },
  { month: 2, names: ["februari"] },
  { month: 3, names: ["maret"] },
  { month: 4, names: ["april"] },
  { month: 5, names: ["mei"] },
  { month: 6, names: ["juni"] },
  { month: 7, names: ["juli"] },
  { month: 8, names: ["agustus", "ags"] },
  { month: 9, names: ["september", "sep"] },
  { month: 10, names: ["oktober", "okt"] },
  { month: 11, names: ["november", "nov"] },
  { month: 12, names: ["desember", "des"] },
];

export function askedRange(question: string) {
  const text = question.toLowerCase();
  const yearHit = text.match(/\b(20\d{2})\b/);
  const year = yearHit ? Number(yearHit[1]) : undefined;
  if (!/bulan ini/.test(text)) {
    for (const item of MONTH_NAMES) {
      if (item.names.some((name) => new RegExp(`\\b${name}\\b`).test(text))) {
        return namedMonthWindow(item.month, year);
      }
    }
  }
  let kind: PeriodKind = "today";
  if (/bulan lalu|bulan kemarin/.test(text)) kind = "last_month";
  else if (/minggu lalu|minggu kemarin/.test(text)) kind = "last_week";
  else if (/\bkemarin\b/.test(text)) kind = "yesterday";
  else if (/minggu/.test(text)) kind = "this_week";
  else if (/tahun/.test(text)) kind = "this_year";
  else if (/bulan/.test(text)) kind = "this_month";
  return periodRange(kind);
}

function periodSummary(facts: OfficeFacts, label: string) {
  if (!facts.orders.ok) return facts.orders.notice || `${label}: Henima Sales belum bisa dibaca.`;
  const { orders, pending, omzet, book } = orderSummary(facts);
  if (!orders.length && !pending) return `${label}, ${book}: belum ada order.`;
  const unpaid = pending ? ` ${pending} order belum lunas.` : "";
  return `${label}, ${book}: ${orders.length} order lunas, omzet ${rp(omzet)}.${unpaid}`;
}

function laporanAnswer(facts: OfficeFacts, question: string, label: string, brief?: CompanyBrief | null) {
  if (brief?.ok) {
    const text = question.toLowerCase();
    let answer = formatCompanyReport(brief);
    if (/laba|hpp|biaya|uang|sisa|rugi/.test(text)) answer = formatProfit(brief);
    else if (/parfum|paling laku|yang laku|produk apa/.test(text)) answer = formatProducts(brief);
    else if (/pelanggan|customer|siapa beli|pembeli/.test(text)) answer = formatCustomers(brief);
    else if (/belum lunas|piutang|nunggak|nyangkut/.test(text)) answer = formatUnpaid(brief);
    else if (/tunai|transfer|qris|cash/.test(text)) answer = formatPayments(brief);
    else if (/siapa yang jual|ranking|top sales|paling banyak jual/.test(text)) answer = formatRanking(brief);
    if (/kasir|pemasukan/.test(text) && facts.pemasukan.ok) {
      return `${answer} Pemasukan kasir ${rp(facts.pemasukan.rows)}.`;
    }
    return answer;
  }
  const summary = periodSummary(facts, label);
  if (/kasir|pemasukan/.test(question.toLowerCase()) && facts.pemasukan.ok) {
    return `${summary} Pemasukan kasir/keuangan ${rp(facts.pemasukan.rows)}.`;
  }
  return summary;
}

function mapsUrl(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return "";
  return `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function routeAnswer(facts: OfficeFacts, label: string) {
  if (!facts.points.ok) return facts.points.notice || `Tracking ${label} belum bisa dibaca.`;
  if (!facts.points.rows.length) return `Belum ada rute pada ${label}.`;
  const byStaff = new Map<string, OfficeFacts["points"]["rows"]>();
  for (const point of [...facts.points.rows].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))) {
    const list = byStaff.get(point.staff_id) || [];
    list.push(point);
    byStaff.set(point.staff_id, list);
  }
  const lines = [...byStaff.entries()].slice(0, 4).map(([staffId, points]) => {
    const stops = points
      .slice(0, 6)
      .map((point) => `${kindLabel(point.kind)} ${wibClock(point.recorded_at)}${point.late ? " telat" : ""}`)
      .join(" → ");
    const last = points[points.length - 1];
    const map = mapsUrl(last.lat, last.lng);
    return `${staffName(facts, staffId)}: ${stops}.${map ? ` Peta: ${map}` : ""}`;
  });
  return `${label}. ${lines.join(" ")}`;
}

function salesAnswer(facts: OfficeFacts, question: string, label: string, brief?: CompanyBrief | null) {
  if (!facts.points.ok && !facts.staff.ok && !facts.orders.ok) {
    return "Data lapangan belum bisa dibaca. Coba muat ulang.";
  }
  const text = question.toLowerCase();
  if (brief?.ok && /target|capaian/.test(text)) return formatTarget(brief);
  if (brief?.ok && /follow/.test(text)) return formatFollowUps(brief);
  if (/rute|perjalanan|jejak/.test(text)) return routeAnswer(facts, label);
  const out = facts.points.ok ? peopleOut(facts) : [];
  const late = facts.points.rows.filter((point) => point.late);
  const last = facts.points.rows[0];
  const sellers = facts.orders.ok ? sellersInRange(facts) : [];

  if (text.includes("telat")) {
    if (!facts.points.ok) return facts.points.notice || `Tracking ${label} belum bisa dibaca.`;
    if (!late.length) return out.length ? `Tidak ada titik yang ditandai telat pada ${label}.` : `Belum ada check-in pada ${label}, jadi belum ada yang telat.`;
    const names = [...new Set(late.map((point) => staffName(facts, point.staff_id)))];
    return `Yang telat pada ${label}: ${names.join(", ")}.`;
  }
  if (text.includes("di mana") || text.includes("dimana") || text.includes("titik") || text.includes("lokasi") || text.includes("tracking")) {
    if (!facts.points.ok) return facts.points.notice || `Tracking ${label} belum bisa dibaca.`;
    if (!last) return `Belum ada titik tracking pada ${label}.`;
    const note = last.note ? ` Catatan: ${last.note}.` : "";
    const who = out.length ? `Yang tercatat: ${out.join(", ")}. ` : "";
    const map = mapsUrl(last.lat, last.lng);
    return `${label}. ${who}Titik terakhir: ${staffName(facts, last.staff_id)}, ${kindLabel(last.kind)} pukul ${wibClock(last.recorded_at)}${last.late ? ", telat" : ""}.${map ? ` Peta: ${map}.` : ""}${note}`;
  }
  if (text.includes("jual") || text.includes("order") || text.includes("penjualan") || text.includes("omzet")) {
    if (brief?.ok) return `${formatRanking(brief)} ${formatCompanyReport(brief)}`;
    const money = periodSummary(facts, label);
    if (!sellers.length) return money;
    return `${money} Yang jual: ${sellers.join(", ")}.`;
  }
  const parts = [`${label}.`];
  if (facts.points.ok) {
    parts.push(out.length ? `Di lapangan: ${out.join(", ")}.` : "Belum ada titik tracking.");
  } else if (facts.points.notice) parts.push(facts.points.notice);
  if (last) {
    parts.push(
      `Terakhir ${staffName(facts, last.staff_id)} ${kindLabel(last.kind)} pukul ${wibClock(last.recorded_at)}${last.late ? ", telat" : ""}.`,
    );
  }
  if (sellers.length) parts.push(`Order Henima: ${sellers.join(", ")}.`);
  if (brief?.ok) {
    const tail = fieldTaskTail(brief);
    if (tail) parts.push(tail);
  }
  return parts.join(" ");
}

function productLine(product: OfficeProductRow) {
  const unit = product.unit ? ` ${product.unit}` : "";
  return `${product.name} sisa ${product.stock}${unit} (batas ${product.min_stock})`;
}

export function matchProducts(products: OfficeProductRow[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return { kind: "none" as const };
  const exact = products.filter((product) => product.name.toLowerCase() === q);
  if (exact.length === 1) return { kind: "one" as const, product: exact[0] };
  const partial = products.filter((product) => product.name.toLowerCase().includes(q));
  if (partial.length === 1) return { kind: "one" as const, product: partial[0] };
  if (partial.length > 1) return { kind: "many" as const, products: partial.slice(0, 8) };
  return { kind: "none" as const };
}

export function parseStockInstruction(question: string): { direction: "masuk" | "keluar"; quantity: number; name: string } | null {
  const text = question.trim().replace(/\s+/g, " ");
  const named = text.match(/^(?:tolong\s+)?(tambah(?:kan)?|plus|kurang(?:i)?|minus)\s+(?:stok\s+)?(.+?)\s+(\d+)\s*$/i);
  if (named) {
    const word = named[1].toLowerCase();
    return {
      direction: word.startsWith("tambah") || word === "plus" ? "masuk" : "keluar",
      name: named[2],
      quantity: Number(named[3]),
    };
  }
  const qtyFirst = text.match(/^(?:tolong\s+)?(tambah(?:kan)?|plus|kurang(?:i)?|minus)\s+stok\s+(\d+)\s+(.+)$/i);
  if (!qtyFirst) return null;
  const word = qtyFirst[1].toLowerCase();
  return {
    direction: word.startsWith("tambah") || word === "plus" ? "masuk" : "keluar",
    quantity: Number(qtyFirst[2]),
    name: qtyFirst[3],
  };
}

function stockAnswer(facts: OfficeFacts, question: string, brief?: CompanyBrief | null) {
  if (!facts.products.ok) return facts.products.notice || "Stok belum bisa dibaca.";
  const products = facts.products.rows;
  const text = question.toLowerCase();
  if (/produksi|diproduksi|racik|perlu dibuat|harus dibuat/.test(text)) {
    return formatProduction(products, brief?.ok ? brief.products : [], question);
  }
  const critical = products.filter(isCritical).sort((a, b) => a.stock - b.stock);
  const named = question.match(/stok\s+(.+?)(?:\s+berapa)?\s*$/i);
  if (named && !text.includes("kritis") && !text.includes("habis") && !text.includes("rendah")) {
    const found = matchProducts(products, named[1]);
    if (found.kind === "one") return productLine(found.product) + ".";
    if (found.kind === "many") return `Ada beberapa: ${found.products.map((item) => item.name).join(", ")}. Sebut nama yang lebih lengkap.`;
  }
  if (text.includes("habis")) {
    const empty = products.filter((product) => product.stock <= 0);
    if (!empty.length) return "Tidak ada produk yang stoknya 0.";
    return `Habis: ${empty.slice(0, 8).map((item) => item.name).join(", ")}.`;
  }
  if (text.includes("kritis") || text.includes("hampir") || text.includes("rendah") || text.includes("batas")) {
    if (!critical.length) return `Tidak ada stok kritis. ${products.length} produk masih di atas batas.`;
    return `Kritis: ${critical.slice(0, 8).map(productLine).join("; ")}.`;
  }
  if (!products.length) return "Belum ada produk di inventory bisnis ini.";
  if (!critical.length) return `Stok aman. ${products.length} produk, tidak ada yang di bawah batas.`;
  return `${critical.length} produk kritis. Yang paling rendah: ${productLine(critical[0])}.`;
}

export async function answerOfficeQuestion(businessId: string, agentId: string, question: string) {
  const text = question.trim();
  if (!text) return "Tulis pertanyaan atau instruksi dulu.";
  if (agentId === WA_AGENT_ID) return describeWa(businessId, text);
  if (agentId === SOFTWARE_AGENT_ID || agentId === SOSMED_AGENT_ID || agentId === MARKETING_AGENT_ID) {
    const db = await createClient();
    const facts = await officeRepository.loadFacts(db, businessId, askedRange(text));
    const drafts = await loadOfficeDrafts(db, businessId);
    if (agentId === SOFTWARE_AGENT_ID) {
      const broken = [facts.orders, facts.products, facts.points, facts.staff].filter((slice) => slice.notice).map((slice) => slice.notice);
      const head = softwareTask(facts, drafts);
      return broken.length ? `${head} Yang belum beres: ${broken.join(" ")}` : head;
    }
    if (!drafts) return "Draft marketing belum terbaca.";
    if (agentId === SOSMED_AGENT_ID) {
      return listDrafts(sosmedDrafts(drafts), "Belum ada draft Instagram atau TikTok.");
    }
    return listDrafts(marketingDrafts(drafts), "Belum ada draft kampanye atau jadwal.");
  }
  const range = askedRange(text);
  const db = await createClient();
  const facts = await officeRepository.loadFacts(db, businessId, range);
  await applyHenimaBook(facts, businessId, range);
  const loaded = await loadCompanyBrief(businessId, range);
  const brief = loaded.ok ? loaded : null;
  const lower = text.toLowerCase();
  const aboutProduction = /produksi|diproduksi|racik|perlu dibuat|harus dibuat/.test(lower);
  const aboutStock = /stok|habis|inventory|produk/.test(lower);
  const aboutField = /tracking|lapangan|check-?in|telat|titik|lokasi|di mana|dimana|kunjungan|rute|perjalanan|jejak|target|capaian|follow/.test(lower);
  const aboutBook = /laba|hpp|biaya|laku|parfum|pelanggan|customer|piutang|belum lunas|nunggak|omzet|penjualan|order|pendapatan/.test(lower);
  if (aboutProduction || (aboutStock && !aboutBook)) return stockAnswer(facts, text, brief);
  if (aboutField && !aboutBook) return salesAnswer(facts, text, range.label, brief);
  if (aboutBook || agentId === LAPORAN_AGENT_ID) return laporanAnswer(facts, text, range.label, brief);
  if (agentId === SALES_AGENT_ID) return salesAnswer(facts, text, range.label, brief);
  if (agentId === STOK_AGENT_ID) return stockAnswer(facts, text, brief);
  return laporanAnswer(facts, text, range.label, brief);
}

export function stockChangeMessage(result: StockAdjustResult) {
  if (!result.ok) return result.message;
  const verb = result.direction === "masuk" ? "ditambah" : "dikurangi";
  return `Stok ${result.name} ${verb} ${result.quantity}. Sebelumnya ${result.before}, sekarang ${result.after}.`;
}

export type StockInstruction =
  | { wrote: false; message: string }
  | { wrote: true; productId: string; direction: "masuk" | "keluar"; quantity: number };

export async function resolveStockInstruction(businessId: string, question: string): Promise<StockInstruction | null> {
  const parsed = parseStockInstruction(question);
  if (!parsed) return null;
  const db = await createClient();
  const products = await officeRepository.loadFacts(db, businessId);
  if (!products.products.ok) return { wrote: false, message: products.products.notice || "Stok belum bisa dibaca." };
  const found = matchProducts(products.products.rows, parsed.name);
  if (found.kind === "many") {
    return {
      wrote: false,
      message: `Ada beberapa produk: ${found.products.map((item) => item.name).join(", ")}. Sebut nama yang lebih lengkap.`,
    };
  }
  if (found.kind === "none") {
    return { wrote: false, message: `Produk "${parsed.name.trim()}" tidak ketemu. Pilih dari daftar, atau sebut nama yang sama persis.` };
  }
  return { wrote: true, productId: found.product.id, direction: parsed.direction, quantity: parsed.quantity };
}
