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
  return `Yth. ${nama},

Selamat bergabung di tim penjualan ${brand}.

PROSEDUR AKTIVASI
1. Buka Telegram di akun pribadi Anda (bukan akun manajemen).
2. Cari @${bot}
3. Kirim persis:
/start ${code}
4. Tunggu konfirmasi CONNECTED

Kode ini rahasia, satu orang, satu Telegram.

SETELAH CONNECTED
Ketik santai, contoh:
laku 1 afternoon 130rb atas nama Regan no 087712345678 tf

Retail katalog Rp199.999. Tulis harga yang dibayar; diskon dihitung otomatis.
Paket: laku 2 paket new member harga 250k atas nama Dimas no 08… qris
Bayar: tf / qris / cash

Cek kerja: rekapan hari ini · riwayat · nota · target · /menu

Jika gagal, minta manajemen terbitkan kode baru.`;
}

export const UNLINKED_MSG = `Akun Telegram Anda belum terdaftar.

Minta kode 8 karakter ke manajemen, lalu kirim persis (ganti angkanya, jangan ketik kata KODE):
/start 43E33258

Satu kode, satu orang. Sales wajib /start di Telegram mereka sendiri — bukan akun manajemen.`;

export function salesHowToText() {
  return `HENIMA SALES — cara kerja singkat

CATAT PENJUALAN (satu pesan, bahasa bebas)
laku 1 afternoon 130rb atas nama NamaCustomer no 08xxxxxxxxxx tf
sold 2 the distance 250k for Dimas phone 08xxxxxxxxxx cash

Retail Rp199.999. Tulis yang dibayar pelanggan. Diskon otomatis.
Paket: laku 2 paket new member harga 250k atas nama Dimas no 08… qris
Bayar: tf / qris / cash

LAPORAN
rekapan hari ini · pdf bulan ini · nota nama · riwayat · target

BIAYA (potong laba, bukan omzet)
pengeluaran 100rb buat bensin

MANAJEMEN (founder / leader)
tim · data sales · omzet Nama · rekrut sales Nama · keuangan perusahaan

Menu: /menu`;
}
