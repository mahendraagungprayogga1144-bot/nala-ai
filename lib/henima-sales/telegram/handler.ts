import { randomUUID } from "crypto";
import { todayWib } from "@/lib/date";
import type { SalesDb } from "../db";
import { salesLog, salesLogError } from "../log";
import { resolveActorByTelegramId, linkTelegramByInvite } from "../authz";
import { listProducts } from "../staff-service";
import { createCustomer, findCustomerByPhone, listCustomers } from "../customer-service";
import { confirmSale, listOrders, getOrder, softDeleteOrder } from "../order-service";
import { createFollowUp } from "../followup-service";
import { saveTestimonial } from "../testimonial-service";
import { achievementFor } from "../target-service";
import { buildSalesReport, type ReportKind } from "../report-service";
import { buildSalesReportPdf } from "../pdf";
import { fmtDateLongId, fmtRp } from "../money";
import { writeAudit } from "../audit";
import { displayPhone } from "../phone";
import type { Actor } from "../types";
import { reduceBot, customerFoundText } from "./fsm";
import type { Session } from "./session";
import { HELP_TEXT, newDraft } from "./session";
import { answerCallback, downloadTelegramFile, sendDocument, sendMessage } from "./api";
import { telegramRateOk } from "./rate-limit";

type TgUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number };
    from?: { id: number; first_name?: string; username?: string };
    text?: string;
    photo?: { file_id: string }[];
    caption?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name?: string; username?: string };
    data?: string;
    message?: { chat: { id: number } };
  };
};

async function loadSession(db: SalesDb, telegramUserId: number): Promise<Session> {
  const { data } = await db
    .from("module_sales_telegram_sessions")
    .select("state, payload")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();
  if (!data) return { state: "idle", draft: newDraft() };
  return { state: (data.state as Session["state"]) || "idle", draft: (data.payload as Session["draft"]) || newDraft() };
}

async function saveSession(db: SalesDb, telegramUserId: number, actor: Actor | null, session: Session) {
  await db.from("module_sales_telegram_sessions").upsert({
    telegram_user_id: telegramUserId,
    business_id: actor?.businessId || null,
    staff_id: actor?.staffId || null,
    state: session.state,
    payload: session.draft,
    updated_at: new Date().toISOString(),
  });
}

function parseCommand(text: string) {
  const t = text.trim();
  if (!t.startsWith("/")) return null;
  const [raw, ...rest] = t.split(/\s+/);
  const cmd = (raw || "").split("@")[0].toLowerCase();
  return { cmd, arg: rest.join(" ").trim() };
}

