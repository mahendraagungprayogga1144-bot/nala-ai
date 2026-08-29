import { readFileSync } from "fs";
import { join } from "path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { Actor } from "./types";
import { paymentLabel } from "./types";
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

const INK = rgb(0.08, 0.08, 0.08);
const MUTED = rgb(0.42, 0.42, 0.42);
const RULE = rgb(0.15, 0.15, 0.15);
const PAGE_W = 420;

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
  return {
    notaNumber: formatNotaNumber(opts.order.id, opts.order.order_date),
    brandName: opts.brandName,
    tagline: opts.tagline || null,
    dateLabel: fmtDateLongId(opts.order.order_date),
    customerName: opts.customerName || "-",
    customerPhone: displayPhone(opts.customerPhone),
    servedBy: staff,
    paymentMethod: paymentLabel(opts.order.metode_bayar),
    paymentStatus: statusLabel(opts.order.payment_status),
    notes: opts.order.catatan,
    lines: lines.length ? lines : [{ name: "Produk", qty: 0, unitPrice: 0 }],
    discount: Number(opts.order.diskon || 0),
    total: Number(opts.order.total || 0),
  };
}

function fontPath(file: string) {
  return join(process.cwd(), "lib/henima-sales/fonts", file);
}

async function embedBrandFonts(doc: PDFDocument) {
  doc.registerFontkit(fontkit);
  try {
    const serif = await doc.embedFont(readFileSync(fontPath("PlayfairDisplay-Bold.ttf")));
    const sans = await doc.embedFont(readFileSync(fontPath("SourceSans3-Regular.ttf")));
    const sansBold = await doc.embedFont(readFileSync(fontPath("SourceSans3-Semibold.ttf")));
    return { serif, sans, sansBold };
  } catch {
    const sans = await doc.embedFont(StandardFonts.Helvetica);
    const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const serif = await doc.embedFont(StandardFonts.TimesRomanBold);
    return { serif, sans, sansBold };
  }
}

function drawSpaced(
  page: PDFPage,
  text: string,
  centerX: number,
  y: number,
  size: number,
  font: PDFFont,
  tracking: number,
) {
  const chars = [...pdfSafe(text)];
  const widths = chars.map((c) => font.widthOfTextAtSize(c, size));
  const total = widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, chars.length - 1);
  let x = centerX - total / 2;
  chars.forEach((c, i) => {
    page.drawText(c, { x, y, size, font, color: INK });
    x += widths[i] + tracking;
  });
}

function drawRight(page: PDFPage, text: string, rightX: number, y: number, size: number, font: PDFFont, color = INK) {
  const t = pdfSafe(text);
  const w = font.widthOfTextAtSize(t, size);
  page.drawText(t, { x: rightX - w, y, size, font, color });
}

function glyphWidth(font: PDFFont, text: string, size: number) {
  return [...text].reduce((sum, ch) => sum + font.widthOfTextAtSize(ch, size), 0);
}

function drawChars(page: PDFPage, text: string, x: number, y: number, size: number, font: PDFFont, color = MUTED) {
  let cx = x;
  for (const ch of text) {
    page.drawText(ch, { x: cx, y, size, font, color });
    cx += font.widthOfTextAtSize(ch, size);
  }
}

function drawIgIcon(page: PDFPage, x: number, y: number, s: number) {
  page.drawRectangle({ x, y, width: s, height: s, borderColor: INK, borderWidth: 0.8 });
  page.drawCircle({ x: x + s / 2, y: y + s / 2, size: s * 0.22, borderColor: INK, borderWidth: 0.7 });
  page.drawCircle({ x: x + s * 0.74, y: y + s * 0.74, size: s * 0.055, color: INK });
}

function drawWebIcon(page: PDFPage, x: number, y: number, s: number) {
  const cx = x + s / 2;
  const cy = y + s / 2;
  page.drawCircle({ x: cx, y: cy, size: s * 0.42, borderColor: INK, borderWidth: 0.8 });
  page.drawLine({ start: { x: x + s * 0.12, y: cy }, end: { x: x + s * 0.88, y: cy }, thickness: 0.6, color: INK });
  page.drawLine({ start: { x: cx, y: y + s * 0.1 }, end: { x: cx, y: y + s * 0.9 }, thickness: 0.6, color: INK });
}

function drawTikTokIcon(page: PDFPage, x: number, y: number, s: number) {
  const stemX = x + s * 0.62;
  page.drawEllipse({
    x: x + s * 0.34,
    y: y + s * 0.28,
    xScale: s * 0.24,
    yScale: s * 0.15,
    color: INK,
  });
  page.drawLine({
    start: { x: stemX, y: y + s * 0.28 },
    end: { x: stemX, y: y + s * 0.9 },
    thickness: 1.15,
    color: INK,
  });
  page.drawLine({
    start: { x: stemX, y: y + s * 0.9 },
    end: { x: x + s * 0.9, y: y + s * 0.68 },
    thickness: 1.15,
    color: INK,
  });
  page.drawLine({
    start: { x: x + s * 0.9, y: y + s * 0.68 },
    end: { x: x + s * 0.9, y: y + s * 0.52 },
    thickness: 1.15,
    color: INK,
  });
}

function drawSocials(page: PDFPage, cx: number, top: number, font: PDFFont) {
  const size = 8;
  const icon = 8;
  const gap = 5;
  const lineH = 13;
  const items: { draw: (page: PDFPage, x: number, y: number, s: number) => void; label: string }[] = [
    { draw: drawIgIcon, label: "@henima.id" },
    { draw: drawWebIcon, label: "henimaofficial.com" },
    { draw: drawTikTokIcon, label: "henima collection" },
  ];
  const blockW = Math.max(...items.map((item) => icon + gap + glyphWidth(font, item.label, size)));
  const x = cx - blockW / 2;
  items.forEach((item, i) => {
    const y = top - i * lineH;
    item.draw(page, x, y, icon);
    drawChars(page, item.label, x + icon + gap, y + 0.8, size, font, INK);
  });
}

