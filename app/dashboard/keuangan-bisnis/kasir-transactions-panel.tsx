import { formatTxDateLabel, formatTxTimeWib } from "@/lib/finance/sort-transactions";

export type KasirOrderRow = {
  id: string;
  total: number;
  diskon: number | null;
  laba: number | null;
  metode_bayar: string | null;
  catatan: string | null;
  order_date: string;
  created_at: string;
  order_items: {
    qty: number;
    harga_jual: number;
    menus: { nama: string } | { nama: string }[] | null;
  }[];
};

const METODE: Record<string, string> = { tunai: "Tunai", qris: "QRIS", transfer: "Transfer" };

function menuName(m: KasirOrderRow["order_items"][0]["menus"]): string {
  if (!m) return "Menu";
  if (Array.isArray(m)) return m[0]?.nama || "Menu";
  return m.nama;
}

export default function KasirTransactionsPanel({
  orders,
  monthLabel,
}: {
  orders: KasirOrderRow[];
  monthLabel: string;
}) {
  const totalOrders = orders.length;
  const omzet = orders.reduce((s, o) => s + Number(o.total || 0), 0);
  const laba = orders.reduce((s, o) => s + Number(o.laba || 0), 0);

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-[#2DD4BF]/20 bg-[#0F0F1A]">
      <div className="border-b border-white/10 px-4 py-3 sm:px-5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[#2DD4BF]">Transaksi Kasir</p>
        <p className="text-xs text-[#8B8AA0]">Order dari kasir & link karyawan · {monthLabel}</p>
      </div>

      <div className="grid grid-cols-3 gap-px border-b border-white/10 bg-white/5">
        {[
          { label: "Total order", value: String(totalOrders), color: "#38BDF8" },
          { label: "Omzet kasir", value: "Rp" + omzet.toLocaleString("id-ID"), color: "#2DD4BF" },
          { label: "Laba kasir", value: "Rp" + Math.round(laba).toLocaleString("id-ID"), color: "#F59E0B" },
        ].map(k => (
          <div key={k.label} className="bg-[#0F0F1A] px-3 py-3 text-center sm:px-4">
            <p className="text-[9px] uppercase tracking-wide text-[#8B8AA0]">{k.label}</p>
            <p className="mt-0.5 font-mono text-sm font-semibold sm:text-base" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="max-h-[420px] overflow-y-auto p-4 sm:p-5">
        {orders.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#8B8AA0]">Belum ada transaksi kasir di periode ini.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map(o => {
              const items = o.order_items || [];
              const itemSummary = items.map(i => `${menuName(i.menus)} x${i.qty}`).join(", ");
              return (
                <div key={o.id} className="rounded-xl border border-white/[0.06] bg-[#0A0A12]/60 px-3 py-3 sm:px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-[#2DD4BF]/15 px-1.5 py-0.5 text-[9px] font-medium text-[#2DD4BF]">Kasir</span>
                        <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] text-[#8B8AA0]">
                          {METODE[o.metode_bayar || ""] || o.metode_bayar || "—"}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-[#F0EFF8]">{itemSummary || "Order"}</p>
                      <p className="mt-0.5 text-[10px] text-[#8B8AA0]">
                        {formatTxDateLabel(o.order_date)} · {formatTxTimeWib(o.created_at)} WIB
                        {o.catatan ? ` · ${o.catatan}` : ""}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-mono text-sm font-semibold text-[#2DD4BF]">
                        Rp{Number(o.total).toLocaleString("id-ID")}
                      </p>
                      {o.laba != null && (
                        <p className="text-[10px] text-[#5A5B7A]">Laba Rp{Math.round(Number(o.laba)).toLocaleString("id-ID")}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
