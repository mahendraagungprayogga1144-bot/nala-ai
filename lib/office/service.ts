import { createClient } from "@/lib/supabase/server";
import { SALES_ORDER_SOURCE } from "@/lib/henima-sales/types";
import { officeRepository, type OfficeFacts, type OfficeProductRow, type StockAdjustResult } from "./repository";
import { LAPORAN_AGENT_ID, SALES_AGENT_ID, STOK_AGENT_ID, type OfficeAgent, type OfficeSnapshot } from "./types";

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
  const orders = facts.orders.ok ? facts.orders.rows : [];
  const omzet = orders.reduce((sum, row) => sum + row.total, 0);
  const henima = orders.filter((row) => row.source === SALES_ORDER_SOURCE);
  const other = orders.length - henima.length;
  const henimaOmzet = henima.reduce((sum, row) => sum + row.total, 0);
  const pemasukan = facts.pemasukan.ok ? facts.pemasukan.rows : 0;
  return { orders, omzet, henimaCount: henima.length, otherCount: other, henimaOmzet, pemasukan };
}

function laporanTask(facts: OfficeFacts) {
  if (!facts.orders.ok && !facts.pemasukan.ok) return "Laporan hari ini belum terbaca.";
  const { orders, omzet, henimaCount, otherCount, pemasukan } = orderSummary(facts);
  if (orders.length === 0 && pemasukan <= 0) return "Belum ada order atau pemasukan hari ini.";
  if (orders.length === 0) return `Pemasukan tercatat ${rp(pemasukan)}. Belum ada order hari ini.`;
  return `Hari ini ${orders.length} order, omzet ${rp(omzet)}. Henima ${henimaCount}, lainnya ${otherCount}.`;
}

function laporanWorking(facts: OfficeFacts) {
  const { orders, pemasukan } = orderSummary(facts);
  return orders.length > 0 || pemasukan > 0;
}

function staffName(facts: OfficeFacts, staffId: string) {
  return facts.staff.rows.find((row) => row.id === staffId)?.nama || "Sales";
}

