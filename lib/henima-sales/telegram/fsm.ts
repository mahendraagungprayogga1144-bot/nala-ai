import { randomUUID } from "crypto";
import { todayWib } from "../../../lib/date";
import { fmtDateLongId, fmtRp } from "../money";
import { displayPhone } from "../phone";
import { calculateOrderTotal } from "../types";
import type { Actor, ProductRow } from "../types";
import type { BotEffect, BotReply, BotState, Draft, Session } from "./session";
import { formatConfirm, HELP_TEXT, connectedStatusText, kb, newDraft } from "./session";
import { parseOpsIntent, parseSalesChat } from "./nl-sale";

export type World = {
  actor: Actor | null;
  products: ProductRow[];
};

export type Incoming =
  | { kind: "command"; cmd: string; arg?: string }
  | { kind: "text"; text: string }
  | { kind: "callback"; data: string }
  | { kind: "photo"; fileId: string; caption?: string };

function reply(text: string, keyboard?: BotReply["keyboard"]): BotEffect {
  return { type: "reply", reply: { text, keyboard } };
}

function go(session: Session, state: BotState, draft?: Draft): Session {
  return { state, draft: draft ?? session.draft };
}

export function reduceBot(session: Session, incoming: Incoming, world: World): { session: Session; effects: BotEffect[] } {
  const actor = world.actor;

  if (incoming.kind === "command" && incoming.cmd === "/start") {
    const arg = (incoming.arg || "").trim();
    if (arg) return { session, effects: [{ type: "link_invite", code: arg }] };
    if (!actor) {
      return { session: { state: "idle", draft: newDraft() }, effects: [reply("Telegram Anda belum terdaftar. Hubungi admin Henima.")] };
    }
    return {
      session: { state: "idle", draft: newDraft() },
      effects: [
        reply(connectedStatusText(actor)),
      ],
    };
  }

  if (!actor) {
    return { session, effects: [reply("Telegram Anda belum terdaftar. Hubungi admin Henima.")] };
  }

  if (incoming.kind === "command") {
    switch (incoming.cmd) {
      case "/help":
        return { session: { state: "idle", draft: newDraft() }, effects: [reply(HELP_TEXT)] };
      case "/input":
        return {
          session: { state: "input_phone", draft: { ...newDraft(), idempotencyKey: randomUUID() } },
          effects: [reply("Masukkan nomor WhatsApp customer.")],
        };
      case "/riwayat":
        return { session: go(session, "riwayat"), effects: [reply("Memuat riwayat…")] };
      case "/customer":
        return {
          session: go(session, "customer_query", newDraft()),
          effects: [reply("Ketik nama atau nomor WhatsApp customer.")],
        };
      case "/rekap":
        return {
          session: go(session, "rekap_pick"),
          effects: [
            reply("Pilih periode rekap:", kb([
              [{ text: "HARI INI", data: "rk:today" }, { text: "MINGGU INI", data: "rk:this_week" }],
              [{ text: "BULAN INI", data: "rk:this_month" }, { text: "CUSTOM", data: "rk:custom" }],
            ])),
          ],
        };
      case "/target":
        return { session: go(session, "idle"), effects: [reply("Memuat target…")] };
      case "/followup":
        return {
          session: go(session, "followup_phone", newDraft()),
          effects: [reply("Masukkan nomor WhatsApp customer untuk follow-up.")],
        };
      case "/pdf":
        return {
          session: go(session, "pdf_pick"),
          effects: [
            reply("Pilih laporan PDF:", kb([
              [{ text: "HARIAN", data: "pdf:today" }, { text: "MINGGUAN", data: "pdf:this_week" }],
              [{ text: "BULANAN", data: "pdf:this_month" }, { text: "CUSTOM", data: "pdf:custom" }],
            ])),
          ],
        };
      default:
        return { session, effects: [reply("Perintah tidak dikenali. Ketik /help.")] };
    }
  }

  if (incoming.kind === "callback") {
    const data = incoming.data;
    if (data.startsWith("rk:")) {
      const kind = data.slice(3);
      return { session: go(session, "idle"), effects: [{ type: "send_report", kind }] };
    }
    if (data.startsWith("pdf:")) {
      const kind = data.slice(4);
      return { session: go(session, "idle"), effects: [{ type: "send_pdf", kind }] };
    }
    if (data.startsWith("p:")) {
      const productId = data.slice(2);
      const product = world.products.find((p) => p.id === productId);
      if (!product) return { session, effects: [reply("Produk tidak valid.")] };
      const draft = {
        ...session.draft,
        productId,
        productName: product.name,
        suggestedPrice: product.price ?? undefined,
        unitPrice: session.draft.unitPrice ?? product.price ?? undefined,
      };
      if (draft.quantity && draft.unitPrice != null) {
        const ready = {
          ...draft,
          paymentMethod: draft.paymentMethod || "OTHER",
          paymentStatus: draft.paymentStatus || "PAID",
        };
        if (session.draft.nlChat) {
          return { session: go(session, "input_confirm", ready), effects: [{ type: "confirm_sale" }] };
        }
        return confirmEffects(session, actor, ready);
      }
      if (draft.quantity) {
        return {
          session: go(session, "input_price", draft),
          effects: [
            reply(
              product.price
                ? `Masukkan harga jual per botol.\nHarga produk: ${fmtRp(product.price)}`
                : "Masukkan harga jual per botol.",
            ),
          ],
        };
      }
      return {
        session: go(session, "input_qty", draft),
        effects: [reply(`Produk: ${product.name}\nBerapa jumlah botol?`)],
      };
    }
    if (data.startsWith("pm:")) {
      const method = data.slice(3) as Draft["paymentMethod"];
      return {
        session: go(session, "input_pay_status", { ...session.draft, paymentMethod: method }),
        effects: [
          reply("Status pembayaran:", kb([
            [{ text: "PAID", data: "ps:PAID" }, { text: "PENDING", data: "ps:PENDING" }],
            [{ text: "CANCELLED", data: "ps:CANCELLED" }],
          ])),
        ],
      };
    }
    if (data.startsWith("ps:")) {
      return {
        session: go(session, "input_testimonial", { ...session.draft, paymentStatus: data.slice(3) as Draft["paymentStatus"] }),
        effects: [
          reply("Upload foto testimoni customer jika ada.", kb([[{ text: "Lewati", data: "skip_photo" }]])),
        ],
      };
    }
    if (data === "skip_photo") {
      const d = { ...session.draft, photoFileId: undefined };
      return confirmEffects(session, actor, d);
    }
    if (data === "confirm_yes") {
      return { session: go(session, "idle"), effects: [{ type: "confirm_sale" }] };
    }
    if (data === "confirm_edit") {
      return {
        session: go(session, "input_phone", { ...session.draft, idempotencyKey: session.draft.idempotencyKey || randomUUID() }),
        effects: [reply("Edit: masukkan ulang nomor WhatsApp customer.")],
      };
    }
    if (data === "confirm_cancel") {
      return { session: { state: "idle", draft: newDraft() }, effects: [reply("Dibatalkan.")] };
    }
    if (data.startsWith("od:")) {
      return { session: go(session, "riwayat", { ...session.draft, orderId: data.slice(3) }), effects: [reply("Memuat detail…")] };
    }
    if (data.startsWith("del:")) {
      return {
        session: go(session, "delete_confirm", { ...session.draft, orderId: data.slice(4) }),
        effects: [
          reply("Yakin ingin menghapus transaksi?", kb([
            [{ text: "YES DELETE", data: "del_yes" }, { text: "CANCEL", data: "confirm_cancel" }],
          ])),
        ],
      };
    }
    if (data === "del_yes" && session.draft.orderId) {
      return { session: go(session, "idle"), effects: [{ type: "delete_order", orderId: session.draft.orderId }] };
    }
    return { session, effects: [{ type: "noop" }] };
  }

  if (incoming.kind === "photo" && session.state === "input_testimonial") {
    const d = { ...session.draft, photoFileId: incoming.fileId, photoCaption: incoming.caption };
    return confirmEffects(session, actor, d);
  }

  if (incoming.kind === "text") {
    const text = incoming.text.trim();
    switch (session.state) {
      case "input_phone": {
        const asSale = parseSalesChat(text, world.products);
        if (asSale.looksLikeSale) return applyNaturalSale(session, actor, text, world.products);
        return { session: go(session, "input_phone", { ...session.draft, phone: text }), effects: [reply("Memeriksa customer…")] };
      }
      case "followup_phone":
        return { session: go(session, session.state, { ...session.draft, phone: text }), effects: [reply("Memeriksa customer…")] };
      case "input_new_name":
        if (!text) return { session, effects: [reply("Nama customer wajib.")] };
        if (session.draft.nlChat) {
          const named = { ...session.draft, customerName: text };
          if (named.productId && named.quantity && named.unitPrice != null) {
            return { session: go(session, "input_confirm", named), effects: [{ type: "confirm_sale" }] };
          }
          return {
            session: go(session, "input_product", named),
            effects: [productPrompt(world.products)],
          };
        }
        return {
          session: go(session, "input_new_city", { ...session.draft, customerName: text }),
          effects: [reply("Kota customer? (ketik - untuk skip)")],
        };
      case "input_new_city":
        return {
          session: go(session, "input_new_notes", { ...session.draft, city: text === "-" ? "" : text }),
          effects: [reply("Catatan? (ketik - untuk skip)")],
        };
      case "input_new_notes":
        return {
          session: go(session, "input_product", { ...session.draft, notes: text === "-" ? "" : text }),
          effects: [productPrompt(world.products)],
        };
      case "input_qty": {
        const quantity = Number(text.replace(",", "."));
        if (!(quantity > 0)) return { session, effects: [reply("Jumlah harus lebih dari 0.")] };
        const suggested = session.draft.suggestedPrice;
        return {
          session: go(session, "input_price", { ...session.draft, quantity }),
          effects: [
            reply(
              suggested
                ? `Masukkan harga jual per botol.\nHarga produk: ${fmtRp(suggested)}`
                : "Masukkan harga jual per botol.",
            ),
          ],
        };
      }
      case "input_price": {
        const unitPrice = Number(text.replace(/[^\d]/g, ""));
        try {
          calculateOrderTotal(session.draft.quantity || 0, unitPrice, 0);
        } catch {
          return { session, effects: [reply("Harga tidak valid.")] };
        }
        return {
          session: go(session, "input_pay_method", { ...session.draft, unitPrice }),
          effects: [
            reply("Pilih metode pembayaran.", kb([
              [{ text: "CASH", data: "pm:CASH" }, { text: "TRANSFER", data: "pm:TRANSFER" }],
              [{ text: "QRIS", data: "pm:QRIS" }, { text: "OTHER", data: "pm:OTHER" }],
            ])),
          ],
        };
      }
      case "followup_date":
        return {
          session: go(session, "followup_notes", { ...session.draft, followupDate: text }),
          effects: [reply("Catatan follow-up?")],
        };
      case "customer_query":
        return { session: go(session, "idle", { ...session.draft, phone: text }), effects: [reply("Mencari customer…")] };
      case "idle":
      default: {
        if (session.state !== "idle" && session.state !== "input_confirm") {
          return { session, effects: [reply("Ketik /help untuk melihat perintah.")] };
        }
        return applyNaturalChat(session, actor, text, world.products);
      }
    }
  }

  return { session, effects: [{ type: "noop" }] };
}