export async function buildSalesNotaPdf(payload: NotaPayload): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const { serif, sans, sansBold } = await embedBrandFonts(doc);
  const page = doc.addPage([PAGE_W, 640]);
  const cx = PAGE_W / 2;
  const left = 36;
  const right = PAGE_W - 36;
  let y = 590;

  drawSpaced(page, "HENIMA", cx, y, 22, serif, 5.5);
  y -= 16;
  const sub = pdfSafe((payload.tagline || "SIGNATURE SCENT").toUpperCase());
  drawSpaced(page, sub, cx, y, 7.5, sans, 3.2);
  y -= 18;
  page.drawRectangle({ x: left, y: y + 3, width: right - left, height: 0.6, color: RULE });
  page.drawCircle({ x: cx, y: y + 3.3, size: 2.1, color: INK });
  y -= 28;

  page.drawText("NOTA PENJUALAN", { x: left, y, size: 11, font: sansBold, color: INK });
  y -= 14;
  page.drawText(`No. ${pdfSafe(payload.notaNumber)}`, { x: left, y, size: 8.5, font: sans, color: MUTED });
  drawRight(page, payload.dateLabel, right, y, 9, sans, MUTED);
  y -= 26;

  page.drawText("KEPADA", { x: left, y, size: 7.5, font: sansBold, color: MUTED });
  y -= 13;
  page.drawText(pdfSafe(payload.customerName), { x: left, y, size: 12, font: sansBold, color: INK });
  y -= 13;
  page.drawText(pdfSafe(payload.customerPhone), { x: left, y, size: 9, font: sans, color: MUTED });
  y -= 22;

  page.drawRectangle({ x: left, y: y + 10, width: right - left, height: 0.6, color: RULE });
  page.drawText("PRODUK", { x: left, y, size: 7.5, font: sansBold, color: INK });
  page.drawText("QTY", { x: 198, y, size: 7.5, font: sansBold, color: INK });
  drawRight(page, "HARGA SATUAN", 300, y, 7.5, sansBold);
  drawRight(page, "JUMLAH", right, y, 7.5, sansBold);
  y -= 8;
  page.drawRectangle({ x: left, y: y + 4, width: right - left, height: 0.6, color: RULE });
  y -= 14;

  for (const line of payload.lines) {
    const amount = Math.round(line.qty * line.unitPrice);
    page.drawText(pdfSafe(line.name).toUpperCase().slice(0, 28), { x: left, y, size: 10, font: sans, color: INK });
    page.drawText(String(line.qty), { x: 206, y, size: 10, font: sans, color: INK });
    drawRight(page, fmtRp(line.unitPrice), 300, y, 9, sans);
    drawRight(page, fmtRp(amount), right, y, 10, sansBold);
    y -= 16;
  }
  y -= 4;
  page.drawRectangle({ x: left, y: y + 10, width: right - left, height: 0.6, color: RULE });
  y -= 10;

  const goods = payload.lines.reduce((s, l) => s + Math.round(l.qty * l.unitPrice), 0);
  const afterDiscount = Math.round(payload.total);
  if (payload.discount > 0) {
    drawRight(page, "SUBTOTAL", 300, y, 9, sans, MUTED);
    drawRight(page, fmtRp(goods), right, y, 9, sans);
    y -= 14;
    drawRight(page, "DISKON", 300, y, 9, sans, MUTED);
    drawRight(page, `-${fmtRp(payload.discount)}`, right, y, 9, sans);
    y -= 10;
  }
  page.drawRectangle({ x: 250, y: y + 6, width: right - 250, height: 0.6, color: RULE });
  y -= 12;
  drawRight(page, "TOTAL", 300, y, 11, sansBold);
  drawRight(page, fmtRp(afterDiscount), right, y, 13, sansBold);
  y -= 32;

  page.drawText(`PEMBAYARAN: ${pdfSafe(payload.paymentMethod).toUpperCase()}  ${payload.paymentStatus}`, {
    x: left,
    y,
    size: 8.5,
    font: sans,
    color: INK,
  });
  y -= 13;
  page.drawText(`DILAYANI OLEH: ${pdfSafe(payload.servedBy)}`, { x: left, y, size: 8.5, font: sans, color: INK });
  y -= 13;
  if (payload.notes) {
    page.drawText(`CATATAN: ${pdfSafe(payload.notes)}`, { x: left, y, size: 8.5, font: sansBold, color: INK });
    y -= 18;
  } else {
    y -= 8;
  }

  page.drawRectangle({ x: left, y: 96, width: right - left, height: 0.5, color: RULE });
  const company = "PT HENIMA COLLECTION INDONESIA";
  const cw = sansBold.widthOfTextAtSize(company, 8);
  page.drawText(company, { x: cx - cw / 2, y: 80, size: 8, font: sansBold, color: INK });
  drawSocials(page, cx, 62, sans);
  const thanks = "Terima kasih telah berbelanja.";
  page.drawText(thanks, { x: cx - sans.widthOfTextAtSize(thanks, 8) / 2, y: 20, size: 8, font: sans, color: MUTED });
  const policy = "Barang yang sudah dibeli tidak dapat dikembalikan.";
  page.drawText(policy, { x: cx - sans.widthOfTextAtSize(policy, 7) / 2, y: 8, size: 7, font: sans, color: MUTED });

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
