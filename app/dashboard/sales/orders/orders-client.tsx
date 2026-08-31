"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ConfirmDelete from "../confirm-delete";
import NotaDownload from "../nota-download";
import { MODULE_CARD, MODULE_INPUT, MODULE_BTN } from "../../components/module-form-styles";
import { fmtDateLongId, fmtRp } from "@/lib/henima-sales/money";
import { paymentLabel } from "@/lib/henima-sales/types";

type Order = {
  id: string;
  order_date: string;
  total: number;
  diskon: number | null;
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
                {Number(o.diskon || 0) > 0 ? ` · diskon ${fmtRp(o.diskon)}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DiscountField orderId={o.id} value={Number(o.diskon || 0)} />
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

function DiscountField({ orderId, value }: { orderId: string; value: number }) {
  const router = useRouter();
  const [discount, setDiscount] = useState(value ? String(value) : "");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await fetch(`/api/sales/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ discount: Number(discount || 0) }),
        });
        setBusy(false);
        router.refresh();
      }}
    >
      <input
        className={MODULE_INPUT + " w-24 py-1 text-xs"}
        type="number"
        min="0"
        placeholder="Diskon"
        value={discount}
        onChange={(e) => setDiscount(e.target.value)}
        aria-label="Diskon"
      />
      <button className={MODULE_BTN + " text-[10px]"} disabled={busy}>
        Diskon
      </button>
    </form>
  );
}
