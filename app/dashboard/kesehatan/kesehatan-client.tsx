"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../components/module-form-styles";

type Row = {
  id: string;
  name: string;
  stock: number | null;
  min_stock: number | null;
  unit: string | null;
  expiry_date: string | null;
  days_left: number | null;
};

function badge(days: number | null) {
  if (days == null) return { text: "Belum set ED", cls: "text-[#5A5B7A]" };
  if (days < 0) return { text: `Kadaluarsa ${Math.abs(days)} hari`, cls: "text-[#EC4899]" };
  if (days <= 30) return { text: `${days} hari lagi`, cls: "text-[#F59E0B]" };
  return { text: `${days} hari lagi`, cls: "text-[#2DD4BF]" };
}

export default function KesehatanClient({
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
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);

  const save = async (productId: string) => {
    if (!date) return;
    setLoading(true);
    const { error } = await supabase.from("module_product_attrs").upsert(
      {
        user_id: userId,
        business_id: businessId,
        product_id: productId,
        expiry_date: date,
      },
      { onConflict: "business_id,product_id" }
    );
    setLoading(false);
    if (error) return alert(error.message + "\n\nJalankan migrasi 20260724_biz_type_modules.sql di Supabase.");
    setEditId(null);
    router.refresh();
  };

  const sorted = [...rows].sort((a, b) => {
    const da = a.days_left ?? 99999;
    const db = b.days_left ?? 99999;
    return da - db;
  });

  if (rows.length === 0) {
    return (
      <div className={MODULE_CARD + " text-center text-sm text-[#8B8AA0]"}>
        Belum ada produk. Tambah di Inventory, lalu set tanggal kadaluarsa di sini.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((r) => {
        const b = badge(r.days_left);
        const kritis = Number(r.stock) <= Number(r.min_stock);
        return (
          <div key={r.id} className={MODULE_CARD}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-[#F0EFF8]">{r.name}</p>
                <p className="text-xs text-[#8B8AA0]">
                  Stok {Number(r.stock || 0)} {r.unit || "pcs"}
                  {kritis ? " · stok kritis" : ""}
                </p>
                <p className={`mt-1 text-xs font-medium ${b.cls}`}>{b.text}</p>
              </div>
              <button
                type="button"
                className={MODULE_BTN + " !py-1.5 !text-xs"}
                onClick={() => {
                  setEditId(r.id);
                  setDate(r.expiry_date || "");
                }}
              >
                Set ED
              </button>
            </div>
            {editId === r.id && (
              <div className="mt-3 flex gap-2">
                <input className={MODULE_INPUT} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <button type="button" disabled={loading} className={MODULE_BTN} onClick={() => save(r.id)}>
                  {loading ? "..." : "Simpan"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