export async function handleTelegramUpdate(db: SalesDb, update: TgUpdate) {
  const { data: seen } = await db
    .from("module_sales_telegram_updates")
    .select("update_id")
    .eq("update_id", update.update_id)
    .maybeSingle();
  if (seen) return;
  await db.from("module_sales_telegram_updates").insert({ update_id: update.update_id });

  const from = update.message?.from || update.callback_query?.from;
  const chatId = update.message?.chat.id || update.callback_query?.message?.chat.id;
  if (!from || !chatId) return;
  const telegramUserId = from.id;

  if (!telegramRateOk(telegramUserId)) {
    await sendMessage(chatId, "Terlalu banyak permintaan. Coba lagi sebentar.");
    return;
  }

  if (update.callback_query?.id) await answerCallback(update.callback_query.id);

  let actor = await resolveActorByTelegramId(db, telegramUserId);
  const session = await loadSession(db, telegramUserId);
  const products = actor ? await listProducts(db, actor.businessId) : [];

  let incoming: Parameters<typeof reduceBot>[1] | null = null;
  if (update.callback_query?.data) {
    incoming = { kind: "callback", data: update.callback_query.data };
  } else if (update.message?.photo?.length) {
    const fileId = update.message.photo[update.message.photo.length - 1].file_id;
    incoming = { kind: "photo", fileId, caption: update.message.caption };
  } else if (update.message?.text) {
    const parsed = parseCommand(update.message.text);
    incoming = parsed
      ? { kind: "command", cmd: parsed.cmd, arg: parsed.arg }
      : { kind: "text", text: update.message.text };
  }
  if (!incoming) return;

  const reduced = reduceBot(session, incoming, { actor, products });
  let next = reduced.session;

  for (const effect of reduced.effects) {
    try {
      if (effect.type === "reply") {
        await sendMessage(chatId, effect.reply.text, effect.reply.keyboard);
      } else if (effect.type === "link_invite") {
        try {
          actor = await linkTelegramByInvite(db, effect.code, telegramUserId, from.first_name || "Sales");
          await writeAudit(db, actor, {
            businessId: actor.businessId,
            action: "TELEGRAM_LINK",
            entityType: "staff",
            entityId: actor.staffId,
            newValue: { telegram_user_id: telegramUserId },
          });
          next = { state: "idle", draft: newDraft() };
          await sendMessage(
            chatId,
            `Telegram Account: CONNECTED\nSales: ${actor.nama}\nRole: ${actor.role}\nBisnis: ${actor.businessName}\n\n${HELP_TEXT}`,
          );
        } catch (err) {
          await sendMessage(chatId, err instanceof Error ? err.message : "Kode undangan tidak valid.");
        }
      } else if (effect.type === "confirm_sale" && actor) {
        await runConfirm(db, actor, chatId, next);
        next = { state: "idle", draft: newDraft() };
      } else if (effect.type === "delete_order" && actor) {
        const res = await softDeleteOrder(db, actor, effect.orderId);
        await sendMessage(chatId, res.already_deleted ? "Transaksi sudah dihapus." : "Transaksi dihapus. Tidak dihitung di omzet, target, dan komisi.");
        next = { state: "idle", draft: newDraft() };
      } else if (effect.type === "send_report" && actor) {
        await sendRekap(db, actor, chatId, effect.kind as ReportKind);
      } else if (effect.type === "send_pdf" && actor) {
        await sendPdf(db, actor, chatId, effect.kind as ReportKind);
      }
    } catch (err) {
      salesLogError("telegram_effect", err, { type: effect.type, telegramUserId });
      const msg = err instanceof Error && err.message.includes("PDF")
        ? "PDF gagal dibuat. Silakan coba lagi."
        : "Terjadi masalah. Silakan coba lagi.";
      await sendMessage(chatId, msg);
    }
  }

  // Side-effect states that FSM only flags
  if (actor && next.state === "input_phone" && next.draft.phone && incoming.kind === "text") {
    await continueAfterPhone(db, actor, chatId, next, products);
  } else if (actor && next.state === "followup_phone" && next.draft.phone && incoming.kind === "text") {
    const found = await findCustomerByPhone(db, actor, next.draft.phone);
    if (!found) {
      await sendMessage(chatId, "Customer tidak ditemukan. Daftarkan dulu lewat /input.");
      next = { state: "idle", draft: newDraft() };
    } else {
      next.draft.followupCustomerId = found.id;
      next.draft.customerName = found.nama;
      next.state = "followup_date";
      await sendMessage(chatId, `Customer: ${found.nama}\nMasukkan tanggal follow-up (YYYY-MM-DD).`);
    }
  } else if (actor && next.state === "followup_notes" && incoming.kind === "text") {
    if (next.draft.followupCustomerId && next.draft.followupDate) {
      await createFollowUp(db, actor, {
        customerId: next.draft.followupCustomerId,
        scheduledAt: next.draft.followupDate,
        notes: incoming.text,
      });
      await sendMessage(
        chatId,
        `Follow-up tersimpan.\nCustomer: ${next.draft.customerName}\nTanggal: ${next.draft.followupDate}\nCatatan: ${incoming.text}`,
      );
      next = { state: "idle", draft: newDraft() };
    }
  } else if (actor && incoming.kind === "command" && incoming.cmd === "/riwayat") {
    await sendRiwayat(db, actor, chatId);
  } else if (actor && incoming.kind === "command" && incoming.cmd === "/target") {
    const monthly = await achievementFor(db, actor, "monthly");
    const weekly = await achievementFor(db, actor, "weekly");
    const daily = await achievementFor(db, actor, "daily");
    await sendMessage(
      chatId,
      [
        `SALES: ${actor.nama.toUpperCase()}`,
        "",
        `Hari ini: ${daily.sold} pcs (target ${daily.target})`,
        `Minggu ini: ${weekly.sold} pcs (target ${weekly.target})`,
        `Bulan ini: ${monthly.sold} pcs`,
        `Target: ${monthly.target} pcs`,
        `Achievement: ${monthly.achievement}%`,
        `Sisa: ${monthly.remaining} pcs`,
        `Omzet bulan ini: ${fmtRp(monthly.omzet)}`,
      ].join("\n"),
    );
  } else if (actor && incoming.kind === "callback" && incoming.data.startsWith("od:")) {
    const order = await getOrder(db, actor, incoming.data.slice(3));
    const item = order.order_items?.[0];
    await sendMessage(
      chatId,
      [
        `${fmtDateLongId(order.order_date)}`,
        `${item?.product_name_snapshot || "Produk"} — ${item?.qty || 0} pcs — ${fmtRp(order.total)}`,
        `Bayar: ${order.metode_bayar} / ${order.payment_status}`,
      ].join("\n"),
      [
        [{ text: "EDIT", data: "confirm_edit" }, { text: "DELETE", data: `del:${order.id}` }],
      ],
    );
  } else if (actor && next.state === "idle" && incoming.kind === "text" && session.state === "customer_query") {
    const { rows } = await listCustomers(db, actor, { q: incoming.text, pageSize: 5 });
    if (!rows.length) await sendMessage(chatId, "Customer tidak ditemukan.");
    else {
      const lines = rows.map((c) => `${c.nama}\n${displayPhone(c.whatsapp_phone || c.telepon)}\nStatus: ${c.status}\nTotal: ${fmtRp(c.total_spent)}\n`);
      await sendMessage(chatId, lines.join("\n"));
    }
  }

  await saveSession(db, telegramUserId, actor, next);
}

