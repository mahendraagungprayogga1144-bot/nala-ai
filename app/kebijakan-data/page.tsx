import type { Metadata } from "next";
import LegalShell, { H, P, Ul } from "@/app/components/legal-shell";

export const metadata: Metadata = {
  title: "Kebijakan Data",
  description: "Kebijakan pengelolaan dan perlindungan data Gercep AI.",
};

export default function KebijakanDataPage() {
  return (
    <LegalShell title="Kebijakan Data" updated="24 Juli 2026">
      <P>
        Kebijakan Data ini melengkapi Privacy Policy dan menjelaskan praktik pengelolaan data pada produk{" "}
        <strong className="text-[#F0EFF8]">Gercep AI</strong> milik{" "}
        <strong className="text-[#F0EFF8]">PT Henima Collection Indonesia</strong>, dengan mengacu pada prinsip perlindungan
        data pribadi yang berlaku di Indonesia.
      </P>

      <H>1. Prinsip pengelolaan data</H>
      <Ul
        items={[
          "Minimalisasi: hanya mengumpulkan data yang relevan untuk layanan.",
          "Tujuan jelas: data dipakai untuk operasional produk, keamanan, dan dukungan.",
          "Keamanan: akses dibatasi, komunikasi dienkripsi (HTTPS).",
          "Transparansi: Anda dapat meninjau kebijakan ini kapan saja.",
          "Akuntabilitas: permintaan terkait data dapat diajukan ke kontak resmi.",
        ]}
      />

      <H>2. Kategori data</H>
      <Ul
        items={[
          "Data identitas & akun (nama, email, metadata profil).",
          "Data operasional bisnis (transaksi, stok, order, laporan, file yang Anda unggah).",
          "Data langganan & pembayaran (paket, status, bukti transfer yang Anda kirim).",
          "Data teknis & log aktivitas (untuk keamanan, debugging, dan peningkatan layanan).",
        ]}
      />

      <H>3. Lokasi & pemrosesan</H>
      <P>
        Data diproses melalui infrastruktur cloud dan layanan pendukung (autentikasi, database, email). Penyedia pihak
        ketiga hanya memproses data sesuai instruksi/kontrak untuk menjalankan Gercep AI.
      </P>

      <H>4. Retensi (lama penyimpanan)</H>
      <Ul
        items={[
          "Data akun & bisnis: selama akun aktif dan diperlukan untuk menyediakan layanan.",
          "Log aktivitas/sistem: disimpan untuk periode wajar (mis. keamanan & audit), lalu dibersihkan/diagregasi.",
          "Data pembayaran: disimpan sesuai kebutuhan administrasi dan ketentuan hukum yang relevan.",
          "Setelah penghapusan akun disetujui, data dihapus atau dianonimkan dalam jangka waktu operasional yang wajar, kecuali wajib disimpan.",
        ]}
      />

      <H>5. Hak subjek data</H>
      <Ul
        items={[
          "Akses & koreksi data melalui aplikasi atau permintaan ke email dukungan.",
          "Permintaan penghapusan akun/data (dengan verifikasi identitas).",
          "Permintaan penjelasan pemrosesan data terkait akun Anda.",
          "Penarikan persetujuan untuk komunikasi non-esensial.",
        ]}
      />

      <H>6. Keamanan & pelanggaran data</H>
      <P>
        Kami menerapkan langkah teknis dan organisasi yang wajar. Jika terjadi insiden keamanan yang berdampak material
        terhadap data pribadi, kami akan mengambil langkah mitigasi dan menginformasikan pihak terdampak sesuai kewajiban
        yang berlaku.
      </P>

      <H>7. Transfer internasional</H>
      <P>
        Apabila infrastruktur atau sub-pemroses berada di luar Indonesia, data dapat diproses lintas batas dengan
        perlindungan kontrak/keamanan yang sesuai untuk menjaga kerahasiaan dan integritas data.
      </P>

      <H>8. Data karyawan / anggota bisnis</H>
      <P>
        Jika Anda mengundang karyawan atau anggota ke bisnis di Gercep AI, Anda bertanggung jawab memastikan Anda berwenang
        memasukkan data mereka dan menginformasikan penggunaan platform kepada mereka.
      </P>

      <H>9. Hubungan dengan kebijakan lain</H>
      <P>
        Baca juga{" "}
        <a href="/privacy" className="text-[#2DD4BF] hover:underline">
          Privacy Policy
        </a>{" "}
        dan{" "}
        <a href="/terms" className="text-[#2DD4BF] hover:underline">
          Terms of Service
        </a>
        . Jika ada perbedaan penafsiran, ketentuan yang lebih spesifik untuk topik bersangkutan yang berlaku.
      </P>

      <H>10. Kontak permintaan data</H>
      <P>
        Email: hellogercepai@gmail.com · Subjek disarankan: “Permintaan Data / Gercep AI” · Perusahaan: PT
        Henima Collection Indonesia.
      </P>
    </LegalShell>
  );
}
