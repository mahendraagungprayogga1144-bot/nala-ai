/** Rule-based owner insights for Dashboard Analitik. */

export type InsightTone = "good" | "warn" | "bad" | "info";

export type AnalitikInsight = {
  tone: InsightTone;
  title: string;
  body: string;
};

const fmt = (n: number) => "Rp" + Math.round(Math.abs(n)).toLocaleString("id-ID");

export function buildAnalitikInsights(input: {
  omzet: number;
  omzetPrev: number;
  beban: number;
  bebanPrev: number;
  laba: number;
  labaPrev: number;
  margin: number;
  orderCount: number;
  orderCountPrev: number;
  retailOmzet: number;
  topExpense: { name: string; amount: number } | null;
  topExpenseDelta: number;
  daily: { day: string; omzet: number }[];
  isCurrentMonth: boolean;
  todayDay: number;
  bizBest: { name: string; laba: number } | null;
  bizWorst: { name: string; laba: number } | null;
}): AnalitikInsight[] {
  const out: AnalitikInsight[] = [];
  const {
    omzet, omzetPrev, beban, bebanPrev, laba, labaPrev, margin,
    orderCount, orderCountPrev, retailOmzet, topExpense, topExpenseDelta,
    daily, isCurrentMonth, todayDay, bizBest, bizWorst,
  } = input;

  if (omzet === 0 && beban === 0) {
    out.push({
      tone: "info",
      title: "Belum ada data periode ini",
      body: "Catat penjualan lewat Kasir F&B, AI Kasir, atau Keuangan Bisnis — angka di sini terisi otomatis.",
    });
    return out;
  }

  // 1. Laba vs bulan lalu
  if (omzetPrev > 0 || labaPrev !== 0) {
    const d = labaPrev === 0 ? (laba > 0 ? 100 : laba < 0 ? -100 : 0) : Math.round(((laba - labaPrev) / Math.abs(labaPrev)) * 100);
    if (d <= -10) {
      const driver =
        topExpense && topExpenseDelta > 0
          ? ` Penyebab utama: beban ${topExpense.name} naik ${fmt(topExpenseDelta)}.`
          : omzet < omzetPrev
            ? ` Omzet turun ${fmt(omzetPrev - omzet)} dibanding bulan lalu.`
            : "";
      out.push({
        tone: "bad",
        title: `Laba turun ${Math.abs(d)}% vs bulan lalu`,
        body: `Sekarang ${laba >= 0 ? "laba" : "rugi"} ${fmt(laba)}.${driver}`,
      });
    } else if (d >= 10) {
      out.push({
        tone: "good",
        title: `Laba naik ${d}% vs bulan lalu`,
        body: `Kamu ${laba >= 0 ? "untung" : "masih rugi"} ${fmt(laba)} bulan ini. Pertahankan pola penjualan yang jalan.`,
      });
    } else {
      out.push({
        tone: "info",
        title: "Laba relatif stabil",
        body: `Perubahan ${d >= 0 ? "+" : ""}${d}% vs bulan lalu (${fmt(laba)}).`,
      });
    }
  } else if (laba !== 0) {
    out.push({
      tone: laba >= 0 ? "good" : "bad",
      title: laba >= 0 ? "Bulan pertama ada laba" : "Bulan ini masih rugi",
      body: `${laba >= 0 ? "Laba" : "Rugi"} ${fmt(laba)} dari omzet ${fmt(omzet)}.`,
    });
  }

  // 2. Kas masuk vs keluar
  if (beban > omzet && omzet > 0) {
    out.push({
      tone: "bad",
      title: "Kas keluar lebih besar dari omzet",
      body: `Omzet ${fmt(omzet)} tapi beban ${fmt(beban)}. Selisih minus ${fmt(beban - omzet)} — hati-hati modal terkikis.`,
    });
  } else if (omzet > 0 && beban === 0) {
    out.push({
      tone: "warn",
      title: "Belum ada beban tercatat",
      body: "Omzet ada, tapi pengeluaran belum dicatat. Laba bisa terlihat lebih besar dari kenyataan.",
    });
  }

  // 3. Beban terbesar vs omzet
  if (topExpense && omzet > 0) {
    const share = Math.round((topExpense.amount / omzet) * 100);
    if (share >= 35) {
      out.push({
        tone: "warn",
        title: `Beban terbesar: ${topExpense.name} (${share}% omzet)`,
        body: `${fmt(topExpense.amount)} dari omzet ${fmt(omzet)}. Idealnya satu pos beban di bawah ~30% omzet.`,
      });
    } else if (share >= 20) {
      out.push({
        tone: "info",
        title: `Pos terbesar: ${topExpense.name}`,
        body: `${share}% omzet (${fmt(topExpense.amount)}). Masih wajar — pantau kalau naik terus.`,
      });
    }
  }

  // 4. Margin
  if (omzet > 0) {
    if (margin < 0) {
      out.push({
        tone: "bad",
        title: `Margin negatif ${margin}%`,
        body: "Setiap penjualan rata-rata masih merugi. Cek harga jual atau potong beban.",
      });
    } else if (margin < 10) {
      out.push({
        tone: "warn",
        title: `Margin tipis ${margin}%`,
        body: "Sedikit saja beban naik, bisa langsung rugi. Pertimbangkan naikkan harga atau hemat operasional.",
      });
    } else if (margin >= 25) {
      out.push({
        tone: "good",
        title: `Margin sehat ${margin}%`,
        body: "Di atas 25% — posisi bagus untuk UMKM, asalkan kas dan stok tetap dikontrol.",
      });
    }
  }

  // 5. AI Kasir contribution
  if (retailOmzet > 0 && omzet > 0) {
    const share = Math.round((retailOmzet / omzet) * 100);
    out.push({
      tone: "info",
      title: `AI Kasir menyumbang ${share}% omzet`,
      body: `${fmt(retailOmzet)} dari penjualan retail tercatat di laporan ini (tanpa dobel hitung Keuangan Bisnis).`,
    });
  }

  // 6. Stagnasi penjualan 3 hari terakhir (bulan berjalan)
  if (isCurrentMonth && todayDay >= 3) {
    const last3 = daily.slice(Math.max(0, todayDay - 3), todayDay);
    if (last3.length === 3 && last3.every((d) => d.omzet === 0)) {
      out.push({
        tone: "warn",
        title: "3 hari terakhir omzet nol",
        body: "Belum ada penjualan tercatat. Cek kasir aktif, atau pastikan transaksi sudah di-input.",
      });
    }
  }

  // 7. Order trend
  if (orderCountPrev > 0) {
    const d = Math.round(((orderCount - orderCountPrev) / orderCountPrev) * 100);
    if (d <= -20) {
      out.push({
        tone: "warn",
        title: `Order turun ${Math.abs(d)}%`,
        body: `${orderCount} order bulan ini vs ${orderCountPrev} bulan lalu. Omzet bisa ikut turun kalau ini berlanjut.`,
      });
    } else if (d >= 20) {
      out.push({
        tone: "good",
        title: `Order naik ${d}%`,
        body: `${orderCount} order bulan ini (dari ${orderCountPrev}). Bagus — jaga stok dan pelayanan.`,
      });
    }
  }

  // 8. Multi bisnis
  if (bizBest && bizWorst && bizBest.name !== bizWorst.name) {
    if (bizWorst.laba < 0 && bizBest.laba > 0) {
      out.push({
        tone: "warn",
        title: `${bizWorst.name} sedang rugi`,
        body: `Rugi ${fmt(bizWorst.laba)}, sementara ${bizBest.name} laba ${fmt(bizBest.laba)}. Fokus perbaiki yang minus dulu.`,
      });
    }
  }

  // Beban naik tajam
  if (bebanPrev > 0 && beban > bebanPrev * 1.25 && laba < labaPrev) {
    out.push({
      tone: "warn",
      title: `Beban naik ${Math.round(((beban - bebanPrev) / bebanPrev) * 100)}%`,
      body: `Pengeluaran ${fmt(beban)} (lalu ${fmt(bebanPrev)}). Cek kategori mana yang melonjak di Laba Rugi.`,
    });
  }

  return out.slice(0, 5);
}