const CHAT_HINT =
  "Kirim chat penjualan, contoh:\nlaku 1 harga 150rb atas nama Regan no 0877...\n\nAtau: rekapan hari ini · riwayat · target · /help";

function applyNaturalChat(
  session: Session,
  actor: Actor,
  text: string,
  products: ProductRow[],
): { session: Session; effects: BotEffect[] } {
  const ops = parseOpsIntent(text);
  const idle = { state: "idle" as const, draft: newDraft() };
  if (ops.type === "help") {
    return { session: idle, effects: [reply(HELP_TEXT)] };
  }
  if (ops.type === "rekap") {
    return { session: idle, effects: [{ type: "send_report", kind: ops.period }] };
  }
  if (ops.type === "pdf") {
    return { session: idle, effects: [{ type: "send_pdf", kind: ops.period }] };
  }
  if (ops.type === "riwayat") {
    return { session: idle, effects: [{ type: "send_riwayat" }] };
  }
  if (ops.type === "target") {
    return { session: idle, effects: [{ type: "send_target" }] };
  }
  return applyNaturalSale(session, actor, text, products);
}

function applyNaturalSale(
  session: Session,
  _actor: Actor,
  text: string,
  products: ProductRow[],
): { session: Session; effects: BotEffect[] } {
  const parsed = parseSalesChat(text, products);
  if (!parsed.looksLikeSale) {
    return { session: { state: "idle", draft: newDraft() }, effects: [reply(CHAT_HINT)] };
  }

  const quantity = parsed.quantity || (parsed.unitPrice ? 1 : undefined);
  let productId = parsed.productId || undefined;
  let productName = parsed.productName || undefined;
  let unitPrice = parsed.unitPrice ?? undefined;
  if (!productId && products.length === 1) {
    productId = products[0].id;
    productName = products[0].name;
    unitPrice = unitPrice ?? products[0].price ?? undefined;
  } else if (productId && unitPrice == null) {
    const p = products.find((x) => x.id === productId);
    unitPrice = p?.price ?? undefined;
  }

  const draft: Draft = {
    ...newDraft(),
    idempotencyKey: randomUUID(),
    phone: parsed.phone || undefined,
    customerName: parsed.customerName || undefined,
    quantity,
    unitPrice,
    productId,
    productName,
    paymentMethod: parsed.paymentMethod || "OTHER",
    paymentStatus: "PAID",
    nlChat: true,
  };

  if (!draft.phone) {
    return {
      session: go(session, "input_phone", draft),
      effects: [reply("Nomor WhatsApp customer?")],
    };
  }
  return {
    session: go(session, "input_phone", draft),
    effects: [reply("Membaca chat penjualan…")],
  };
}

