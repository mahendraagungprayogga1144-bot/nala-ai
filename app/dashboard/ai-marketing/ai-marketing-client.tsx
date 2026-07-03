"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Megaphone, Plus, Copy, MessageCircle } from "lucide-react";
import ModuleHeader from "../components/module-header";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../components/module-form-styles";

type Draft = { id: string; judul: string | null; caption: string; channel: string | null; jadwal: string | null };

export default function AiMarketingClient({
  businessId, businessName, userId, drafts,
}: { businessId: string; businessName: string; userId: string; drafts: Draft[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ judul: "", caption: "", channel: "whatsapp", jadwal: "" });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.caption.trim() || !businessId) return;
    setLoading(true);
    const { error } = await supabase.from("module_marketing_drafts").insert({
      user_id: userId, business_id: businessId,
      judul: form.judul || null, caption: form.caption.trim(),
      channel: form.channel, jadwal: form.jadwal || null,
    });
    setLoading(false);
    if (error) return alert(error.message);
    setForm({ judul: "", caption: "", channel: "whatsapp", jadwal: "" });
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
      <ModuleHeader icon={Megaphone} title="AI Marketing" subtitle={`${businessName} — simpan kampanye & caption sendiri`} status="beta" />

      <form onSubmit={save} className={MODULE_CARD + " mb-6 grid gap-3"}>
        <input className={MODULE_INPUT} placeholder="Judul kampanye" value={form.judul} onChange={e => setForm({ ...form, judul: e.target.value })} />
        <textarea required className={MODULE_INPUT + " min-h-[100px]"} placeholder="Caption / teks promosi *" value={form.caption} onChange={e => setForm({ ...form, caption: e.target.value })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <select className={MODULE_INPUT} value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })}>
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
          </select>
          <input type="date" className={MODULE_INPUT} value={form.jadwal} onChange={e => setForm({ ...form, jadwal: e.target.value })} />
        </div>
        <button type="submit" disabled={loading} className={MODULE_BTN + " flex items-center justify-center gap-2"}><Plus size={16} />{loading ? "Menyimpan..." : "Simpan draft"}</button>
      </form>

      {drafts.map(d => (
        <div key={d.id} className={MODULE_CARD + " mb-3"}>
          <p className="font-medium">{d.judul || "Draft"} · <span className="text-[#8B8AA0]">{d.channel}</span></p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{d.caption}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => navigator.clipboard.writeText(d.caption)} className="flex items-center gap-1 text-xs text-[#8B8AA0]"><Copy size={12} /> Salin</button>
            <button type="button" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(d.caption)}`, "_blank")} className="flex items-center gap-1 text-xs text-[#4ADE80]"><MessageCircle size={12} /> WA</button>
          </div>
        </div>
      ))}
    </div>
  );
}
