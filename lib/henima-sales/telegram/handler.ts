import { randomUUID } from "crypto";
import { todayWib } from "@/lib/date";
import type { SalesDb } from "../db";
import { salesLog, salesLogError } from "../log";
import { resolveActorByTelegramId, linkTelegramByInvite } from "../authz";
import { createExpense, listExpenses, softDeleteExpense, updateExpense } from "../expense-service";
import { latestRestorableAudit, writeAudit } from "../audit";
import { periodRange, type PeriodKind } from "../dates";
import { createStaff, listProducts, listStaff, upsertSalesProduct } from "../staff-service";
import { salesInviteShareText } from "../sales-guide";
import { formatSalesBriefing, formatTeamRoster, isManager, mainMenuKeyboard, recruitPrompt } from "./menu";
import { createCustomer, findCustomerByPhone, getCustomer, listCustomers } from "../customer-service";
import { confirmSale, listOrders, getOrder, softDeleteOrder, updateOrder, latestOrderId, latestOrdersByCustomerIds } from "../order-service";
import { createFollowUp } from "../followup-service";
import { saveTestimonial } from "../testimonial-service";
import { achievementFor, upsertTarget } from "../target-service";
import { buildSalesReport, servedByLabel, type ReportKind } from "../report-service";
import { buildSalesReportPdf } from "../pdf";
import { buildOrderNota } from "../nota";
import { fmtDateLongId, fmtRp } from "../money";
import { displayPhone, isUsablePhone } from "../phone";
import type { Actor } from "../types";
import { paymentLabel, SalesError } from "../types";
import { reduceBot, looksLikeGenericHint, customerFoundText, confirmKeyboard, productKeyboard, paymentKeyboard } from "./fsm";
import { shouldUseDeskAgent } from "./agent";
import { runDeskLoop } from "./desk-loop";
import { executeFounderCommand, needsFounderApproval, parseFounderCommand } from "./founder-ops";
import { clearAgentMemory, compactTurns, createAgentTask, listAgentMemory, listAgentTasks, memoryContext, saveAgentNote, setAgentTaskStatus } from "./agent-memory";
import type { Session, SessionMemory } from "./session";
import { connectedStatusText, newDraft, formatConfirm, formatOrderItemsLabel, formatRiwayatCard, customerNameFromNote, draftSaleLines, applyLinesToDraft, applyCatalogPricing } from "./session";
import { buildPackLines, extractStaffQuery, looksLikeFollowUp, parseOpsIntent, periodFromText } from "./nl-sale";
import { alreadyApplied, looksLikeExpenseMutation, planExpenseMessage } from "./expense-nl";
import { looksLikeWorkEdit, planWorkMessage, taskJob } from "./crud-nl";
import { notifyFounderWhatsApp } from "../whatsapp/infobip";
import { runDeskTool } from "./desk-tools";
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
  const payload = (data.payload || {}) as Session["draft"] & { _mem?: SessionMemory };
  const { _mem, ...draft } = payload;
  return {
    state: (data.state as Session["state"]) || "idle",
    draft: Object.keys(draft).length ? (draft as Session["draft"]) : newDraft(),
    memory: _mem,
  };
}

async function saveSession(db: SalesDb, telegramUserId: number, actor: Actor | null, session: Session) {
  await db.from("module_sales_telegram_sessions").upsert({
    telegram_user_id: telegramUserId,
    business_id: actor?.businessId || null,
    staff_id: actor?.staffId || null,
    state: session.state,
    payload: { ...session.draft, _mem: session.memory || null },
    updated_at: new Date().toISOString(),
  });
}

