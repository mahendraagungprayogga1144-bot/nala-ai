/** Teks panduan yang founder share ke sales + yang bot kirim. */

export const DEFAULT_SALES_BOT = "henimaofficial_bot";

export function salesBotHandle(username?: string | null) {
  const raw = (username || DEFAULT_SALES_BOT).trim().replace(/^@/, "");
  return raw || DEFAULT_SALES_BOT;
}

/** Pesan WhatsApp/Telegram yang di-copy founder ke sales. */
export function salesInviteShareText(opts: {
  staffName: string;
  code: string;
  brandName: string;
  botUsername?: string | null;
}) {
  const bot = salesBotHandle(opts.botUsername);
  const code = opts.code.trim().toUpperCase();
  const nama = opts.staffName.trim() || "Sales";
  const brand = opts.brandName.trim() || "Henima Sales";
  return `Halo ${nama},

Ini akun sales *${brand}*. Ikuti 3 langkah ini:

1. Buka Telegram, cari @${bot}
2. Ketik persis (ada spasi):
/start ${code}
3. Tunggu bot bilang CONNECTED

Habis CONNECTED, catat penjualan dengan chat biasa, contoh:
laku 1 harga 150rb atas nama Regan no 087712345678 tf

Paket 2 produk (Afternoon + The Distance):
laku 2 paket new member harga 250k atas nama Dimas no 08xxxxxxxxxx qris

Metode bayar: ketik tf / qris / cash / lainnya (bot juga tanya kalau belum disebutkan)

Bisa juga ketik: afternoon dan the distance

Cek hasil kapan saja:
rekapan hari ini
riwayat
nota regan
target

Jangan kirim kode ini ke orang lain. Kalau gagal, minta founder kode baru.`;
}

export const UNLINKED_MSG = `Telegram Anda belum terdaftar.

Minta kode undangan ke founder, lalu ketik:
/start KODE

Contoh: /start 43E33258

Satu kode hanya untuk 1 orang.`;

export function salesHowToText() {
  return `Cara pakai (jangan bingung):

CATAT PENJUALAN — ketik seperti chat biasa:
laku 1 harga 150rb atas nama NamaCustomer no 08xxxxxxxxxx tf

Paket 2 produk (Afternoon + The Distance) cukup satu chat:
laku 2 paket new member harga 250k atas nama NamaCustomer no 08xxxxxxxxxx qris
atau ketik: afternoon dan the distance

Metode bayar: tf (transfer), qris, cash, atau lainnya. Kalau belum disebut, bot tanya dulu.

CEK HASIL:
rekapan hari ini
rekap minggu ini
riwayat
nota (invoice customer, contoh: nota regan)
target

Masih bisa pakai /input /help kalau perlu.`;
}
