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

Berikut prosedur resmi aktivasi akun sales Anda. Mohon diikuti secara berurutan.

PROSEDUR AKTIVASI
1. Buka Telegram pada akun pribadi Anda. Jangan menggunakan perangkat atau akun manajemen.
2. Cari dan buka percakapan resmi: @${bot}
3. Kirim perintah aktivasi berikut secara persis (termasuk spasi):
/start ${code}
4. Tunggu konfirmasi sistem: CONNECTED

Kode undangan ini bersifat rahasia, berlaku untuk satu orang, dan hanya dapat digunakan di Telegram Anda sendiri. Dilarang dibagikan kepada pihak lain.

PENCATATAN PENJUALAN
Setelah status CONNECTED, catat transaksi dengan format standar perusahaan:

laku 1 harga 130rb atas nama Regan no 087712345678 tf

Harga retail katalog Rp199.999. Tuliskan harga yang dibayar pelanggan. Sistem akan menghitung diskon dan potongan secara otomatis.
Contoh persentase: laku 1 harga 199.999 diskon 20% atas nama Sinta no 08xxxxxxxxxx qris

Paket Afternoon + The Distance:
laku 2 paket new member harga 250k atas nama Dimas no 08xxxxxxxxxx qris

Metode pembayaran: tf / qris / cash / lainnya. Apabila belum disebutkan, sistem akan menanyakan.

PEMANTAUAN
rekapan hari ini
riwayat
nota regan
target / targetku

Apabila aktivasi gagal, hubungi manajemen untuk penerbitan kode undangan baru. Terima kasih.`;
}

export const UNLINKED_MSG = `Akun Telegram Anda belum terdaftar pada sistem penjualan.

Silakan minta kode undangan resmi kepada manajemen, kemudian kirim:
/start KODE

Contoh: /start 43E33258

Satu kode hanya berlaku untuk satu orang.
Sales wajib mengirim /start di Telegram mereka sendiri. Jangan menggunakan perangkat atau akun manajemen.`;

export function salesHowToText() {
  return `PEDOMAN OPERASIONAL

Pencatatan penjualan — ketik dalam satu pesan, format standar:
laku 1 harga 130rb atas nama NamaCustomer no 08xxxxxxxxxx tf

Harga retail katalog Rp199.999. Apabila pelanggan membayar Rp130.000, sistem mencatat DISKON 35% (Rp69.999) secara otomatis.
Contoh persentase: laku 1 harga 199.999 diskon 20% atas nama Sinta no 08xxxxxxxxxx qris

Paket Afternoon + The Distance dalam satu transaksi:
laku 2 paket new member harga 250k atas nama NamaCustomer no 08xxxxxxxxxx qris
atau: afternoon dan the distance

Metode pembayaran: tf (transfer), qris, cash, atau lainnya. Jika belum disebutkan, sistem akan menanyakan.

Laporan dan dokumen:
rekapan hari ini
rekap minggu ini
pdf bulan ini
pdf agustus
pdf bulan lalu
pdf setahun
pdf 2025
riwayat
nota (contoh: nota regan)
target / targetku

Perintah cadangan: /input /help`;
}
