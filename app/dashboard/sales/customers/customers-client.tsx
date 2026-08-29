"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../../components/module-form-styles";
import { fmtRp } from "@/lib/henima-sales/money";
import { displayPhone } from "@/lib/henima-sales/phone";

type Row = {
  id: string;
  nama: string;
  telepon: string | null;
  whatsapp_phone: string | null;
  status: string | null;
  kota: string | null;
  last_purchase_at: string | null;
  total_orders: number | null;
  total_spent: number | null;
};

export default function CustomersClient({
  initial,
  total,
}: {
  initial: Row[];
  total: number;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nama: "", phone: "", kota: "", catatan: "" });
  const [msg, setMsg] = useState("");

  const search = () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    router.push("/dashboard/sales/customers" + (params.toString() ? `?${params}` : ""));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) return setMsg(json.error || "Gagal");
    if (json.duplicate) setMsg("Customer sudah terdaftar.");
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <input className={MODULE_INPUT + " max-w-xs"} placeholder="Cari nama / WhatsApp" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
        <button type="button" onClick={search} className={MODULE_BTN}>Cari</button>
        <button type="button" onClick={() => setOpen(!open)} className={MODULE_BTN}>Tambah customer</button>
      </div>
      {msg && <p className="mb-3 text-sm text-[#F59E0B]">{msg}</p>}
      {open && (
        <form onSubmit={save} className={MODULE_CARD + " mb-6 grid gap-3 sm:grid-cols-2"}>
          <input required className={MODULE_INPUT} placeholder="Nama *" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
          <input required className={MODULE_INPUT} placeholder="WhatsApp *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className={MODULE_INPUT} placeholder="Kota" value={form.kota} onChange={(e) => setForm({ ...form, kota: e.target.value })} />
          <input className={MODULE_INPUT} placeholder="Catatan" value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} />
          <button className={MODULE_BTN + " sm:col-span-2"}>Simpan</button>
        </form>
      )}
      <p className="mb-3 text-xs text-[#8B8AA0]">{total} customer</p>
      <div className="space-y-2">
        {initial.map((c) => (
          <Link key={c.id} href={`/dashboard/sales/customers/${c.id}`} className={MODULE_CARD + " flex items-center justify-between hover:border-[#2DD4BF]/30"}>
            <div>
              <p className="font-medium">{c.nama}</p>
              <p className="text-[11px] text-[#8B8AA0]">
                {displayPhone(c.whatsapp_phone || c.telepon)} · {c.status} · {c.kota || "—"}
              </p>
            </div>
            <p className="font-mono text-sm text-[#2DD4BF]">{fmtRp(c.total_spent)}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
