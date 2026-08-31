import { randomUUID } from "crypto";
import { todayWib } from "../../../lib/date";
import { fmtDateLongId, fmtRp } from "../money";
import { displayPhone } from "../phone";
import { calculateOrderTotal } from "../types";
import type { Actor, ProductRow } from "../types";
import type { BotEffect, BotReply, BotState, Draft, Session } from "./session";
import { formatConfirm, HELP_TEXT, UNLINKED_MSG, applyCatalogPricing, applyLinesToDraft, connectedStatusText, kb, newDraft } from "./session";
import {
  buildPackLines,
  defaultPackProducts,
  looksLikePack,
  matchAllProducts,
  parseOpsIntent,
  parsePaymentMethod,
  parseSalesChat,
  resolvePackProducts,
} from "./nl-sale";

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
      return { session: { state: "idle", draft: newDraft() }, effects: [reply(UNLINKED_MSG)] };
    }
    return {
      session: { state: "idle", draft: newDraft() },
      effects: [
        reply(connectedStatusText(actor)),
      ],
    };
  }

  if (!actor) {
    return { session, effects: [reply(UNLINKED_MSG)] };
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
              [{ text: "BULAN INI (PDF)", data: "pdf:this_month" }, { text: "BULAN LALU (PDF)", data: "pdf:last_month" }],
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
              [{ text: "BULAN INI", data: "pdf:this_month" }, { text: "BULAN LALU", data: "pdf:last_month" }],
            ])),
          ],
        };
      case "/nota":
        return {
          session: go(session, "idle"),
          effects: [{ type: "send_nota", query: incoming.arg?.trim() || undefined }],
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
    if (data.startsWith("nota:")) {
      return { session: go(session, "idle"), effects: [{ type: "send_nota", orderId: data.slice(5) }] };
    }
    if (data.startsWith("p:")) {
      const productId = data.slice(2);
      if (productId === "ALL") {
        const pack = defaultPackProducts(world.products);
        if (pack.length < 2) return { session, effects: [reply("Paket butuh 2 produk di katalog.")] };
        return finishProductPick(session, actor, pack, true, world.products);
      }
      const product = world.products.find((p) => p.id === productId);
      if (!product) return { session, effects: [reply("Produk tidak valid.")] };
      return finishProductPick(session, actor, [product], false, world.products);
    }
    if (data.startsWith("pm:")) {
      const method = data.slice(3) as Draft["paymentMethod"];
      const ready = applyCatalogPricing({
        ...session.draft,
        paymentMethod: method,
        paymentStatus: session.draft.paymentStatus || "PAID",
      }, world.products);
      if (ready.nlChat) {
        return { session: go(session, "input_confirm", ready), effects: [{ type: "confirm_sale" }] };
      }
      return {
        session: go(session, "input_pay_status", ready),
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
      case "input_new_name": {
        if (!text) return { session, effects: [reply("Nama customer wajib.")] };
        const asSale = parseSalesChat(text, world.products);
        const extracted = asSale.customerName || (!asSale.looksLikeSale ? text : null);
        if (!extracted) {
          return { session, effects: [reply("Nama customer? Contoh: Nala (jangan tempel chat penjualan).")] };
        }
        const named = {
          ...session.draft,
          customerName: extracted,
          paymentMethod: session.draft.paymentMethod || asSale.paymentMethod || undefined,
          phone: session.draft.phone || asSale.phone || undefined,
        };
        if (session.draft.nlChat) {
          if ((named.lines?.length || named.productId) && named.quantity && named.unitPrice != null) {
            return saleReady(session, actor, named, world.products);
          }
          return {
            session: go(session, "input_product", named),
            effects: [productPrompt(world.products)],
          };
        }
        return {
          session: go(session, "input_new_city", named),
          effects: [reply("Kota customer? (ketik - untuk skip)")],
        };
      }
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
      case "input_product": {
        const lower = text.toLowerCase();
        const matched = matchAllProducts(lower, world.products);
        const asPack = looksLikePack(lower) || matched.length > 1;
        if (asPack || matched.length >= 2) {
          const pack = resolvePackProducts(matched, world.products);
          if (pack.length < 2) {
            return { session, effects: [reply("Ketik nama 2 produk, contoh: afternoon dan the distance")] };
          }
          return finishProductPick(session, actor, pack, true, world.products);
        }
        if (matched.length === 1) {
          return finishProductPick(session, actor, matched, false, world.products);
        }
        return {
          session,
          effects: [reply("Ketik nama produk, contoh: afternoon dan the distance", productKeyboard(world.products))],
        };
      }
      case "input_qty": {
        const quantity = Number(text.replace(",", "."));
        if (!(quantity > 0)) return { session, effects: [reply("Jumlah harus lebih dari 0.")] };
        if ((session.draft.packProductIds?.length || 0) >= 2) {
          const pack = world.products.filter((p) => session.draft.packProductIds?.includes(p.id));
          const draft = { ...session.draft, packQty: quantity, quantity: quantity * Math.max(pack.length, 2) };
          const catalogTotal = pack.reduce((sum, p) => sum + (p.price || 0) * quantity, 0);
          const total = session.draft.orderTotal ?? session.draft.unitPrice ?? (catalogTotal > 0 ? catalogTotal : undefined);
          if (total != null && pack.length >= 2) {
            const lined = applyLinesToDraft(draft, buildPackLines(pack, quantity, total));
            return saleReady(session, actor, lined, world.products);
          }
          return {
            session: go(session, "input_price", draft),
            effects: [reply("Masukkan harga paket (total 2 produk).")],
          };
        }
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
          calculateOrderTotal(session.draft.quantity || 1, unitPrice, 0);
        } catch {
          return { session, effects: [reply("Harga tidak valid.")] };
        }
        if ((session.draft.packProductIds?.length || 0) >= 2) {
          const pack = world.products.filter((p) => session.draft.packProductIds?.includes(p.id));
          if (pack.length >= 2) {
            const qty = session.draft.packQty || session.draft.lines?.[0]?.quantity || 1;
            const draft = applyLinesToDraft(session.draft, buildPackLines(pack, qty, unitPrice));
            return saleReady(session, actor, draft, world.products);
          }
        }
        return saleReady(session, actor, { ...session.draft, unitPrice }, world.products);
      }
      case "input_pay_method": {
        const method = parsePaymentMethod(text);
        if (!method) {
          return { session, effects: [reply("Ketik tf, qris, cash, atau pilih tombol.", kb(paymentKeyboard()))] };
        }
        const ready = applyCatalogPricing({
          ...session.draft,
          paymentMethod: method,
          paymentStatus: session.draft.paymentStatus || "PAID",
        }, world.products);
        if (ready.nlChat) {
          return { session: go(session, "input_confirm", ready), effects: [{ type: "confirm_sale" }] };
        }
        return {
          session: go(session, "input_pay_status", ready),
          effects: [
            reply("Status pembayaran:", kb([
              [{ text: "PAID", data: "ps:PAID" }, { text: "PENDING", data: "ps:PENDING" }],
              [{ text: "CANCELLED", data: "ps:CANCELLED" }],
            ])),
          ],
        };
      }
      case "followup_date":
        return {
          session: go(session, "followup_notes", { ...session.draft, followupDate: text }),
          effects: [reply("Catatan follow-up?")],
        };
      case "pdf_pick":
      case "rekap_pick": {
        const ops = parseOpsIntent(`${session.state === "pdf_pick" ? "pdf " : "rekap "}${text}`);
        if (ops.type === "pdf") {
          return { session: go(session, "idle"), effects: [{ type: "send_pdf", kind: ops.period }] };
        }
        if (ops.type === "rekap") {
          return { session: go(session, "idle"), effects: [{ type: "send_report", kind: ops.period }] };
        }
        return {
          session,
          effects: [reply("Ketik harian, mingguan, atau bulan ini.")],
        };
      }
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
  "Kirim chat penjualan, contoh:\nlaku 1 harga 150rb atas nama Regan no 0877... tf\nlaku 1 harga 199rb diskon 50rb atas nama Sinta no 08... qris\nMetode bayar: tf / qris / cash / lainnya\nAtau: rekapan hari ini · pdf bulan ini · nota regan · riwayat · target · /help";

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
  if (ops.type === "nota") {
    return { session: idle, effects: [{ type: "send_nota", query: ops.query }] };
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
  if (!productId && !parsed.isPack && products.length === 1) {
    productId = products[0].id;
    productName = products[0].name;
    unitPrice = unitPrice ?? products[0].price ?? undefined;
  } else if (productId && unitPrice == null && !parsed.isPack) {
    const p = products.find((x) => x.id === productId);
    unitPrice = p?.price ?? undefined;
  }

  let draft: Draft = {
    ...newDraft(),
    idempotencyKey: randomUUID(),
    phone: parsed.phone || undefined,
    customerName: parsed.customerName || undefined,
    quantity,
    unitPrice,
    productId,
    productName,
    discount: parsed.discount || undefined,
    discountPercent: parsed.discountPercent || undefined,
    paymentMethod: parsed.paymentMethod || undefined,
    paymentStatus: "PAID",
    nlChat: true,
  };

  if (parsed.isPack || parsed.matchedProducts.length > 1) {
    const pack = resolvePackProducts(parsed.matchedProducts, products);
    if (pack.length >= 2) {
      const packQty = quantity || 1;
      const catalogTotal = pack.reduce((sum, p) => sum + (p.price || 0) * packQty, 0);
      const total = parsed.unitPrice ?? (catalogTotal > 0 ? catalogTotal : undefined);
      draft.packProductIds = pack.map((p) => p.id);
      draft.packQty = packQty;
      draft.quantity = packQty * pack.length;
      draft.productName = pack.map((p) => p.name).join(" + ");
      if (total != null) {
        draft = applyLinesToDraft(draft, buildPackLines(pack, packQty, total));
      }
    }
  }

  draft = applyCatalogPricing(draft, products);

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

function finishProductPick(
  session: Session,
  actor: Actor,
  picked: ProductRow[],
  asPack: boolean,
  products: ProductRow[],
): { session: Session; effects: BotEffect[] } {
  if (asPack && picked.length >= 2) {
    const packQty = session.draft.packQty || session.draft.lines?.[0]?.quantity || undefined;
    let draft: Draft = {
      ...session.draft,
      packProductIds: picked.map((p) => p.id),
      productName: picked.map((p) => p.name).join(" + "),
    };
    if (!packQty) {
      return {
        session: go(session, "input_qty", draft),
        effects: [reply(`Paket: ${picked.map((p) => p.name).join(" + ")}\nBerapa jumlah paket?`)],
      };
    }
    const catalogTotal = picked.reduce((sum, p) => sum + (p.price || 0) * packQty, 0);
    const total = session.draft.orderTotal ?? session.draft.unitPrice ?? (catalogTotal > 0 ? catalogTotal : undefined);
    draft = { ...draft, packQty, quantity: packQty * picked.length };
    if (total != null) {
      draft = applyLinesToDraft(draft, buildPackLines(picked, packQty, total));
      return saleReady(session, actor, draft, products);
    }
    return {
      session: go(session, "input_price", draft),
      effects: [reply("Masukkan harga paket (total 2 produk).")],
    };
  }

  const product = picked[0];
  const draft = {
    ...session.draft,
    productId: product.id,
    productName: product.name,
    suggestedPrice: product.price ?? undefined,
    unitPrice: session.draft.unitPrice ?? product.price ?? undefined,
    lines: undefined,
    packProductIds: undefined,
    orderTotal: undefined,
  };
  if (draft.quantity && draft.unitPrice != null) {
    return saleReady(session, actor, draft, products);
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

export function paymentKeyboard(): { text: string; data: string }[][] {
  return [
    [{ text: "TRANSFER / TF", data: "pm:TRANSFER" }, { text: "QRIS", data: "pm:QRIS" }],
    [{ text: "CASH", data: "pm:CASH" }, { text: "LAINNYA", data: "pm:OTHER" }],
  ];
}

function payPrompt(): BotEffect {
  return reply("Metode pembayaran?\nKetik tf / qris / cash atau pilih tombol.", kb(paymentKeyboard()));
}

function saleReady(session: Session, actor: Actor, draft: Draft, products: ProductRow[]): { session: Session; effects: BotEffect[] } {
  const ready: Draft = {
    ...applyCatalogPricing(draft, products),
    paymentStatus: draft.paymentStatus || "PAID",
  };
  if (!ready.paymentMethod) {
    return {
      session: go(session, "input_pay_method", ready),
      effects: [payPrompt()],
    };
  }
  if (ready.nlChat) {
    return { session: go(session, "input_confirm", ready), effects: [{ type: "confirm_sale" }] };
  }
  return confirmEffects(session, actor, ready);
}

export function productKeyboard(products: ProductRow[]): { text: string; data: string }[][] {
  const rows = products.slice(0, 10).map((p) => [{ text: p.name, data: `p:${p.id}` }]);
  if (products.length >= 2) {
    rows.push([{ text: "KEDUANYA (PAKET)", data: "p:ALL" }]);
  }
  return rows;
}

function productPrompt(products: ProductRow[]): BotEffect {
  if (!products.length) {
    return reply("Belum ada produk parfum. Founder menambah Afternoon / The Distance di Henima Sales → Settings.");
  }
  return reply("Pilih produk (atau ketik afternoon dan the distance):", kb(productKeyboard(products)));
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
