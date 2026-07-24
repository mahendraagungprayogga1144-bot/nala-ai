"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../components/module-form-styles";
import { fmtRp } from "../components/biz-hub-shell";

type Row = {
  id: string;
  name: string;
  stock: number | null;
  price: number | null;
  unit: string | null;
  min_order_qty: number | null;
  wholesale_price: number | null;
  attr_id: string | null;
};

export default function WholesaleClient({
  businessId,
  userId,
  rows,
}: {
  businessId: string;
  userId: string;
  rows: Row[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [moq, setMoq] = useState("");
  const [wprice, setWprice] = useState("");
  const [loading, setLoading] = useState(false);

  const startEdit = (r: Row) => {
    setEditId(r.id);
    setMoq(r.min_order_qty != null ? String(r.min_order_qty) : "");
    setWprice(r.wholesale_price != null ? String(r.wholesale_price) : "");
  };

  const save = async (productId: string) => {
    setLoading(true);
    const payload = {
      user_id: userId,
      business_id: businessId,
      product_id: productId,
      min_order_qty: moq ? Number(moq) : null,
      wholesale_price: wprice ? Number(wprice) : null,
    };
    const { error } = await supabase.from("module_product_attrs").upsert(payload, { onConflict: "business_id,product_id" });
    setLoading(false);
    if (error) return alert(error.message + "\n\nJalankan migrasi 20260724_biz_type_modules.sql di Supabase.");
    setEditId(null);
    router.refresh();
  };

  if (rows.length === 0) {
    return (
      <div className={MODULE_CARD + " text-center text-sm text-[#8B8AA0]"}>
        Belum ada produk. Tambah dulu di Inventory, lalu set harga grosir di sini.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <div key={r.id} className={MODULE_CARD}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-[#F0EFF8]">{r.name}</p>
              <p className="text-xs text-[#8B8AA0]">
                Stok {Number(r.stock || 0)} {r.unit || "pcs"} · Harga ecer {fmtRp(Number(r.price || 0))}
              </p>
              <p className="mt-1 text-xs text-[#2DD4BF]">
                MOQ: {r.min_order_qty ?? "—"} · Grosir: {r.wholesale_price != null ? fmtRp(Number(r.wholesale_price)) : "—"}
              </p>
            </div>
            <button type="button" className={MODULE_BTN + " !py-1.5 !text-xs"} onClick={() => startEdit(r)}>
              Set harga
            </button>
          </div>
          {editId === r.id && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <input className={MODULE_INPUT} type="number" placeholder="Min. order (MOQ)" value={moq} onChange={(e) => setMoq(e.target.value)} />
              <input className={MODULE_INPUT} type="number" placeholder="Harga grosir" value={wprice} onChange={(e) => setWprice(e.target.value)} />
              <button type="button" disabled={loading} className={MODULE_BTN + " col-span-2"} onClick={() => save(r.id)}>
                {loading ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
