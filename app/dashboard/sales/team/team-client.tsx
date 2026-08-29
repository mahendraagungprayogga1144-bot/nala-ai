"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../../components/module-form-styles";
import { fmtRp } from "@/lib/henima-sales/money";

type Staff = {
  id: string;
  nama: string;
  role: string;
  status: string;
  telegram_user_id: number | null;
  invite_code: string | null;
};

type Product = {
  id: string;
  name: string;
  price: number | null;
  stock: number | null;
  unit: string | null;
};

export default function TeamClient({
  actor,
  staff,
  products,
}: {
  actor: { role: string; nama: string; businessName: string; tagline?: string | null; staffId?: string };
  staff: Staff[];
  products: Product[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({ nama: "", role: "SALES" });
  const [brand, setBrand] = useState(actor.businessName);
  const [tagline, setTagline] = useState(actor.tagline || "");
  const [productForm, setProductForm] = useState({ name: "", price: "", stock: "" });
  const [msg, setMsg] = useState("");
  const founder = actor.role === "FOUNDER";

  const flash = (text: string) => setMsg(text);

  const saveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/sales/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: brand, tagline }),
    });
    const json = await res.json();
    flash(json.error || `Tersimpan: ${json.businessName}`);
    router.refresh();
  };

  const saveProduct = async (payload: { id?: string; name: string; price: number; stock: number }) => {
    const res = await fetch("/api/sales/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    flash(json.error || (payload.id ? "Produk diupdate." : `Produk ${json.product?.name || ""} ditambah.`));
    if (!json.error && !payload.id) setProductForm({ name: "", price: "", stock: "" });
    router.refresh();
  };

  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveProduct({
      name: productForm.name,
      price: Number(productForm.price),
      stock: Number(productForm.stock || 0),
    });
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/sales/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    flash(json.error || (json.invite_code ? `Kode undangan: ${json.invite_code}` : "Tersimpan"));
    router.refresh();
  };

  const rotate = async (staffId: string) => {
    const res = await fetch("/api/sales/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rotate_invite", staffId }),
    });
    const json = await res.json();
    flash(json.invite_code ? `Kode baru: ${json.invite_code} — minta sales kirim /start ${json.invite_code}` : json.error);
    router.refresh();
  };

  const toggleStaff = async (staffId: string, status: string) => {
    const next = status === "disabled" ? "active" : "disabled";
    const res = await fetch("/api/sales/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_status", staffId, status: next }),
    });
    const json = await res.json();
    flash(json.error || (next === "disabled" ? "Sales dinonaktifkan." : "Sales diaktifkan."));
    router.refresh();
  };

  const seed = async () => {
    await fetch("/api/sales/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "seed_products" }),
    });
    flash("Produk awal Afternoon / The Distance dicek.");
    router.refresh();
  };

  const setupWebhook = async () => {
    const res = await fetch("/api/telegram/setup", { method: "POST" });
    const json = await res.json();
    flash(json.ok ? `Webhook: ${json.url}` : json.error || "Gagal");
  };

  return (
    <>
      {msg && <p className="mb-4 text-sm text-[#F59E0B]">{msg}</p>}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Link href="/dashboard/sales" className={MODULE_CARD + " block hover:border-[#2DD4BF]/40"}>
          <p className="text-sm font-medium">Dashboard KPI</p>
          <p className="mt-1 text-xs text-[#8B8AA0]">Omzet, pcs, AOV, ranking — data modul ini.</p>
        </Link>
        <Link href="/dashboard/sales/targets" className={MODULE_CARD + " block hover:border-[#2DD4BF]/40"}>
          <p className="text-sm font-medium">Target & pencapaian</p>
          <p className="mt-1 text-xs text-[#8B8AA0]">Atur target harian / mingguan / bulanan sendiri.</p>
        </Link>
        <Link href="/dashboard/sales/commissions" className={MODULE_CARD + " block hover:border-[#2DD4BF]/40"}>
          <p className="text-sm font-medium">Komisi</p>
          <p className="mt-1 text-xs text-[#8B8AA0]">Atur % atau nominal tetap per role.</p>
        </Link>
      </div>

      {founder && (
        <form onSubmit={saveBrand} className={MODULE_CARD + " mb-6 grid gap-3"}>
          <p className="text-sm font-medium">Identitas modul</p>
          <p className="text-xs text-[#8B8AA0]">
            Nama ini muncul di Telegram, dashboard, dan PDF. Bukan nama tenant Gercep.
          </p>
          <input
            className={MODULE_INPUT}
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Henima Scent"
            required
          />
          <input
            className={MODULE_INPUT}
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Tagline (opsional) — tampil di /start Telegram"
          />
          <button className={MODULE_BTN}>Simpan identitas</button>
        </form>
      )}

      {founder && (
        <div className={MODULE_CARD + " mb-6 space-y-4"}>
          <div>
            <p className="text-sm font-medium">Produk parfum</p>
            <p className="text-xs text-[#8B8AA0]">
              Hanya produk ini yang muncul di Telegram. Es batu / stok Gercep lain tidak ikut.
            </p>
          </div>
          <form onSubmit={addProduct} className="grid gap-3 sm:grid-cols-3">
            <input
              className={MODULE_INPUT}
              placeholder="Nama produk"
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              required
            />
            <input
              className={MODULE_INPUT}
              type="number"
              min="0"
              placeholder="Harga jual"
              value={productForm.price}
              onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
              required
            />
            <input
              className={MODULE_INPUT}
              type="number"
              min="0"
              placeholder="Stok"
              value={productForm.stock}
              onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
            />
            <button className={MODULE_BTN + " sm:col-span-3"}>Tambah produk</button>
          </form>
          <button type="button" onClick={seed} className="text-xs text-[#2DD4BF]">
            Isi cepat Afternoon / The Distance (jika belum ada)
          </button>
          <div className="space-y-2">
            {products.length === 0 ? (
              <p className="text-sm text-[#8B8AA0]">Belum ada produk.</p>
            ) : (
              products.map((p) => (
                <ProductRow key={p.id} product={p} onSave={saveProduct} />
              ))
            )}
          </div>
        </div>
      )}

      {!founder && products.length > 0 && (
        <div className={MODULE_CARD + " mb-6"}>
          <p className="text-sm font-medium">Produk</p>
          <ul className="mt-2 space-y-1 text-sm text-[#8B8AA0]">
            {products.map((p) => (
              <li key={p.id}>
                {p.name} · {fmtRp(p.price || 0)} · stok {p.stock ?? 0}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={MODULE_CARD + " mb-6"}>
        <p className="text-sm font-medium">Telegram</p>
        <p className="mt-1 text-sm">
          {actor.nama} · {actor.role} · {actor.businessName}
        </p>
        <p className="mt-2 text-xs text-[#8B8AA0]">
          Sales mengirim <code>/start KODE</code> di bot untuk menghubungkan akun. Token bot hanya di environment.
        </p>
        {founder && (
          <div className="mt-3">
            <button type="button" onClick={setupWebhook} className={MODULE_BTN}>
              Set Telegram webhook
            </button>
          </div>
        )}
      </div>

      {actor.role !== "SALES" && (
        <form onSubmit={add} className={MODULE_CARD + " mb-6 grid gap-3 sm:grid-cols-2"}>
          <p className="text-sm font-medium sm:col-span-2">Undang tim</p>
          <input className={MODULE_INPUT} placeholder="Nama sales" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} required />
          <select className={MODULE_INPUT} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="SALES">SALES</option>
            {founder && <option value="LEADER">LEADER</option>}
          </select>
          <button className={MODULE_BTN + " sm:col-span-2"}>Undang anggota</button>
        </form>
      )}

      <div className="space-y-2">
        {staff.map((s) => (
          <div key={s.id} className={MODULE_CARD + " flex flex-wrap items-center justify-between gap-3"}>
            <div>
              <p className="font-medium">{s.nama}</p>
              <p className="text-[11px] text-[#8B8AA0]">
                {s.role} · {s.status} · Telegram: {s.telegram_user_id ? "CONNECTED" : "belum"}
                {s.invite_code ? ` · kode ${s.invite_code}` : ""}
              </p>
            </div>
            {actor.role !== "SALES" && (
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => rotate(s.id)} className="text-xs text-[#2DD4BF]">
                  Buat kode undangan
                </button>
                {founder && s.id !== actor.staffId && (
                  <button type="button" onClick={() => toggleStaff(s.id, s.status)} className="text-xs text-[#F59E0B]">
                    {s.status === "disabled" ? "Aktifkan" : "Nonaktifkan"}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function ProductRow({
  product,
  onSave,
}: {
  product: Product;
  onSave: (payload: { id?: string; name: string; price: number; stock: number }) => Promise<void>;
}) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.price ?? ""));
  const [stock, setStock] = useState(String(product.stock ?? 0));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ id: product.id, name, price: Number(price), stock: Number(stock || 0) });
      }}
      className="grid gap-2 sm:grid-cols-[1fr_110px_80px_auto]"
    >
      <input className={MODULE_INPUT} value={name} onChange={(e) => setName(e.target.value)} required />
      <input className={MODULE_INPUT} type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required />
      <input className={MODULE_INPUT} type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} />
      <button className={MODULE_BTN + " text-xs"}>Simpan</button>
    </form>
  );
}
