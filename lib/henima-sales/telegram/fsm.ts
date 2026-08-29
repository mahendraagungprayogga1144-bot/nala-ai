import { randomUUID } from "crypto";
import { todayWib } from "../../../lib/date";
import { fmtDateLongId, fmtRp } from "../money";
import { displayPhone } from "../phone";
import { calculateOrderTotal } from "../types";
import type { Actor, ProductRow } from "../types";
import type { BotEffect, BotReply, BotState, Draft, Session } from "./session";
import { formatConfirm, HELP_TEXT, kb, newDraft } from "./session";

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
        reply(
          `Telegram Account: CONNECTED\nSales: ${actor.nama}\nRole: ${actor.role}\nBisnis: ${actor.businessName}\n\nKetik /input untuk catat penjualan. /help untuk daftar perintah.`,
        ),
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
      return {
        session: go(session, "input_qty", {
          ...session.draft,
          productId,
          productName: product.name,
          suggestedPrice: product.price ?? undefined,
        }),
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
      case "input_phone":
      case "followup_phone":
        return { session: go(session, session.state, { ...session.draft, phone: text }), effects: [reply("Memeriksa customer…")] };
      case "input_new_name":
        if (!text) return { session, effects: [reply("Nama customer wajib.")] };
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
      default:
        return { session, effects: [reply("Ketik /help untuk melihat perintah.")] };
    }
  }

  return { session, effects: [{ type: "noop" }] };
}

function productPrompt(products: ProductRow[]): BotEffect {
  if (!products.length) {
    return reply("Belum ada produk. Minta founder menambahkan Afternoon / The Distance di Inventory.");
  }
  const rows = products.slice(0, 10).map((p) => [{ text: p.name, data: `p:${p.id}` }]);
  return reply("Pilih produk:", kb(rows));
}

function confirmEffects(session: Session, actor: Actor, draft: Draft): { session: Session; effects: BotEffect[] } {
  const dateLabel = fmtDateLongId(todayWib());
  return {
    session: go(session, "input_confirm", draft),
    effects: [
      reply(
        formatConfirm(draft, actor, dateLabel),
        kb([
          [{ text: "CONFIRM", data: "confirm_yes" }],
          [{ text: "EDIT", data: "confirm_edit" }, { text: "CANCEL", data: "confirm_cancel" }],
        ]),
      ),
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
