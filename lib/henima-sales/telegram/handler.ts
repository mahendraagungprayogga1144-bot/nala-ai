import { randomUUID } from "crypto";
import { todayWib } from "@/lib/date";
import type { SalesDb } from "../db";
import { salesLog, salesLogError } from "../log";
import { resolveActorByTelegramId, linkTelegramByInvite } from "../authz";
import { listProducts, listStaff } from "../staff-service";
import { createCustomer, findCustomerByPhone, listCustomers } from "../customer-service";
import { confirmSale, listOrders, getOrder, softDeleteOrder, latestOrderId, latestOrdersByCustomerIds } from "../order-service";
import { createFollowUp } from "../followup-service";
import { saveTestimonial } from "../testimonial-service";
import { achievementFor } from "../target-service";
import { buildSalesReport, servedByLabel, type ReportKind } from "../report-service";
import { buildSalesReportPdf } from "../pdf";
import { buildOrderNota } from "../nota";
import { fmtDateLongId, fmtRp } from "../money";
import { writeAudit } from "../audit";
import { displayPhone } from "../phone";
import type { Actor } from "../types";
import { paymentLabel } from "../types";
import { reduceBot, customerFoundText, confirmKeyboard, productKeyboard, paymentKeyboard } from "./fsm";
import type { Session } from "./session";
import { connectedStatusText, newDraft, formatConfirm, draftSaleLines, applyLinesToDraft, applyCatalogPricing } from "./session";
import { buildPackLines, parseOpsIntent } from "./nl-sale";
import { answerCallback, downloadTelegramFile, sendChatAction, sendDocument, sendMessage } from "./api";
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

async function claimUpdate(db: SalesDb, updateId: number): Promise<boolean> {
  const { error } = await db.from("module_sales_telegram_updates").insert({ update_id: updateId });
  if (!error) return true;
  const code = (error as { code?: string }).code;
  if (code === "23505" || /duplicate|unique/i.test(error.message || "")) return false;
  const { data: seen } = await db
    .from("module_sales_telegram_updates")
    .select("update_id")
    .eq("update_id", updateId)
    .maybeSingle();
  return !seen;
}

function parseIncoming(update: TgUpdate): Parameters<typeof reduceBot>[1] | null {
  if (update.callback_query?.data) return { kind: "callback", data: update.callback_query.data };
  if (update.message?.photo?.length) {
    const fileId = update.message.photo[update.message.photo.length - 1].file_id;
    return { kind: "photo", fileId, caption: update.message.caption };
  }
  if (update.message?.text) {
    const parsed = parseCommand(update.message.text);
    return parsed
      ? { kind: "command", cmd: parsed.cmd, arg: parsed.arg }
      : { kind: "text", text: update.message.text };
  }
  return null;
}

function needsProductCatalog(incoming: Parameters<typeof reduceBot>[1], session: Session) {
  if (session.state === "input_product" || session.state === "input_phone" || session.state === "input_new_name") {
    return true;
  }
  if (incoming.kind === "callback") {
    return /^(p:|prod:|pack:|item:)/.test(incoming.data);
  }
  if (incoming.kind === "command") {
    return incoming.cmd === "/input";
  }
  if (incoming.kind === "text") {
    return parseOpsIntent(incoming.text).type === "none";
  }
  return false;
}

function sameSession(a: Session, b: Session) {
  return a.state === b.state && JSON.stringify(a.draft) === JSON.stringify(b.draft);
}