function remember(mem: SessionMemory | undefined, user: string, topic?: string): SessionMemory {
  return compactTurns(mem, user, topic);
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
    return /^(p:|pm:|prod:|pack:|item:)/.test(incoming.data);
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

  let reduced = reduceBot(session, incoming, { actor, products });
  if (actor && incoming.kind === "text" && session.state === "idle") {
    const bare = incoming.text.trim().toLowerCase();
    if (/^(lihat memori|memory)$/.test(bare)) {
      const listed = await listAgentMemory(db, actor);
      const text = listed.missing
        ? "Memori jangka panjang belum aktif. Jalankan SQL agent di Supabase."
        : listed.rows.length
          ? listed.rows.map((r) => `• ${r.content}`).join("\n")
          : "Belum ada catatan jangka panjang.";
      reduced = { session, effects: [{ type: "reply", reply: { text, keyboard: mainMenuKeyboard(actor) } }] };
    } else if (/^(hapus memori|lupakan)$/.test(bare)) {
      reduced = { session, effects: [{ type: "reply", reply: { text: await clearAgentMemory(db, actor) } }] };
    } else if (/^(lihat tugas|daftar tugas)$/.test(bare)) {
      const listed = await listAgentTasks(db, actor);
      reduced = { session, effects: [{ type: "reply", reply: { text: listed.text, keyboard: mainMenuKeyboard(actor) } }] };
    } else if (/^buat tugas\s+/i.test(incoming.text.trim())) {
      const title = incoming.text.trim().replace(/^buat tugas\s+/i, "");
      const job = taskJob(title);
      const made = await createAgentTask(db, actor, title, undefined, job ? "running" : "pending");
      if (!job || !made.ok) {
        reduced = { session, effects: [{ type: "reply", reply: { text: made.ok ? `${made.text}\nTugas ini dicatat. Aku belum menjalankannya otomatis.` : made.text } }] };
      } else if (job === "pdf") {
        await setAgentTaskStatus(db, actor, made.id, "completed", "PDF bulan ini dikirim");
        reduced = { session, effects: [{ type: "reply", reply: { text: `${made.text}\nPDF bulan ini menyusul.` } }, { type: "send_pdf", kind: "this_month" }] };
      } else {
        const catalog = products.length ? products : await listProducts(db, actor.businessId);
        const out = await runDeskTool("generate_spreadsheet", {}, { db, actor, catalog, telegramUserId });
        await setAgentTaskStatus(db, actor, made.id, out.text.includes("gagal") ? "failed" : "completed", out.text.slice(0, 180));
        reduced = { session, effects: [{ type: "reply", reply: { text: `${made.text}\n${out.text}` } }, ...(out.effects || [])] };
      }
    } else if (/^(ingat|catat)\s+/i.test(incoming.text.trim())) {
      const note = incoming.text.trim().replace(/^(ingat|catat)\s+/i, "");
      const saved = await saveAgentNote(db, actor, telegramUserId, note);
      reduced = { session, effects: [{ type: "reply", reply: { text: saved.message } }] };
    } else if (actor.role === "FOUNDER" && /^(ya|iya|setuju|ok)$/.test(bare) && session.memory?.pending) {
      const cmd = parseFounderCommand(session.memory.pending.command);
      session.memory = { ...session.memory, pending: undefined };
      reduced = { session, effects: [{ type: "run_founder", cmd }] };
    }
  }
  let expenseHandled = false;
  const confirmKeys = [[{ text: "Konfirmasi", data: "ex:yes" }, { text: "Batal", data: "ex:no" }]];
  if (actor && incoming.kind === "callback" && (incoming.data === "ex:yes" || incoming.data === "ex:no")) {
    expenseHandled = true;
    const crud = session.memory?.crud;
    const work = session.memory?.work;
    if (incoming.data === "ex:no" || (!crud && !work)) {
      const memory = { ...(session.memory || {}), crud: null, work: null };
      reduced = {
        session: { ...session, memory },
        effects: [{ type: "reply", reply: { text: incoming.data === "ex:no" ? "Dibatalkan. Tidak ada yang disimpan." : "Tidak ada konfirmasi yang menunggu." } }],
      };
    } else if (work) {
      reduced = { session, effects: [{ type: "apply_work", draft: work }] };
    } else if (crud) {
      reduced = { session, effects: [{ type: "apply_expense", draft: crud }] };
    }
  }
  if (actor && incoming.kind === "text" && session.state === "idle" && !expenseHandled && looksLikeExpenseMutation(incoming.text)) {
    const rows = await listExpenses(db, actor, { from: "2024-01-01", to: todayWib() });
    const plan = planExpenseMessage(incoming.text, {
      role: actor.role,
      focus: session.memory?.expense,
      rows: rows.map((r) => ({ id: r.id, amount: r.amount, note: r.note || "", expenseDate: r.expense_date })),
      today: todayWib(),
    });
    if (plan.type !== "none") {
      expenseHandled = true;
      const memory = { ...(session.memory || {}), crud: plan.type === "confirm" ? plan.draft : null };
      reduced = {
        session: { ...session, memory },
        effects: [{
          type: "reply",
          reply: { text: plan.text, keyboard: plan.type === "confirm" ? confirmKeys : mainMenuKeyboard(actor) },
        }],
      };
    }
  }
  if (actor && incoming.kind === "text" && session.state === "idle" && !expenseHandled && looksLikeWorkEdit(incoming.text)) {
    const catalog = products.length ? products : await listProducts(db, actor.businessId);
    const listed = await listOrders(db, actor, { pageSize: 5 });
    const sales = listed.rows.map((row) => ({
      id: row.id,
      total: Number(row.total || 0),
      qty: (row.order_items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0) || 1,
      product: (row.order_items || []).map((item) => item.product_name_snapshot || "Produk").join(" + "),
      items: row.order_items?.length || 1,
    }));
    const undo = /\b(kembalikan nilai|batalkan perubahan)\b/i.test(incoming.text);
    if (undo && !session.memory?.expense?.before) {
      const audit = await latestRestorableAudit(db, actor.businessId);
      const old = (audit?.old_value || null) as { amount?: number; note?: string; expense_date?: string; total?: number; qty?: number; stock?: number; price?: number; name?: string } | null;
      expenseHandled = true;
      if (!audit || !old || !audit.entity_id) {
        reduced = { session, effects: [{ type: "reply", reply: { text: "Tidak ada perubahan terakhir yang bisa dikembalikan dari catatan audit." } }] };
      } else if (audit.action === "UPDATE_EXPENSE" && old.amount) {
        const draft = {
          kind: "expense_restore" as const,
          key: `undo:${audit.id}`,
          id: String(audit.entity_id),
          label: old.note || "biaya",
          next: Number(old.amount),
          before: Number((audit.new_value as { amount?: number } | null)?.amount || 0),
          note: old.note,
          expenseDate: old.expense_date,
        };
        reduced = {
          session: { ...session, memory: { ...(session.memory || {}), work: draft, crud: null } },
          effects: [{ type: "reply", reply: { text: `Kembalikan biaya ${draft.id.slice(0, 8)} ke nilai audit?`, keyboard: confirmKeys } }],
        };
      } else if (audit.action === "UPDATE_ORDER" && old.total) {
        const draft = {
          kind: "sale_total" as const,
          key: `undo:${audit.id}`,
          id: String(audit.entity_id),
          label: "closing",
          next: Math.round(Number(old.total) / Math.max(1, Number(old.qty || 1))),
          before: Number((audit.new_value as { total?: number } | null)?.total || 0),
        };
        reduced = {
          session: { ...session, memory: { ...(session.memory || {}), work: draft, crud: null } },
          effects: [{ type: "reply", reply: { text: `Kembalikan closing ${draft.id.slice(0, 8)} ke total sebelumnya? Nilai ini dari audit.`, keyboard: confirmKeys } }],
        };
      } else if (audit.action === "UPDATE_PRODUCT") {
        const draft = {
          kind: (old.stock != null ? "stock" : "catalog_price") as "stock" | "catalog_price",
          key: `undo:${audit.id}`,
          id: String(audit.entity_id),
          label: old.name || "produk",
          next: Number(old.stock != null ? old.stock : old.price || 0),
          before: 0,
        };
        reduced = {
          session: { ...session, memory: { ...(session.memory || {}), work: draft, crud: null } },
          effects: [{ type: "reply", reply: { text: `Kembalikan ${draft.label} ke nilai audit ${draft.next}?`, keyboard: confirmKeys } }],
        };
      } else {
        reduced = { session, effects: [{ type: "reply", reply: { text: "Perubahan terakhir itu tidak bisa dikembalikan dengan aman." } }] };
      }
    }
    if (!expenseHandled) {
      const plan = planWorkMessage(incoming.text, {
        role: actor.role,
        sales,
        focusSale: session.memory?.sale,
        products: catalog.map((p) => ({ id: p.id, name: p.name, price: Number(p.price || 0), stock: Number(p.stock || 0) })),
      });
      if (plan.type !== "none") {
        expenseHandled = true;
        reduced = {
          session: { ...session, memory: { ...(session.memory || {}), work: plan.type === "confirm" ? plan.draft : null, crud: null } },
          effects: [{ type: "reply", reply: { text: plan.text, keyboard: plan.type === "confirm" ? confirmKeys : mainMenuKeyboard(actor) } }],
        };
      }
    }
  }
  const bareText = incoming.kind === "text" ? incoming.text.trim() : "";
  const memoryHandled =
    /^(lihat memori|memory|hapus memori|lupakan|lihat tugas|daftar tugas)$/i.test(bareText) ||
    /^(ingat|catat|buat tugas)\s+/i.test(bareText) ||
    (/^(ya|iya|setuju|ok)$/i.test(bareText) && Boolean(session.memory?.pending));
  let founderGate = false;
  if (actor?.role === "FOUNDER" && incoming.kind === "text" && session.state === "idle" && !memoryHandled && !expenseHandled) {
    const founderCmd = parseFounderCommand(incoming.text);
    if (founderCmd.type !== "none") {
      founderGate = true;
      if (needsFounderApproval(founderCmd)) {
        session.memory = {
          ...(session.memory || {}),
          pending: { command: incoming.text.trim(), label: founderCmd.type },
        };
        reduced = {
          session,
          effects: [{
            type: "reply",
            reply: { text: "Ini mengubah data live. Balas YA untuk lanjut, atau ketik perintah lain untuk batal." },
          }],
        };
      } else {
        reduced = { session: { state: "idle", draft: newDraft(), memory: session.memory }, effects: [{ type: "run_founder", cmd: founderCmd }] };
      }
    }
  }
  if (actor && incoming.kind === "text" && session.state === "idle" && !memoryHandled && !founderGate && !expenseHandled) {
    const catalog = products.length ? products : await listProducts(db, actor.businessId);
    const raw = incoming.text;
    const combined =
      looksLikeFollowUp(raw, session.memory?.lastUser) && session.memory?.lastUser
        ? `${session.memory.lastUser}. ${raw}`
        : raw;
    const unmatched = looksLikeGenericHint(reduced.effects);
    if (
      unmatched ||
      shouldUseDeskAgent(combined, catalog, session.memory, unmatched) ||
      shouldUseDeskAgent(raw, catalog, session.memory, unmatched)
    ) {
      const parsed = periodFromText(combined);
      const explicitDay = /\b(hari\s+ini|today|kemarin|yesterday)\b/i.test(combined);
      const kind = (parsed.period === "today" && !explicitDay ? "this_month" : parsed.period) as PeriodKind;
      const range = periodRange(kind === "custom" ? "custom" : kind, { from: parsed.from, to: parsed.to });
      const report = await buildSalesReport(db, actor, { kind: "custom", from: range.from, to: range.to });
      const history = (session.memory?.turns || [])
        .slice(-6)
        .map((t) => `${t.role}: ${t.text}`)
        .join("\n");
      const longMemory = await memoryContext(db, actor);
      const looped = await runDeskLoop({
        db,
        actor,
        text: combined,
        history,
        longMemory,
        telegramUserId,
        catalog,
        report,
        range,
        session,
      });
      if (looped) reduced = looped;
    }
  }
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
          if (actor) {
            await sendMessage(
              chatId,
              `Akun ini sudah CONNECTED sebagai ${actor.nama} (${actor.role}).\n\nKode undangan hanya untuk sales baru di Telegram mereka sendiri.\nUntuk cek status Anda, ketik /start tanpa kode.`,
            );
          } else {
            await sendMessage(chatId, err instanceof Error ? err.message : "Kode undangan tidak ditemukan.");
          }
        }
      } else if (effect.type === "apply_work" && actor) {
        const draft = effect.draft;
        if (draft.kind === "sale_delete") {
          await softDeleteOrder(db, actor, draft.id);
          next = { ...next, memory: { ...(session.memory || {}), work: null, sale: null } };
          await sendMessage(chatId, `Closing ${draft.id.slice(0, 8)} dihapus dari omzet.`);
        } else if (draft.kind === "sale_total") {
          const order = await getOrder(db, actor, draft.id);
          const item = order.order_items?.[0];
          const qty = Number(item?.qty || 1);
          const saved = await updateOrder(db, actor, draft.id, {
            unitPrice: draft.next,
            quantity: qty,
            discount: 0,
            productName: item?.product_name_snapshot || draft.label,
          });
          const sale = {
            id: saved.id,
            total: Number(saved.total || 0),
            qty,
            product: item?.product_name_snapshot || draft.label,
            items: saved.order_items?.length || 1,
          };
          next = { ...next, memory: { ...(session.memory || {}), work: null, sale } };
          await sendMessage(chatId, `Closing ${saved.id.slice(0, 8)} diubah. Total sekarang ${fmtRp(Number(saved.total || 0))}.`);
        } else if (draft.kind === "stock" || draft.kind === "catalog_price") {
          const productsNow = await listProducts(db, actor.businessId);
          const hit = productsNow.find((p) => p.id === draft.id);
          if (!hit) throw new SalesError("Produk tidak ditemukan.", "product_missing");
          const saved = await upsertSalesProduct(db, actor, {
            id: hit.id,
            name: hit.name,
            price: draft.kind === "catalog_price" ? draft.next : Number(hit.price || 0),
            cost: hit.cost,
            stock: draft.kind === "stock" ? draft.next : Number(hit.stock || 0),
            unit: hit.unit,
          });
          await writeAudit(db, actor, {
            businessId: actor.businessId,
            action: "UPDATE_PRODUCT",
            entityType: "product",
            entityId: hit.id,
            oldValue: { name: hit.name, price: hit.price, stock: hit.stock },
            newValue: { name: saved.name, price: saved.price, stock: saved.stock },
          });
          next = { ...next, memory: { ...(session.memory || {}), work: null } };
          await sendMessage(chatId, draft.kind === "stock" ? `Stok ${saved.name} sekarang ${saved.stock} pcs.` : `Harga ${saved.name} sekarang ${fmtRp(Number(saved.price || 0))}.`);
        } else if (draft.kind === "target" && draft.period) {
          await upsertTarget(db, actor, { periodType: draft.period, quantityTarget: draft.next, effectiveFrom: todayWib() });
          next = { ...next, memory: { ...(session.memory || {}), work: null } };
          await sendMessage(chatId, `Target ${draft.label} disimpan: ${draft.next} unit.`);
        } else if (draft.kind === "expense_restore") {
          const row = await updateExpense(db, actor, draft.id, { amount: draft.next, note: draft.note, expenseDate: draft.expenseDate });
          next = { ...next, memory: { ...(session.memory || {}), work: null, expense: { id: row.id, amount: Number(row.amount), note: row.note || "", expenseDate: row.expense_date, key: draft.key } } };
          await sendMessage(chatId, `Biaya ${row.id.slice(0, 8)} dikembalikan ke ${fmtRp(Number(row.amount))}.`);
        }
      } else if (effect.type === "apply_expense" && actor) {
        const draft = effect.draft;
        const focus = session.memory?.expense;
        if (alreadyApplied(focus, draft) && focus?.id) {
          await sendMessage(chatId, `Sudah tersimpan. ID ${focus.id.slice(0, 8)}. Tidak dibuat dua kali.`);
        } else if (draft.op === "create") {
          const row = await createExpense(db, actor, { amount: draft.amount, note: draft.note, expenseDate: draft.expenseDate });
          next = {
            ...next,
            memory: {
              ...(session.memory || {}),
              crud: null,
              expense: { id: row.id, amount: Number(row.amount), note: row.note || draft.note, expenseDate: row.expense_date, key: draft.key },
            },
          };
          await sendMessage(chatId, `Tersimpan. ID ${row.id.slice(0, 8)}.\n${row.expense_date} · ${row.note} · ${fmtRp(Number(row.amount))}\nLaba berkurang. Omzet tidak dipotong. Ini bukan saldo rekening.`);
          void notifyFounderWhatsApp(`Biaya tercatat ${row.id.slice(0, 8)}\n${row.expense_date} · ${row.note} · ${fmtRp(Number(row.amount))}`);
        } else if (draft.op === "delete" && draft.id) {
          await softDeleteExpense(db, actor, draft.id);
          next = { ...next, memory: { ...(session.memory || {}), crud: null, expense: null } };
          await sendMessage(chatId, `Pengeluaran ${draft.id.slice(0, 8)} dihapus dari laporan.`);
        } else if (draft.id) {
          const row = await updateExpense(db, actor, draft.id, { amount: draft.amount, note: draft.note, expenseDate: draft.expenseDate });
          if (Number(row.amount) !== draft.amount || row.expense_date !== draft.expenseDate) {
            throw new SalesError("Perubahan belum sesuai data tersimpan.", "expense_verify");
          }
          next = {
            ...next,
            memory: {
              ...(session.memory || {}),
              crud: null,
              expense: {
                id: row.id,
                amount: Number(row.amount),
                note: row.note || draft.note,
                expenseDate: row.expense_date,
                key: draft.key,
                before: draft.before,
              },
            },
          };
          await sendMessage(chatId, `Berhasil diubah. ID ${row.id.slice(0, 8)}.\n${row.expense_date} · ${row.note} · ${fmtRp(Number(row.amount))}`);
        }
      } else if (effect.type === "save_expense" && actor) {
        const row = await createExpense(db, actor, {
          amount: effect.amount,
          note: effect.note,
          expenseDate: effect.expenseDate,
        });
        next = { state: "idle", draft: newDraft() };
        await sendMessage(
          chatId,
          [
            "Biaya operasional tercatat.",
            `${fmtDateLongId(row.expense_date)} · ${row.note}`,
            fmtRp(row.amount),
            "",
            "Laba perusahaan berkurang sebesar ini. Omzet penjualan tidak dipotong.",
          ].join("\n"),
        );
      } else if (effect.type === "send_expenses" && actor) {
        const range = periodRange(effect.kind as ReportKind, { from: effect.from, to: effect.to });
        const rows = await listExpenses(db, actor, { from: range.from, to: range.to });
        const total = rows.reduce((s, r) => s + r.amount, 0);
        if (!rows.length) {
          await sendMessage(
            chatId,
            `Belum ada biaya operasional (${range.label}).\nContoh: pengeluaran 100rb buat bensin`,
          );
        } else {
          await sendMessage(
            chatId,
            [
              `BIAYA OPERASIONAL`,
              range.label,
              "",
              ...rows.map((r) => `${fmtDateLongId(r.expense_date)} · ${r.note || "Operasional"} · ${fmtRp(r.amount)}`),
              "",
              `Total: ${fmtRp(total)}`,
              "Angka ini memotong laba, bukan omzet penjualan.",
            ].join("\n"),
          );
        }
      } else if (effect.type === "confirm_sale" && actor) {
        await runConfirm(db, actor, chatId, next);
        next = { state: "idle", draft: newDraft() };
      } else if (effect.type === "delete_order" && actor) {
        const res = await softDeleteOrder(db, actor, effect.orderId);
        await sendMessage(chatId, res.already_deleted ? "Transaksi sudah dihapus." : "Transaksi dihapus. Tidak dihitung di omzet, target, dan komisi.");
        next = { state: "idle", draft: newDraft() };
      } else if (effect.type === "send_report" && actor) {
        await sendRekap(db, actor, chatId, effect.kind as ReportKind, effect.from, effect.to);
      } else if (effect.type === "send_pdf" && actor) {
        void sendChatAction(chatId, "upload_document");
        await sendPdf(db, actor, chatId, effect.kind as ReportKind, effect.from, effect.to);
      } else if (effect.type === "send_nota" && actor) {
        void sendChatAction(chatId, "upload_document");
        await sendNota(db, actor, chatId, effect.orderId, effect.query);
      } else if (effect.type === "send_riwayat" && actor) {
        await sendRiwayat(db, actor, chatId);
      } else if (effect.type === "send_target" && actor) {
        await sendTarget(db, actor, chatId);
      } else if (effect.type === "recruit_sales" && actor) {
        if (!isManager(actor)) {
          await sendMessage(chatId, "Rekrut sales hanya untuk founder atau leader.");
        } else {
          const nama = effect.nama.trim();
          if (nama.length < 2) {
            await sendMessage(chatId, recruitPrompt());
          } else {
            const row = await createStaff(db, actor, { nama, role: "SALES" });
            const share = salesInviteShareText({
              staffName: row.nama,
              code: row.invite_code || "",
              brandName: actor.businessName,
              botUsername: process.env.TELEGRAM_BOT_USERNAME,
            });
            await sendMessage(
              chatId,
              [
                `Sales baru dicatat: ${row.nama}`,
                `Kode undangan: ${row.invite_code}`,
                "",
                "Salin pesan berikut ke WhatsApp/Telegram pribadi sales:",
                "",
                share,
              ].join("\n"),
            );
          }
        }
        next = { state: "idle", draft: newDraft() };
      } else if (effect.type === "send_team" && actor) {
        if (!isManager(actor)) {
          await sendMessage(chatId, "Daftar tim hanya untuk founder atau leader.");
        } else {
          const staff = await listStaff(db, actor);
          await sendMessage(chatId, formatTeamRoster(staff), mainMenuKeyboard(actor));
        }
      } else if (effect.type === "send_briefing" && actor) {
        await sendBriefing(db, actor, chatId, effect.query, effect.kind, effect.from, effect.to);
      } else if (effect.type === "send_file" && actor) {
        const bytes =
          effect.encoding === "base64"
            ? Uint8Array.from(Buffer.from(effect.content, "base64"))
            : new TextEncoder().encode(effect.content);
        await sendDocument(chatId, effect.filename, bytes, effect.caption, effect.mime || "text/plain");
      } else if (effect.type === "run_founder" && actor) {
        const text = await executeFounderCommand(db, actor, effect.cmd);
        await sendMessage(chatId, text, mainMenuKeyboard(actor));
        next = { state: "idle", draft: newDraft(), memory: session.memory };
      }
    } catch (err) {
      salesLogError("telegram_effect", err, { type: effect.type, telegramUserId });
      const msg =
        err instanceof SalesError
          ? err.message
          : err instanceof Error && err.message.includes("PDF")
            ? "PDF gagal dibuat. Silakan coba lagi."
            : "Terjadi masalah. Silakan coba lagi.";
      await sendMessage(chatId, msg);
    }
  }

  // Side-effect states that FSM only flags
  if (actor && next.state === "input_phone" && incoming.kind === "text" && (next.draft.phone || next.draft.skipPhone || next.draft.customerName)) {
    if (next.draft.phone || next.draft.skipPhone || session.state === "input_phone") {
      await continueAfterPhone(db, actor, chatId, next, products);
    }
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
    const customerName = await orderCustomerName(db, actor, order);
    await sendMessage(
      chatId,
      [
        `${fmtDateLongId(order.order_date)}`,
        customerName,
        `${formatOrderItemsLabel(order.order_items)} — ${fmtRp(order.total)}`,
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

  if (incoming.kind === "text") {
    next.memory = remember(
      { ...(session.memory || {}), ...(next.memory || {}) },
      incoming.text,
      shouldUseDeskAgent(incoming.text, products, session.memory, false) ? "desk" : session.memory?.topic,
    );
  } else {
    next.memory = { ...(session.memory || {}), ...(next.memory || {}) };
  }
  if (!sameSession(session, next) || incoming.kind === "text") {
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
    const found = session.draft.phone ? await findCustomerByPhone(db, actor, session.draft.phone) : null;
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
  if (!d.customerId && d.customerName) {
    const created = await createCustomer(db, actor, {
      nama: d.customerName,
      phone: d.phone && isUsablePhone(d.phone) ? d.phone : "",
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
    productName: lines.map((line) => line.productName).join(" + "),
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
  void notifyFounderWhatsApp(`Closing tersimpan ${order.id.slice(0, 8)}\n${d.productName || lines.map((line) => line.productName).join(" + ")} = ${fmtRp(order.total)}`);
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
  const names = await customerNamesByOrder(db, rows);
  for (const o of rows) {
    await sendMessage(
      chatId,
      formatRiwayatCard({
        dateLabel: fmtDateLongId(o.order_date),
        customerName: names.get(o.id) || customerNameFromNote(o.catatan),
        itemsLabel: formatOrderItemsLabel(o.order_items),
        total: Number(o.total || 0),
      }),
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

async function customerNamesByOrder(db: SalesDb, rows: { id: string; customer_id: string | null; catatan?: string | null }[]) {
  const ids = [...new Set(rows.map((o) => o.customer_id).filter(Boolean))] as string[];
  const map = new Map<string, string>();
  if (ids.length) {
    const { data } = await db.from("module_crm_customers").select("id, nama").in("id", ids);
    const byId = Object.fromEntries((data || []).map((c) => [c.id, String(c.nama || "").trim()]));
    for (const o of rows) {
      const named = (o.customer_id && byId[o.customer_id]) || customerNameFromNote(o.catatan);
      if (named) map.set(o.id, named);
    }
  } else {
    for (const o of rows) {
      const named = customerNameFromNote(o.catatan);
      if (named) map.set(o.id, named);
    }
  }
  return map;
}

async function orderCustomerName(
  db: SalesDb,
  actor: Actor,
  order: { customer_id: string | null; catatan?: string | null },
) {
  if (order.customer_id) {
    try {
      const customer = await getCustomer(db, actor, order.customer_id);
      if (customer.nama?.trim()) return customer.nama.trim();
    } catch {
      /* fall through to note */
    }
  }
  return customerNameFromNote(order.catatan) || "Tanpa nama";
}

async function sendBriefing(db: SalesDb, actor: Actor, chatId: number, query?: string, kind?: string, from?: string, to?: string) {
  const period = (from && to ? "custom" : kind || "this_month") as ReportKind;
  let salesId: string | undefined;
  let focusName: string | undefined;
  if (query?.trim() && !extractStaffQuery(`omzet ${query}`)) query = undefined;
  if (query?.trim()) {
    const staff = await listStaff(db, actor);
    const q = query.trim().toLowerCase();
    const hit = staff.find((s) => s.nama.toLowerCase() === q) || staff.find((s) => s.nama.toLowerCase().includes(q));
    if (!hit) {
      await sendMessage(chatId, `Sales "${query}" tidak ada di tim.\nKetik tim untuk daftar.`);
      return;
    }
    salesId = hit.id;
    focusName = hit.nama;
  }
  const report = await buildSalesReport(db, actor, { kind: period, from, to, salesId });
  await sendMessage(chatId, formatSalesBriefing(report, focusName), mainMenuKeyboard(actor));
}

async function sendRekap(db: SalesDb, actor: Actor, chatId: number, kind: ReportKind, from?: string, to?: string) {
  const report = await buildSalesReport(db, actor, { kind, from, to });
  const products = report.byProduct.map((p) => `${p.name}:\n${p.qty} pcs`).join("\n\n");
  const showTeam = report.scope !== "self";
  const top = showTeam
    ? report.ranking
        .slice(0, 5)
        .map((s, i) => `${i + 1}. ${s.nama} — ${s.qty} pcs`)
        .join("\n")
    : "";
  const served = showTeam ? servedByLabel(report.servedBy) : "";
  const rankBlock = showTeam && report.ranking.length
    ? ["", "TOP SALES", top, "================================"]
    : [];
  const servedBlock = served ? ["", served, "================================"] : [];
  await sendMessage(
    chatId,
    [
      "================================",
      report.scope === "self" ? "REKAP KAMU" : report.scope === "team" ? "REKAP TIM" : "REKAP PENJUALAN HENIMA",
      report.scopeLabel,
      report.range.label,
      "",
      `Total transaksi:\n${report.totalOrders}`,
      "",
      `Total pcs:\n${report.totalQty}`,
      "",
      products,
      "",
      `Omzet penjualan:\n${fmtRp(report.totalRevenue)}`,
      report.opexTotal
        ? `\nHPP:\n${fmtRp(report.hppTotal || 0)}\n\nLaba kotor:\n${fmtRp(report.grossProfit ?? (report.profitTotal || 0) + report.opexTotal)}\n\nBiaya operasional:\n${fmtRp(report.opexTotal)}\n\nLaba bersih:\n${fmtRp(report.profitTotal || 0)}\n================================`
        : `\nOmzet:\n${fmtRp(report.totalRevenue)}\n================================`,
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

async function sendPdf(db: SalesDb, actor: Actor, chatId: number, kind: ReportKind, from?: string, to?: string) {
  try {
    const report = await buildSalesReport(db, actor, { kind, from, to });
    const bytes = await buildSalesReportPdf({
      businessName: actor.businessName,
      generatedAt: todayWib(),
      report,
    });
    await sendDocument(
      chatId,
      `henima-rekap-${report.range.from}-${report.range.to}.pdf`,
      bytes,
      `${report.scopeLabel} · ${report.range.label}: ${report.totalQty} pcs · omzet ${fmtRp(report.totalRevenue)} · laba ${fmtRp(report.profitTotal || 0)}`,
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