async function continueAfterPhone(
  db: SalesDb,
  actor: Actor,
  chatId: number,
  session: Session,
  products: Awaited<ReturnType<typeof listProducts>>,
) {
  try {
    const found = await findCustomerByPhone(db, actor, session.draft.phone || "");
    if (found) {
      session.draft.customerId = found.id;
      session.draft.customerName = found.nama;
      session.state = "input_product";
      await sendMessage(
        chatId,
        customerFoundText({
          nama: found.nama,
          phone: found.whatsapp_phone || found.telepon,
          totalSpent: Number(found.total_spent || 0),
          lastPurchase: found.last_purchase_at,
        }),
      );
      if (!products.length) {
        await sendMessage(chatId, "Belum ada produk. Minta founder menambahkan di Inventory.");
        return;
      }
      await sendMessage(
        chatId,
        "Pilih produk:",
        products.slice(0, 10).map((p) => [{ text: p.name, data: `p:${p.id}` }]),
      );
    } else {
      session.state = "input_new_name";
      await sendMessage(chatId, "Customer baru. Masukkan nama customer.");
    }
  } catch (err) {
    await sendMessage(chatId, err instanceof Error ? err.message : "Gagal cek customer.");
  }
}

async function runConfirm(db: SalesDb, actor: Actor, chatId: number, session: Session) {
  const d = session.draft;
  if (!d.customerId && d.customerName && d.phone) {
    const created = await createCustomer(db, actor, {
      nama: d.customerName,
      phone: d.phone,
      kota: d.city,
      catatan: d.notes,
    });
    d.customerId = created.customer.id;
    if (created.duplicate) {
      await sendMessage(chatId, "Customer sudah terdaftar. Melanjutkan transaksi ke customer existing.");
    }
  }
  if (!d.customerId || !d.productId || !d.quantity || d.unitPrice == null) {
    await sendMessage(chatId, "Data transaksi belum lengkap. Ulangi /input.");
    return;
  }

  let photoFailed = false;
  const { order, duplicate } = await confirmSale(db, actor, {
    customerId: d.customerId,
    productId: d.productId,
    productName: d.productName || "Produk",
    quantity: d.quantity,
    unitPrice: d.unitPrice,
    discount: 0,
    paymentMethod: d.paymentMethod || "OTHER",
    paymentStatus: d.paymentStatus || "PAID",
    notes: d.notes,
    idempotencyKey: d.idempotencyKey || randomUUID(),
  });

  if (d.photoFileId && !duplicate) {
    try {
      const file = await downloadTelegramFile(d.photoFileId);
      await saveTestimonial(db, actor, {
        customerId: d.customerId,
        orderId: order.id,
        bytes: file.bytes,
        mime: file.mime,
        ext: file.ext,
        caption: d.photoCaption || null,
      });
    } catch (err) {
      photoFailed = true;
      salesLogError("testimonial_optional", err, { orderId: order.id });
    }
  }

  if (duplicate) {
    await sendMessage(chatId, "Transaksi ini sudah tercatat (anti double submit). Tidak dibuat ulang.");
    return;
  }

  await sendMessage(
    chatId,
    [
      "Transaksi tersimpan.",
      `${d.productName} × ${d.quantity} = ${fmtRp(order.total)}`,
      photoFailed ? "Foto testimoni gagal diunggah. Transaksi tetap tercatat." : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

async function sendRiwayat(db: SalesDb, actor: Actor, chatId: number) {
  const { rows } = await listOrders(db, actor, { pageSize: 8 });
  if (!rows.length) {
    await sendMessage(chatId, "Belum ada transaksi.");
    return;
  }
  for (const o of rows) {
    const item = o.order_items?.[0];
    await sendMessage(
      chatId,
      `${fmtDateLongId(o.order_date)}\n${item?.product_name_snapshot || "Produk"} — ${item?.qty || 0} pcs — ${fmtRp(o.total)}`,
      [
        [
          { text: "DETAIL", data: `od:${o.id}` },
          { text: "DELETE", data: `del:${o.id}` },
        ],
      ],
    );
  }
}

async function sendRekap(db: SalesDb, actor: Actor, chatId: number, kind: ReportKind) {
  const report = await buildSalesReport(db, actor, { kind });
  const products = report.byProduct.map((p) => `${p.name}:\n${p.qty} pcs`).join("\n\n");
  const top = report.ranking
    .slice(0, 5)
    .map((s, i) => `${i + 1}. ${s.nama} — ${s.qty} pcs`)
    .join("\n");
  await sendMessage(
    chatId,
    [
      "================================",
      "REKAP PENJUALAN HENIMA",
      report.range.label,
      "",
      `Total transaksi:\n${report.totalOrders}`,
      "",
      `Total pcs:\n${report.totalQty}`,
      "",
      products,
      "",
      `Omzet:\n${fmtRp(report.totalRevenue)}`,
      "================================",
      "",
      "TOP SALES",
      top || "—",
      "================================",
      `CUSTOMER BARU:\n${report.newCustomers}`,
      "",
      `REPEAT CUSTOMER:\n${report.repeatCustomers}`,
      "================================",
    ].join("\n"),
  );
}

async function sendPdf(db: SalesDb, actor: Actor, chatId: number, kind: ReportKind) {
  try {
    const report = await buildSalesReport(db, actor, { kind });
    const bytes = await buildSalesReportPdf({
      businessName: actor.businessName,
      generatedAt: todayWib(),
      report,
    });
    await sendDocument(chatId, `henima-laporan-${report.range.from}-${report.range.to}.pdf`, bytes, "Laporan penjualan Henima");
  } catch (err) {
    salesLogError("pdf", err, { staffId: actor.staffId });
    await sendMessage(chatId, "PDF gagal dibuat. Silakan coba lagi.");
  }
}

export function verifyTelegramSecret(header: string | null) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  if (!expected) return false;
  return header === expected;
}

export { salesLog };