function productPrompt(products: ProductRow[]): BotEffect {
  if (!products.length) {
    return reply("Belum ada produk parfum. Founder menambah Afternoon / The Distance di Henima Sales → Settings.");
  }
  const rows = products.slice(0, 10).map((p) => [{ text: p.name, data: `p:${p.id}` }]);
  return reply("Pilih produk:", kb(rows));
}

export function confirmKeyboard(): { text: string; data: string }[][] {
  return [
    [{ text: "CONFIRM", data: "confirm_yes" }],
    [{ text: "EDIT", data: "confirm_edit" }, { text: "CANCEL", data: "confirm_cancel" }],
  ];
}

function confirmEffects(session: Session, actor: Actor, draft: Draft): { session: Session; effects: BotEffect[] } {
  const dateLabel = fmtDateLongId(todayWib());
  return {
    session: go(session, "input_confirm", draft),
    effects: [
      reply(formatConfirm(draft, actor, dateLabel), confirmKeyboard()),
    ],
  };
}

export function customerFoundText(opts: {
  nama: string;
  phone: string | null;
  totalSpent: number;
  lastPurchase: string | null;
}) {
  return [
    "Customer ditemukan.",
    "",
    `Nama: ${opts.nama}`,
    `Nomor: ${displayPhone(opts.phone)}`,
    `Total pembelian: ${fmtRp(opts.totalSpent)}`,
    `Pembelian terakhir: ${opts.lastPurchase ? fmtDateLongId(opts.lastPurchase) : "—"}`,
  ].join("\n");
}

export { productPrompt };