function sellersToday(facts: OfficeFacts) {
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
    const sellers = facts.orders.ok ? sellersToday(facts) : [];
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
  const sellers = facts.orders.ok ? sellersToday(facts) : [];
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

export function buildOfficeSnapshot(facts: OfficeFacts): OfficeSnapshot {
  const laporanBusy = laporanWorking(facts);
  const salesBusy = salesWorking(facts);
  const stock = stockStatus(facts);
  const agents: OfficeAgent[] = [
    {
      id: LAPORAN_AGENT_ID,
      business_id: facts.businessId,
      name: "Laporan Harian",
      room: "founder",
      status: laporanBusy ? "working" : "idle",
      at_pantry: false,
      current_task: laporanTask(facts),
      color: "#2DD4BF",
    },
    {
      id: SALES_AGENT_ID,
      business_id: facts.businessId,
      name: "Monitor Sales",
      room: "sales",
      status: salesBusy ? "working" : "idle",
      at_pantry: facts.staff.ok && facts.points.ok && !salesBusy,
      current_task: salesTask(facts),
      color: "#A78BFA",
    },
    {
      id: STOK_AGENT_ID,
      business_id: facts.businessId,
      name: "Stok & Produksi",
      room: "ops",
      status: stock,
      at_pantry: false,
      current_task: stockTask(facts),
      color: "#F59E0B",
    },
  ];
  const working = agents.filter((agent) => agent.status === "working");
  return {
    business_id: facts.businessId,
    agents,
    crew_active: working.length,
    crew_total: agents.length,
    tasks_running: working.filter((agent) => agent.current_task).length,
    notices: noticesOf(facts),
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

export async function loadOfficeSnapshot(businessId: string): Promise<OfficeSnapshot> {
  const id = businessId.trim();
  if (!id) throw new Error("active_business_id kosong.");
  const db = await createClient();
  const facts = await officeRepository.loadFacts(db, id);
  return buildOfficeSnapshot(facts);
}

function laporanAnswer(facts: OfficeFacts, question: string) {
  if (!facts.orders.ok && !facts.pemasukan.ok) {
    return "Laporan hari ini belum bisa dibaca. Coba muat ulang.";
  }
  const { orders, omzet, henimaCount, henimaOmzet, otherCount, pemasukan } = orderSummary(facts);
  const otherOmzet = omzet - henimaOmzet;
  const text = question.toLowerCase();
  const lines = [
    `Hari ini ada ${orders.length} order.`,
    `Omzet dari order ${rp(omzet)}.`,
    `Henima ${henimaCount} order (${rp(henimaOmzet)}).`,
    `Selain Henima ${otherCount} order (${rp(otherOmzet)}).`,
  ];
  if (orders.length === 0 && facts.pemasukan.ok) {
    lines.push(`Pemasukan yang tercatat di kasir/keuangan ${rp(pemasukan)}.`);
  }
  if (text.includes("omzet") || text.includes("uang") || text.includes("pendapatan")) {
    return orders.length
      ? `Omzet order hari ini ${rp(omzet)}. Henima ${rp(henimaOmzet)}, lainnya ${rp(otherOmzet)}.`
      : `Belum ada order hari ini. Pemasukan kasir/keuangan yang tercatat ${rp(pemasukan)}.`;
  }
  if (text.includes("order") || text.includes("berapa")) {
    return `Hari ini ${orders.length} order. Henima ${henimaCount}, lainnya ${otherCount}. Omzet ${rp(omzet)}.`;
  }
  return lines.join(" ");
}

function salesAnswer(facts: OfficeFacts, question: string) {
  if (!facts.points.ok && !facts.staff.ok && !facts.orders.ok) {
    return "Data lapangan belum bisa dibaca. Coba muat ulang.";
  }
  const text = question.toLowerCase();
  const out = facts.points.ok ? peopleOut(facts) : [];
  const late = facts.points.rows.filter((point) => point.late);
  const last = facts.points.rows[0];
  const sellers = facts.orders.ok ? sellersToday(facts) : [];

  if (text.includes("telat")) {
    if (!facts.points.ok) return facts.points.notice || "Tracking hari ini belum bisa dibaca.";
    if (!late.length) return out.length ? "Tidak ada titik yang ditandai telat hari ini." : "Belum ada check-in hari ini, jadi belum ada yang telat.";
    const names = [...new Set(late.map((point) => staffName(facts, point.staff_id)))];
    return `Yang telat hari ini: ${names.join(", ")}.`;
  }
  if (text.includes("di mana") || text.includes("dimana") || text.includes("titik") || text.includes("lokasi")) {
    if (!facts.points.ok) return facts.points.notice || "Tracking hari ini belum bisa dibaca.";
    if (!last) return "Belum ada titik tracking hari ini.";
    const note = last.note ? ` Catatan: ${last.note}.` : "";
    return `Titik terakhir: ${staffName(facts, last.staff_id)}, ${kindLabel(last.kind)} pukul ${wibClock(last.recorded_at)}${last.late ? ", telat" : ""}. Koordinat ${last.lat.toFixed(5)}, ${last.lng.toFixed(5)}.${note}`;
  }
  if (text.includes("jual") || text.includes("order")) {
    if (!sellers.length) return "Belum ada order Henima yang tercatat atas nama sales hari ini.";
    return `Yang punya order Henima hari ini: ${sellers.join(", ")}.`;
  }
  if (!out.length && !sellers.length) return salesTask(facts);
  const parts = [];
  if (facts.points.ok) {
    parts.push(out.length ? `Di lapangan: ${out.join(", ")}.` : "Belum ada titik tracking hari ini.");
  } else if (facts.points.notice) parts.push(facts.points.notice);
  if (last) {
    parts.push(
      `Terakhir ${staffName(facts, last.staff_id)} ${kindLabel(last.kind)} pukul ${wibClock(last.recorded_at)}${last.late ? ", telat" : ""}.`,
    );
  }
  if (sellers.length) parts.push(`Order Henima: ${sellers.join(", ")}.`);
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

function stockAnswer(facts: OfficeFacts, question: string) {
  if (!facts.products.ok) return facts.products.notice || "Stok belum bisa dibaca.";
  const products = facts.products.rows;
  const text = question.toLowerCase();
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
  const db = await createClient();
  const facts = await officeRepository.loadFacts(db, businessId);
  if (agentId === LAPORAN_AGENT_ID) return laporanAnswer(facts, text);
  if (agentId === SALES_AGENT_ID) return salesAnswer(facts, text);
  if (agentId === STOK_AGENT_ID) return stockAnswer(facts, text);
  return "Orang ini tidak punya tugas yang bisa dijawab dari data hari ini.";
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
