"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../../components/module-form-styles";

type Staff = {
  id: string;
  nama: string;
  role: string;
  status: string;
  telegram_user_id: number | null;
  invite_code: string | null;
};

export default function TeamClient({
  actor,
  staff,
  products,
}: {
  actor: { role: string; nama: string; businessName: string };
  staff: Staff[];
  products: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({ nama: "", role: "SALES" });
  const [brand, setBrand] = useState(actor.businessName);
  const [msg, setMsg] = useState("");

  const saveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/sales/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: brand }),
    });
    const json = await res.json();
    setMsg(json.error || `Nama bisnis modul: ${json.businessName}`);
    router.refresh();
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/sales/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setMsg(json.error || (json.invite_code ? `Kode undangan: ${json.invite_code}` : "Tersimpan"));
    router.refresh();
  };

  const rotate = async (staffId: string) => {
    const res = await fetch("/api/sales/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rotate_invite", staffId }),
    });
    const json = await res.json();
    setMsg(json.invite_code ? `Kode baru: ${json.invite_code} — minta sales kirim /start ${json.invite_code}` : json.error);
    router.refresh();
  };

  const seed = async () => {
    await fetch("/api/sales/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "seed_products" }),
    });
    router.refresh();
  };

  const setupWebhook = async () => {
    const res = await fetch("/api/telegram/setup", { method: "POST" });
    const json = await res.json();
    setMsg(json.ok ? `Webhook: ${json.url}` : json.error || "Gagal");
  };

  return (
    <>
      {msg && <p className="mb-4 text-sm text-[#F59E0B]">{msg}</p>}

      {actor.role === "FOUNDER" && (
        <form onSubmit={saveBrand} className={MODULE_CARD + " mb-6 grid gap-3"}>
          <p className="text-sm font-medium">Nama bisnis modul ini</p>
          <p className="text-xs text-[#8B8AA0]">
            Terpisah dari nama tenant Gercep. Muncul di Telegram, dashboard KPI, dan PDF.
          </p>
          <input
            className={MODULE_INPUT}
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Henima Scent"
            required
          />
          <button className={MODULE_BTN}>Simpan nama bisnis</button>
        </form>
      )}

      <div className={MODULE_CARD + " mb-6"}>
        <p className="text-sm">
          Telegram: {actor.nama} · {actor.role} · {actor.businessName}
        </p>
        <p className="mt-2 text-xs text-[#8B8AA0]">
          Sales mengirim <code>/start KODE</code> di bot untuk menghubungkan akun. Token bot hanya di environment.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={setupWebhook} className={MODULE_BTN}>
            Set Telegram webhook
          </button>
          <button type="button" onClick={seed} className={MODULE_BTN}>
            Seed Afternoon / The Distance
          </button>
        </div>
        <p className="mt-3 text-xs text-[#8B8AA0]">Produk: {products.map((p) => p.name).join(", ") || "belum ada"}</p>
      </div>

      {actor.role !== "SALES" && (
        <form onSubmit={add} className={MODULE_CARD + " mb-6 grid gap-3 sm:grid-cols-2"}>
          <input className={MODULE_INPUT} placeholder="Nama sales" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} required />
          <select className={MODULE_INPUT} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="SALES">SALES</option>
            {actor.role === "FOUNDER" && <option value="LEADER">LEADER</option>}
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
              <button type="button" onClick={() => rotate(s.id)} className="text-xs text-[#2DD4BF]">
                Buat kode undangan
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