export async function handleTelegramUpdate(db: SalesDb, update: TgUpdate) {
  const from = update.message?.from || update.callback_query?.from;
  const chatId = update.message?.chat.id || update.callback_query?.message?.chat.id;
  if (!from || !chatId) return;
  const telegramUserId = from.id;

  void sendChatAction(chatId, "typing");
  if (update.callback_query?.id) void answerCallback(update.callback_query.id);

  const incoming = parseIncoming(update);
  if (!incoming) {
    await claimUpdate(db, update.update_id);
    return;
  }

  const [fresh, resolvedActor, session] = await Promise.all([
    claimUpdate(db, update.update_id),
    resolveActorByTelegramId(db, telegramUserId),
    loadSession(db, telegramUserId),
  ]);
  if (!fresh) return;
  let actor = resolvedActor;

  if (!telegramRateOk(telegramUserId)) {
    await sendMessage(chatId, "Terlalu banyak permintaan. Coba lagi sebentar.");
    return;
  }

  const products =
    actor && needsProductCatalog(incoming, session) ? await listProducts(db, actor.businessId) : [];

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
          await sendMessage(chatId, connectedStatusText(actor));
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
        void sendChatAction(chatId, "upload_document");
        await sendPdf(db, actor, chatId, effect.kind as ReportKind);
      } else if (effect.type === "send_nota" && actor) {
        void sendChatAction(chatId, "upload_document");
        await sendNota(db, actor, chatId, effect.orderId, effect.query);
      } else if (effect.type === "send_riwayat" && actor) {
        await sendRiwayat(db, actor, chatId);
      } else if (effect.type === "send_target" && actor) {
        await sendTarget(db, actor, chatId);
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
    await sendTarget(db, actor, chatId);
  } else if (actor && incoming.kind === "callback" && incoming.data.startsWith("od:")) {
    const order = await getOrder(db, actor, incoming.data.slice(3));
    await sendMessage(
      chatId,
      [
        `${fmtDateLongId(order.order_date)}`,
        `${orderItemsLabel(order.order_items)} — ${fmtRp(order.total)}`,
        `Bayar: ${paymentLabel(order.metode_bayar)} / ${order.payment_status}`,
      ].join("\n"),
      [
        [{ text: "EDIT", data: "confirm_edit" }, { text: "DELETE", data: `del:${order.id}` }],
        [{ text: "NOTA", data: `nota:${order.id}` }],
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

  if (!sameSession(session, next)) {
    await saveSession(db, telegramUserId, actor, next);
  }
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
    } else if (!session.draft.customerName) {
      session.state = "input_new_name";
      await sendMessage(chatId, "Customer baru. Masukkan nama customer.");
      return;
    }

    if (!products.length) {
      await sendMessage(chatId, "Belum ada produk parfum. Founder menambah Afternoon / The Distance di Henima Sales → Settings.");
      return;
    }

    if (
      (session.draft.packProductIds?.length || 0) >= 2 &&
      !session.draft.lines?.length &&
      session.draft.packQty &&
      session.draft.unitPrice != null
    ) {
      const pack = products.filter((p) => session.draft.packProductIds?.includes(p.id));
      if (pack.length >= 2) {
        session.draft = applyLinesToDraft(
          session.draft,
          buildPackLines(pack, session.draft.packQty, session.draft.unitPrice),
        );
      }
    }

    if (!session.draft.productId && !session.draft.lines?.length && (session.draft.packProductIds?.length || 0) < 2) {
      session.state = "input_product";
      if (found) {
        await sendMessage(
          chatId,
          customerFoundText({
            nama: found.nama,
            phone: found.whatsapp_phone || found.telepon,
            totalSpent: Number(found.total_spent || 0),
            lastPurchase: found.last_purchase_at,
          }),
        );
      }
      await sendMessage(
        chatId,
        "Pilih produk (atau ketik afternoon dan the distance):",
        productKeyboard(products),
      );
      return;
    }

    if (!session.draft.quantity && !session.draft.packQty) {
      session.state = "input_qty";
      await sendMessage(
        chatId,
        session.draft.packProductIds?.length
          ? `Paket: ${session.draft.productName}\nBerapa jumlah paket?`
          : `Produk: ${session.draft.productName}\nBerapa jumlah botol?`,
      );
      return;
    }

    if (session.draft.unitPrice == null && !session.draft.orderTotal) {
      session.state = "input_price";
      await sendMessage(
        chatId,
        session.draft.packProductIds?.length ? "Masukkan harga paket (total 2 produk)." : "Masukkan harga jual per botol.",
      );
      return;
    }

    if (!session.draft.paymentMethod) {
      session.state = "input_pay_method";
      await sendMessage(chatId, "Metode pembayaran?\nKetik tf / qris / cash atau pilih tombol.", paymentKeyboard());
      return;
    }

    session.draft.paymentStatus = session.draft.paymentStatus || "PAID";
    session.draft = applyCatalogPricing(session.draft, products);
    if (session.draft.nlChat) {
      await runConfirm(db, actor, chatId, session);
      session.state = "idle";
      session.draft = newDraft();
      return;
    }
    session.state = "input_confirm";
    await sendMessage(
      chatId,
      formatConfirm(session.draft, actor, fmtDateLongId(todayWib())),
      confirmKeyboard(),
    );
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
  const lines = draftSaleLines(d);
  if (!d.customerId || !lines.length) {
    await sendMessage(chatId, "Data transaksi belum lengkap. Ulangi /input.");
    return;
  }

  let photoFailed = false;
  const { order, duplicate } = await confirmSale(db, actor, {
    customerId: d.customerId,
    productId: lines[0].productId,
    productName: lines.map((line) => `${line.productName} × ${line.quantity}`).join(" + "),
    quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    unitPrice: lines[0].unitPrice,
    discount: d.discount || 0,
    discountPercent: d.discountPercent || null,
    paymentMethod: d.paymentMethod || "OTHER",
    paymentStatus: d.paymentStatus || "PAID",
    notes: d.notes || (lines.length > 1 ? "paket" : null),
    idempotencyKey: d.idempotencyKey || randomUUID(),
    lines: lines.length > 1 ? lines : undefined,
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
      `${d.productName || lines.map((line) => line.productName).join(" + ")} = ${fmtRp(order.total)}`,
      photoFailed ? "Foto testimoni gagal diunggah. Transaksi tetap tercatat." : "",
      "Ketik NOTA atau tekan tombol untuk invoice customer.",
    ]
      .filter(Boolean)
      .join("\n"),
    [[{ text: "NOTA", data: `nota:${order.id}` }]],
  );
}

function orderItemsLabel(items?: { product_name_snapshot: string | null; qty: number }[]) {
  if (!items?.length) return "Produk";
  return items.map((i) => `${i.product_name_snapshot || "Produk"} × ${i.qty}`).join(" + ");
}

function progressBar(pct: number) {
  const filled = Math.min(10, Math.max(0, Math.round(pct / 10)));
  return `${"█".repeat(filled)}${"░".repeat(10 - filled)}`;
}

function targetStatus(sold: number, goal: number, pct: number) {
  if (!(goal > 0)) return "belum di-set";
  if (sold >= goal) return "TERCAPAI";
  if (pct >= 70) return "MENDEKATI";
  return "BELUM";
}

function periodLine(label: string, a: { sold: number; target: number; achievement: number; remaining: number }) {
  if (!(a.target > 0)) {
    return `${label}: ${a.sold} pcs · target belum di-set`;
  }
  return [
    `${label}: ${a.sold} / ${a.target} pcs`,
    `${progressBar(a.achievement)} ${a.achievement}%  ${targetStatus(a.sold, a.target, a.achievement)}`,
    a.sold >= a.target ? "Sudah terlaksana." : `Sisa ${a.remaining} pcs`,
  ].join("\n");
}

async function sendTarget(db: SalesDb, actor: Actor, chatId: number) {
  const monthly = await achievementFor(db, actor, "monthly");
  const weekly = await achievementFor(db, actor, "weekly");
  const daily = await achievementFor(db, actor, "daily");
  const lines = [
    `SALES: ${actor.nama.toUpperCase()}`,
    "",
    periodLine("Hari ini", daily),
    "",
    periodLine("Minggu ini", weekly),
    "",
    periodLine("Bulan ini", monthly),
    `Omzet bulan ini: ${fmtRp(monthly.omzet)}`,
  ];

  if (actor.role === "FOUNDER" || actor.role === "LEADER") {
    const staff = (await listStaff(db, actor)).filter((s) => s.role === "SALES" || s.role === "LEADER");
    if (staff.length) {
      lines.push("", "PER SALES (bulan ini):");
      for (const s of staff) {
        const a = await achievementFor(db, actor, "monthly", s.id);
        const status = targetStatus(a.sold, a.target, a.achievement);
        lines.push(
          a.target > 0
            ? `${s.nama}: ${a.sold} / ${a.target} pcs  ${a.achievement}%  ${status}`
            : `${s.nama}: ${a.sold} pcs · target belum di-set`,
        );
      }
    }
  }

  if (!(daily.target > 0) && !(weekly.target > 0) && !(monthly.target > 0)) {
    lines.push("", "Founder set target di Henima Sales → Targets.");
  }

  await sendMessage(chatId, lines.join("\n"));
}

async function sendRiwayat(db: SalesDb, actor: Actor, chatId: number) {
  const { rows } = await listOrders(db, actor, { pageSize: 8 });
  if (!rows.length) {
    await sendMessage(chatId, "Belum ada transaksi.");
    return;
  }
  for (const o of rows) {
    await sendMessage(
      chatId,
      `${fmtDateLongId(o.order_date)}\n${orderItemsLabel(o.order_items)} — ${fmtRp(o.total)}`,
      [
        [
          { text: "DETAIL", data: `od:${o.id}` },
          { text: "NOTA", data: `nota:${o.id}` },
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
  const served = servedByLabel(report.servedBy);
  const rankBlock = report.ranking.length
    ? ["", "TOP SALES", top, "================================"]
    : [];
  const servedBlock = served ? ["", served, "================================"] : [];
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
      ...rankBlock,
      ...servedBlock,
      `CUSTOMER BARU:\n${report.newCustomers}`,
      "",
      `REPEAT CUSTOMER:\n${report.repeatCustomers}`,
      "================================",
    ].join("\n"),
  );
}

async function sendNota(db: SalesDb, actor: Actor, chatId: number, orderId?: string, query?: string) {
  try {
    if (orderId) {
      const { bytes, filename, caption } = await buildOrderNota(db, actor, orderId);
      await sendDocument(chatId, filename, bytes, caption);
      return;
    }

    if (query) {
      const { rows: customers } = await listCustomers(db, actor, { q: query, pageSize: 8, skipCount: true });
      if (!customers.length) {
        await sendMessage(chatId, `Customer "${query}" tidak ditemukan.\nKetik: nota nama customer\nContoh: nota regan`);
        return;
      }
      const lower = query.toLowerCase();
      const ranked = [...customers].sort((a, b) => {
        const an = a.nama.toLowerCase();
        const bn = b.nama.toLowerCase();
        const score = (n: string) => (n === lower ? 0 : n.startsWith(lower) ? 1 : n.includes(lower) ? 2 : 3);
        return score(an) - score(bn);
      });
      const bestScore = ranked[0].nama.toLowerCase() === lower ? 0 : ranked[0].nama.toLowerCase().startsWith(lower) ? 1 : 2;
      const top = ranked.filter((c) => {
        const n = c.nama.toLowerCase();
        const s = n === lower ? 0 : n.startsWith(lower) ? 1 : n.includes(lower) ? 2 : 3;
        return s === bestScore;
      });

      const orders = await latestOrdersByCustomerIds(db, actor, top.slice(0, 5).map((c) => c.id));
      const byCustomer = new Map(orders.map((o) => [o.customer_id, o]));
      const choices = top
        .slice(0, 5)
        .map((c) => {
          const o = byCustomer.get(c.id);
          return o ? { nama: c.nama, orderId: o.id, date: o.order_date, total: o.total } : null;
        })
        .filter((c): c is { nama: string; orderId: string; date: string; total: number } => Boolean(c));
      if (!choices.length) {
        await sendMessage(chatId, `Customer ${top[0]?.nama || query} belum punya transaksi.`);
        return;
      }
      if (choices.length === 1) {
        const { bytes, filename, caption } = await buildOrderNota(db, actor, choices[0].orderId);
        await sendDocument(chatId, filename, bytes, caption);
        return;
      }
      await sendMessage(
        chatId,
        `Beberapa customer cocok untuk "${query}". Pilih nota:`,
        choices.map((c) => [{ text: `${c.nama} · ${fmtDateLongId(c.date)} · ${fmtRp(c.total)}`, data: `nota:${c.orderId}` }]),
      );
      return;
    }

    const id = await latestOrderId(db, actor);
    if (!id) {
      await sendMessage(chatId, "Belum ada transaksi untuk dibuatkan nota.\nKetik: nota nama customer");
      return;
    }
    const { bytes, filename, caption } = await buildOrderNota(db, actor, id);
    await sendDocument(chatId, filename, bytes, caption);
  } catch (err) {
    salesLogError("nota", err, { staffId: actor.staffId, orderId, query });
    await sendMessage(chatId, "Nota gagal dibuat. Silakan coba lagi.");
  }
}

async function sendPdf(db: SalesDb, actor: Actor, chatId: number, kind: ReportKind) {
  try {
    const report = await buildSalesReport(db, actor, { kind });
    const bytes = await buildSalesReportPdf({
      businessName: actor.businessName,
      generatedAt: todayWib(),
      report,
    });
    await sendDocument(
      chatId,
      `henima-rekap-${report.range.from}-${report.range.to}.pdf`,
      bytes,
      `Rekap ${report.range.label}: ${report.totalQty} pcs · ${fmtRp(report.totalRevenue)}`,
    );
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
