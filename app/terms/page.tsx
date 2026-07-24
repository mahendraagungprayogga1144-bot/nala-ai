import type { Metadata } from "next";
import LegalShell, { H, P, Ul } from "@/app/components/legal-shell";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Syarat dan ketentuan penggunaan Gercep AI.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="24 Juli 2026">
      <P>
        Dengan mengakses atau menggunakan <strong className="text-[#F0EFF8]">Gercep AI</strong>, Anda menyetujui Syarat
        Layanan ini bersama <strong className="text-[#F0EFF8]">PT Henima Collection Indonesia</strong> (“kami”).
      </P>

      <H>1. Layanan</H>
      <P>
        Gercep AI adalah platform perangkat lunak (SaaS) untuk membantu UMKM mengelola operasional bisnis (keuangan,
        inventori, kasir, marketplace, pajak, dan fitur terkait). Fitur dapat berbeda menurut paket, jenis bisnis, dan status
        langganan/trial.
      </P>

      <H>2. Akun & tanggung jawab pengguna</H>
      <Ul
        items={[
          "Anda wajib memberikan data pendaftaran yang akurat dan menjaga kerahasiaan kata sandi.",
          "Anda bertanggung jawab atas seluruh aktivitas di akun Anda, termasuk akun demo/karyawan yang Anda kelola.",
          "Dilarang menyalahgunakan layanan: meretas, mengganggu sistem, spam, atau melanggar hukum.",
          "Konten dan data bisnis yang Anda unggah adalah tanggung jawab Anda.",
        ]}
      />

      <H>3. Trial, paket, dan pembayaran</H>
      <Ul
        items={[
          "Akun baru dapat memperoleh masa trial sesuai ketentuan yang berlaku di aplikasi.",
          "Paket berbayar diaktifkan setelah pembayaran dikonfirmasi sesuai alur yang tersedia (termasuk transfer manual).",
          "Harga, fitur, dan kuota dapat berubah; perubahan untuk pelanggan aktif akan diinformasikan wajar sebelumnya bila material.",
          "Kegagalan pembayaran dapat menyebabkan pembatasan akses fitur premium.",
        ]}
      />

      <H>4. Kekayaan intelektual</H>
      <P>
        Merek, logo, desain, dan kode Gercep AI milik PT Henima Collection Indonesia atau pemberi lisensinya. Anda mendapat
        lisensi terbatas, non-eksklusif, tidak dapat dipindahtangankan untuk memakai layanan sesuai ketentuan ini.
      </P>

      <H>5. Data Anda</H>
      <P>
        Anda tetap memiliki data bisnis yang Anda masukkan. Dengan menggunakan layanan, Anda memberi kami lisensi untuk
        memproses data tersebut sejauh diperlukan untuk menyediakan Gercep AI. Ketentuan privasi diatur di{" "}
        <a href="/privacy" className="text-[#2DD4BF] hover:underline">
          Privacy Policy
        </a>{" "}
        dan{" "}
        <a href="/kebijakan-data" className="text-[#2DD4BF] hover:underline">
          Kebijakan Data
        </a>
        .
      </P>

      <H>6. Ketersediaan layanan</H>
      <P>
        Kami berupaya menjaga layanan tetap tersedia, namun tidak menjamin uptime tanpa gangguan. Maintenance, gangguan
        jaringan, atau force majeure dapat menyebabkan jeda sementara.
      </P>

      <H>7. Penafian AI & akurasi</H>
      <P>
        Fitur berbasis AI bersifat bantuan. Output AI dapat tidak sempurna. Keputusan bisnis, pajak, dan keuangan tetap
        tanggung jawab Anda. Untuk kewajiban formal (mis. pelaporan pajak), konsultasikan profesional yang berwenang.
      </P>

      <H>8. Pembatasan tanggung jawab</H>
      <P>
        Sejauh diizinkan hukum, kami tidak bertanggung jawab atas kerugian tidak langsung, kehilangan keuntungan, atau
        kehilangan data akibat penggunaan/ketidaktersediaan layanan, kecuali disebabkan kelalaian berat atau kesengajaan
        kami.
      </P>

      <H>9. Pengakhiran</H>
      <Ul
        items={[
          "Anda dapat berhenti menggunakan layanan kapan saja.",
          "Kami dapat menangguhkan atau mengakhiri akses jika terjadi pelanggaran ketentuan, risiko keamanan, atau kewajiban hukum.",
          "Setelah pengakhiran, akses ke data dapat dibatasi; permintaan ekspor/penghapusan dapat diajukan sesuai kebijakan data.",
        ]}
      />

      <H>10. Hukum yang berlaku</H>
      <P>
        Ketentuan ini diatur oleh hukum Republik Indonesia. Sengketa diupayakan diselesaikan secara musyawarah; jika tidak
        tercapai, diselesaikan melalui forum yang berwenang di Indonesia.
      </P>

      <H>11. Kontak</H>
      <P>Hubungi: hellogercepai@gmail.com — PT Henima Collection Indonesia.</P>
    </LegalShell>
  );
}
