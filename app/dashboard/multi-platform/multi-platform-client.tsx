"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Smartphone, Plus } from "lucide-react";
import ModuleHeader from "../components/module-header";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../components/module-form-styles";

type Channel = { id: string; channel: string; identifier: string | null; aktif: boolean | null; catatan: string | null };

const CHANNEL_OPTS = [
  { v: "website", l: "Website" },
  { v: "whatsapp", l: "WhatsApp Business" },
  { v: "telegram", l: "Telegram Bot" },
  { v: "instagram", l: "Instagram" },
];

export default function MultiPlatformClient({
  businessId, businessName, userId, channels,
}: { businessId: string; businessName: string; userId: string; channels: Channel[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ channel: "whatsapp", identifier: "", catatan: "" });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setLoading(true);
    const { error } = await supabase.from("module_platform_channels").insert({
      user_id: userId, business_id: businessId,
      channel: form.channel, identifier: form.identifier || null,
      aktif: true, catatan: form.catatan || null,
    });
    setLoading(false);
    if (error) return alert(error.message);
    setForm({ channel: "whatsapp", identifier: "", catatan: "" });
    router.refresh();
  };

  const toggle = async (id: string, aktif: boolean) => {
    await supabase.from("module_platform_channels").update({ aktif: !aktif }).eq("id", id);
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
      <ModuleHeader icon={Smartphone} title="Multi Platform" subtitle={`${businessName} — atur channel sendiri`} status="beta" />

      <form onSubmit={save} className={MODULE_CARD + " mb-6 grid gap-3"}>
        <select className={MODULE_INPUT} value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })}>
          {CHANNEL_OPTS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
        </select>
        <input className={MODULE_INPUT} placeholder="Nomor WA / URL / username bot" value={form.identifier} onChange={e => setForm({ ...form, identifier: e.target.value })} />
        <input className={MODULE_INPUT} placeholder="Catatan" value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} />
        <button type="submit" disabled={loading} className={MODULE_BTN + " flex items-center justify-center gap-2"}><Plus size={16} />{loading ? "Menyimpan..." : "Tambah channel"}</button>
      </form>

      {channels.map(c => (
        <div key={c.id} className={MODULE_CARD + " mb-2 flex items-center justify-between"}>
          <div>
            <p className="font-medium capitalize">{c.channel}</p>
            <p className="text-xs text-[#8B8AA0]">{c.identifier || "—"}</p>
          </div>
          <button type="button" onClick={() => toggle(c.id, !!c.aktif)} className={"rounded-full px-2 py-0.5 text-[10px] font-medium " + (c.aktif ? "bg-[#2DD4BF]/15 text-[#2DD4BF]" : "bg-white/5 text-[#5A5B7A]")}>
            {c.aktif ? "Aktif" : "Nonaktif"}
          </button>
        </div>
      ))}
    </div>
  );
}
