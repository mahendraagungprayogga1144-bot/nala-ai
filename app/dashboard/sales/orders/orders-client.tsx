"use client";
import { useRouter } from "next/navigation";
import ConfirmDelete from "../confirm-delete";
import NotaDownload from "../nota-download";
import { MODULE_CARD } from "../../components/module-form-styles";
import { fmtDateLongId, fmtRp } from "@/lib/henima-sales/money";
import { paymentLabel } from "@/lib/henima-sales/types";

type Order = {
  id: string;
  order_date: string;
  total: number;
  metode_bayar: string | null;
  payment_status: string | null;
  sales_id: string | null;
  order_items?: { product_name_snapshot: string | null; qty: number }[];
};

export default function OrdersClient({ rows }: { rows: Order[] }) {
  const router = useRouter();
  return (
    <div className="space-y-2">
      {rows.map((o) => {
        const items = (o.order_items || [])
          .map((i) => `${i.product_name_snapshot || "Produk"} × ${i.qty}`)
          .join(" + ") || "—";
        return (
          <div key={o.id} className={MODULE_CARD + " flex flex-wrap items-center justify-between gap-3"}>
            <div>
              <p className="text-sm font-medium">
                {fmtDateLongId(o.order_date)} · {items}
              </p>
              <p className="text-[11px] text-[#8B8AA0]">
                {paymentLabel(o.metode_bayar)} · {o.payment_status} · {fmtRp(o.total)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <NotaDownload orderId={o.id} />
              <ConfirmDelete
                label="DELETE"
                onConfirm={async () => {
                  await fetch(`/api/sales/orders/${o.id}`, { method: "DELETE" });
                  router.refresh();
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
