"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BarChart3, Plus } from "lucide-react";
import ModuleHeader from "../components/module-header";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../components/module-form-styles";

type Note = { id: string; topik: string; temuan: string | null; sumber: string | null; catatan: string | null };

export default function AiRisetClient({
  businessId, businessName, userId, notes,
}: { businessId: string; businessName: string; userId: string; notes: Note[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ topik: "", temuan: "", sumber: "", catatan: "" });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.topik.trim() || !businessId) return;
    setLoading(true);
    const { error } = await supabase.from("module_research_notes").insert({
      user_id: userId, business_id: businessId,
      topik: form.topik.trim(), temuan: form.temuan || null, sumber: form.sumber || null, catatan: form.catatan || null,
    });
    setLoading(false);
    if (error) return alert(error.message);
    setForm({ topik: "", temuan: "", sumber: "", catatan: "" });
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
      <ModuleHeader icon={BarChart3} title="AI Riset Bisnis" subtitle={`${businessName} — catat riset & temuan sendiri`} status="beta" />

      <form onSubmit={save} className={MODULE_CARD + " mb-6 grid gap-3"}>
        <input required className={MODULE_INPUT} placeholder="Topik riset *" value={form.topik} onChange={e => setForm({ ...form, topik: e.target.value })} />
        <textarea className={MODULE_INPUT + " min-h-[80px]"} placeholder="Temuan / analisis" value={form.temuan} onChange={e => setForm({ ...form, temuan: e.target.value })} />
        <input className={MODULE_INPUT} placeholder="Sumber (link, survei, dll)" value={form.sumber} onChange={e => setForm({ ...form, sumber: e.target.value })} />
        <input className={MODULE_INPUT} placeholder="Catatan" value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} />
        <button type="submit" disabled={loading} className={MODULE_BTN + " flex items-center justify-center gap-2"}><Plus size={16} />{loading ? "Menyimpan..." : "Simpan catatan riset"}</button>
      </form>

      {notes.map(n => (
        <div key={n.id} className={MODULE_CARD + " mb-3"}>
          <p className="font-semibold text-[#2DD4BF]">{n.topik}</p>
          {n.temuan && <p className="mt-1 text-sm">{n.temuan}</p>}
          <p className="mt-1 text-xs text-[#8B8AA0]">{[n.sumber, n.catatan].filter(Boolean).join(" · ")}</p>
        </div>
      ))}
    </div>
  );
}
