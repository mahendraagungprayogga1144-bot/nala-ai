import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { Actor } from "./types";
import type { SalesDb } from "./db";
import { getOrder, type SalesOrder } from "./order-service";
import { getCustomer } from "./customer-service";
import { getSalesSettings } from "./settings-service";
import { displayPhone } from "./phone";
import { fmtDateLongId, fmtRp } from "./money";

export type NotaLine = {
  name: string;
  qty: number;
  unitPrice: number;
};

export type NotaPayload = {
  notaNumber: string;
  brandName: string;
  tagline: string | null;
  dateLabel: string;
  customerName: string;
  customerPhone: string;
  servedBy: string;
  paymentMethod: string;
  paymentStatus: string;
  notes: string | null;
  lines: NotaLine[];
  discount: number;
  total: number;
};

export function formatNotaNumber(orderId: string, orderDate: string) {
  const ymd = (orderDate || "").replace(/-/g, "").slice(0, 8);
  const day = /^\d{8}$/.test(ymd) ? ymd : "00000000";
  const short = orderId.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `HNM-${day}-${short}`;
}

export function pdfSafe(text: string) {
  return text
    .replace(/×/g, "x")
    .replace(/[—–]/g, "-")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function statusLabel(status: string | null | undefined) {
  const s = (status || "").toUpperCase();
  if (s === "PAID") return "LUNAS";
  if (s === "PENDING") return "BELUM LUNAS";
  if (s === "CANCELLED") return "BATAL";
  return s || "-";
}

export function notaFromOrder(opts: {
  order: SalesOrder;
  brandName: string;
  tagline?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  staffName?: string | null;
  staffRole?: string | null;
}): NotaPayload {
  const lines: NotaLine[] = (opts.order.order_items || []).map((item) => ({
    name: item.product_name_snapshot || "Produk",
    qty: Number(item.qty || 0),
    unitPrice: Number(item.harga_jual || 0),
  }));
  const staff = (opts.staffName || "").trim() || "Henima";
  const servedBy =
    (opts.staffRole || "").toUpperCase() === "FOUNDER" ? `Dilayani oleh ${staff}` : `Sales: ${staff}`;
  return {
    notaNumber: formatNotaNumber(opts.order.id, opts.order.order_date),
    brandName: opts.brandName,
    tagline: opts.tagline || null,
    dateLabel: fmtDateLongId(opts.order.order_date),
    customerName: opts.customerName || "-",
    customerPhone: displayPhone(opts.customerPhone),
    servedBy,
    paymentMethod: (opts.order.metode_bayar || "OTHER").toUpperCase(),
    paymentStatus: statusLabel(opts.order.payment_status),
    notes: opts.order.catatan,
    lines: lines.length ? lines : [{ name: "Produk", qty: 0, unitPrice: 0 }],
    discount: Number(opts.order.diskon || 0),
    total: Number(opts.order.total || 0),
  };
}

export async function buildSalesNotaPdf(payload: NotaPayload): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([420, 595]);
  const teal = rgb(0.18, 0.72, 0.66);
  const ink = rgb(0.12, 0.12, 0.18);
  const muted = rgb(0.4, 0.4, 0.45);
  let y = 560;

  const draw = (text: string, x: number, yy: number, size = 10, bold = false, color = ink) => {
    page.drawText(pdfSafe(text).slice(0, 80), {
      x,
      y: yy,
      size,
      font: bold ? fontBold : font,
      color,
    });
  };

  page.drawRectangle({ x: 28, y: 578, width: 364, height: 4, color: teal });
  draw(payload.brandName || "Henima Scent", 28, y, 16, true, teal);
  y -= 16;
  if (payload.tagline) {
    draw(payload.tagline, 28, y, 8, false, muted);
    y -= 12;
  }
  draw("NOTA PENJUALAN", 28, y, 11, true);
  y -= 18;
  draw(`No. ${payload.notaNumber}`, 28, y, 9);
  draw(payload.dateLabel, 250, y, 9, false, muted);
  y -= 22;

  page.drawRectangle({ x: 28, y: y - 36, width: 364, height: 48, borderColor: rgb(0.85, 0.85, 0.88), borderWidth: 0.6 });
  draw("Kepada", 36, y - 8, 8, false, muted);
  draw(payload.customerName, 36, y - 22, 11, true);
  draw(payload.customerPhone, 36, y - 34, 9, false, muted);
  y -= 58;

  draw("Produk", 28, y, 8, true, muted);
  draw("Qty", 220, y, 8, true, muted);
  draw("Harga", 260, y, 8, true, muted);
  draw("Jumlah", 330, y, 8, true, muted);
  y -= 12;
  page.drawRectangle({ x: 28, y: y + 6, width: 364, height: 0.5, color: rgb(0.85, 0.85, 0.88) });
  y -= 6;

  for (const line of payload.lines) {
    const amount = Math.round(line.qty * line.unitPrice);
    draw(line.name, 28, y, 10);
    draw(String(line.qty), 220, y, 10);
    draw(fmtRp(line.unitPrice), 260, y, 9);
    draw(fmtRp(amount), 330, y, 9, true);
    y -= 16;
  }

  if (payload.discount > 0) {
    draw("Diskon", 260, y, 9, false, muted);
    draw(`-${fmtRp(payload.discount)}`, 330, y, 9);
    y -= 16;
  }

  page.drawRectangle({ x: 28, y: y + 8, width: 364, height: 0.5, color: rgb(0.85, 0.85, 0.88) });
  y -= 8;
  draw("TOTAL", 260, y, 10, true);
  draw(fmtRp(payload.total), 330, y, 12, true, teal);
  y -= 24;

  draw(`Pembayaran: ${payload.paymentMethod}  ·  ${payload.paymentStatus}`, 28, y, 9);
  y -= 14;
  draw(payload.servedBy, 28, y, 9, false, muted);
  y -= 18;
  if (payload.notes) {
    draw(`Catatan: ${payload.notes}`, 28, y, 8, false, muted);
    y -= 16;
  }

  draw("Terima kasih sudah belanja di Henima.", 28, 48, 9, false, muted);
  draw("Simpan nota ini sebagai bukti pembelian.", 28, 36, 8, false, muted);

  return doc.save();
}

export async function buildOrderNota(db: SalesDb, actor: Actor, orderId: string) {
  const order = await getOrder(db, actor, orderId);
  let customerName: string | null = null;
  let customerPhone: string | null = null;
  if (order.customer_id) {
    try {
      const customer = await getCustomer(db, actor, order.customer_id);
      customerName = customer.nama;
      customerPhone = customer.whatsapp_phone || customer.telepon;
    } catch {
      customerName = null;
    }
  }

  let staffName: string | null = actor.nama;
  let staffRole: string | null = actor.role;
  if (order.sales_id) {
    const { data: staff } = await db
      .from("module_sales_staff")
      .select("nama, role")
      .eq("id", order.sales_id)
      .maybeSingle();
    if (staff) {
      staffName = staff.nama;
      staffRole = staff.role;
    }
  }

  const settings = await getSalesSettings(db, actor.businessId, actor.businessName);
  const payload = notaFromOrder({
    order,
    brandName: settings.displayName,
    tagline: settings.tagline,
    customerName,
    customerPhone,
    staffName,
    staffRole,
  });
  const bytes = await buildSalesNotaPdf(payload);
  const filename = `nota-${payload.notaNumber}.pdf`;
  const caption = `Nota ${payload.notaNumber} untuk ${payload.customerName}. Teruskan PDF ini ke WhatsApp customer.`;
  return { bytes, filename, caption, payload };
}
