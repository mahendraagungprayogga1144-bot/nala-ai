import type { Metadata } from "next";
import LegalShell, { H, P, Ul } from "@/app/components/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Kebijakan privasi Gercep AI oleh PT Henima Collection Indonesia.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="24 Juli 2026">
      <P>
        Kebijakan Privasi ini menjelaskan bagaimana <strong className="text-[#F0EFF8]">PT Henima Collection Indonesia</strong>{" "}
        (“kami”) mengumpulkan, menggunakan, menyimpan, dan melindungi data pribadi saat Anda menggunakan aplikasi dan situs{" "}
        <strong className="text-[#F0EFF8]">Gercep AI</strong> (gercepos.id).
      </P>

      <H>1. Data yang kami kumpulkan</H>
      <Ul
        items={[
          "Data akun: nama, alamat email, kata sandi (disimpan terenkripsi oleh penyedia autentikasi), dan data profil bisnis.",
          "Data bisnis yang Anda input: transaksi, inventori, pesanan, pelanggan, laporan, dan konten modul lain yang Anda simpan di platform.",
          "Data teknis: perangkat, browser, alamat IP (jika diproses infrastruktur), log aktivitas aplikasi untuk keamanan dan operasional.",
          "Data pembayaran: informasi paket, status invoice, dan konfirmasi transfer (kami tidak menyimpan nomor kartu kredit penuh).",
        ]}
      />

      <H>2. Tujuan penggunaan data</H>
      <Ul
        items={[
          "Menyediakan dan mengoperasikan layanan Gercep AI sesuai akun Anda.",
          "Autentikasi, keamanan akun, reset kata sandi, dan pencegahan penyalahgunaan.",
          "Personalisasi fitur berdasarkan jenis bisnis yang Anda pilih.",
          "Dukungan pelanggan, notifikasi layanan, dan informasi berlangganan.",
          "Analisis agregat untuk memperbaiki produk (tanpa menjual data pribadi Anda).",
        ]}
      />

      <H>3. Dasar pemrosesan</H>
      <P>
        Kami memproses data berdasarkan: (a) pelaksanaan kontrak layanan saat Anda mendaftar; (b) kepentingan sah untuk keamanan
        dan peningkatan produk; dan/atau (c) kewajiban hukum yang berlaku di Indonesia.
      </P>

      <H>4. Penyimpanan & keamanan</H>
      <P>
        Data disimpan pada infrastruktur cloud tepercaya (termasuk database dan autentikasi). Kami menerapkan kontrol akses,
        enkripsi pada jalur komunikasi, dan pembatasan akses admin. Tidak ada sistem yang 100% aman; kami berupaya
        menjaga standar keamanan yang wajar.
      </P>

      <H>5. Berbagi data dengan pihak ketiga</H>
      <Ul
        items={[
          "Penyedia infrastruktur (hosting, database, email transactional) yang membantu menjalankan layanan.",
          "Tidak kami jual data pribadi Anda kepada pihak ketiga untuk pemasaran mereka.",
          "Dapat dibagikan jika diwajibkan hukum atau untuk melindungi hak, keamanan, dan integritas layanan.",
        ]}
      />

      <H>6. Hak Anda</H>
      <Ul
        items={[
          "Mengakses dan memperbarui data profil melalui aplikasi.",
          "Meminta penghapusan akun/data dengan menghubungi kami (kecuali data yang wajib disimpan menurut hukum).",
          "Menolak komunikasi pemasaran non-esensial.",
        ]}
      />

      <H>7. Cookie & teknologi serupa</H>
      <P>
        Kami menggunakan cookie/sesi yang diperlukan untuk login, keamanan, dan preferensi aplikasi. Cookie analitik (jika
        diaktifkan) membantu memahami penggunaan produk secara agregat.
      </P>

      <H>8. Anak di bawah umur</H>
      <P>
        Gercep AI ditujukan untuk pelaku usaha/UMKM dewasa. Kami tidak sengaja mengumpulkan data anak di bawah 18 tahun.
      </P>

      <H>9. Perubahan kebijakan</H>
      <P>
        Kami dapat memperbarui kebijakan ini. Perubahan material akan ditandai dengan tanggal “Terakhir diperbarui” di halaman
        ini.
      </P>

      <H>10. Kontak</H>
      <P>
        Untuk pertanyaan privasi, hubungi: hellogercepai@gmail.com — PT Henima Collection Indonesia.
      </P>
    </LegalShell>
  );
}
