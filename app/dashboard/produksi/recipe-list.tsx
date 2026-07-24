"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type { BusinessConfig } from "../inventory/business-config";

type Material = { id: string; name: string; stock: number; cost: number | null; category: string | null };
type Recipe = { id: string; name: string; yield_quantity: number; yield_unit: string; recipe_ingredients: { id: string; quantity: number; unit: string; products?: { name: string; cost: number | null; stock: number } | null }[] };

export default function RecipeList({ recipes, materials, finishedProducts, userId, businessId, config }: { recipes: Recipe[]; materials: Material[]; finishedProducts: Material[]; userId: string; businessId?: string; config: BusinessConfig }) {
  const router = useRouter();
  const supabase = createClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [yieldQty, setYieldQty] = useState("1");
  const [yieldUnit, setYieldUnit] = useState("pcs");
  const [ingredients, setIngredients] = useState([{ material_id: "", quantity: "", unit: "gr" }]);
  const [loading, setLoading] = useState(false);

  const addIngredient = () => setIngredients([...ingredients, { material_id: "", quantity: "", unit: "gr" }]);
  const removeIngredient = (i: number) => setIngredients(ingredients.filter((_, idx) => idx !== i));
  const updateIngredient = (i: number, field: string, value: string) => {
    const updated = [...ingredients];
    updated[i] = { ...updated[i], [field]: value };
    setIngredients(updated);
  };

  const totalModalPerUnit = (recipe: Recipe) => {
    if (!recipe.yield_quantity || recipe.yield_quantity <= 0) return 0;
    return recipe.recipe_ingredients.reduce((sum, ing) => {
      const costPerUnit = ing.products?.cost || 0;
      return sum + (costPerUnit * ing.quantity);
    }, 0) / recipe.yield_quantity;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Isi nama resep dulu.");
      return;
    }
    if (ingredients.some((i) => !i.material_id || !i.quantity || Number(i.quantity) <= 0)) {
      alert("Pilih bahan dan isi jumlah (> 0) untuk setiap baris.");
      return;
    }
    if (!businessId) {
      alert("Bisnis aktif tidak terbaca. Ganti bisnis di sidebar lalu buka Produksi lagi.");
      return;
    }
    const yq = Number(yieldQty);
    if (!Number.isFinite(yq) || yq <= 0) {
      alert("Hasil resep harus angka > 0.");
      return;
    }

    setLoading(true);

    const { data: recipe, error } = await supabase
      .from("recipes")
      .insert({
        user_id: userId,
        business_id: businessId,
        name: name.trim(),
        yield_quantity: yq,
        yield_unit: yieldUnit || "pcs",
      })
      .select("id")
      .single();

    if (error || !recipe) {
      const msg = error?.message || "Unknown";
      const hint = /schema cache|does not exist|Could not find the table/i.test(msg)
        ? "\n\nTabel recipes belum ada di Supabase — jalankan migrasi produksi di SQL Editor."
        : "";
      alert("Gagal simpan resep: " + msg + hint);
      setLoading(false);
      return;
    }

    const ingInserts = ingredients
      .filter((i) => i.material_id && i.quantity)
      .map((i) => ({
        recipe_id: recipe.id,
        material_id: i.material_id,
        quantity: Number(i.quantity),
        unit: i.unit || "gr",
      }));

    const { error: ingErr } = await supabase.from("recipe_ingredients").insert(ingInserts);
    if (ingErr) {
      await supabase.from("recipes").delete().eq("id", recipe.id);
      alert(
        "Resep gagal menyimpan bahan: " +
          ingErr.message +
          ( /schema cache|Could not find|foreign key|material_id/i.test(ingErr.message)
            ? "\n\nCek migrasi recipe_ingredients + FK ke products di Supabase."
            : ""),
      );
      setLoading(false);
      return;
    }

    setLoading(false);
    setShowForm(false);
    setName("");
    setYieldQty("1");
    setIngredients([{ material_id: "", quantity: "", unit: "gr" }]);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus resep ini?")) return;
    await supabase.from("recipe_ingredients").delete().eq("recipe_id", id);
    await supabase.from("recipes").delete().eq("id", id);
    router.refresh();
  };

  return (
    <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium">Daftar Resep</h2>
        <button onClick={() => setShowForm(!showForm)} className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] text-[#0A0A12] font-medium flex items-center gap-1">
          <Plus size={13} /> Tambah Resep
        </button>
      </div>

      {showForm && (
        <div className="bg-[#0A0A12] border border-white/10 rounded-xl p-4 mb-4 flex flex-col gap-3">
          <h3 className="text-sm font-medium text-[#2DD4BF]">Resep Baru</h3>

          <div className="grid grid-cols-[1fr_100px_80px] gap-2">
            <input type="text" placeholder="Nama produk jadi (misal: Kue Brownies)" value={name} onChange={(e) => setName(e.target.value)} className="px-3 py-2 rounded-lg bg-[#0F0F1A] border border-white/10 text-sm text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50" />
            <input type="number" placeholder="Hasil" value={yieldQty} onChange={(e) => setYieldQty(e.target.value)} className="px-3 py-2 rounded-lg bg-[#0F0F1A] border border-white/10 text-sm text-[#F2F1F8] focus:outline-none focus:border-[#2DD4BF]/50" />
            <input type="text" placeholder="Satuan" value={yieldUnit} onChange={(e) => setYieldUnit(e.target.value)} className="px-3 py-2 rounded-lg bg-[#0F0F1A] border border-white/10 text-sm text-[#F2F1F8] focus:outline-none focus:border-[#2DD4BF]/50" />
          </div>

          <p className="text-[11px] text-[#8B8AA0]">Bahan-bahan yang dibutuhkan:</p>

          {ingredients.map((ing, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_60px_auto] gap-2 items-center">
              <select value={ing.material_id} onChange={(e) => updateIngredient(i, "material_id", e.target.value)} className="px-3 py-2 rounded-lg bg-[#0F0F1A] border border-white/10 text-sm text-[#F2F1F8] focus:outline-none focus:border-[#2DD4BF]/50">
                <option value="">Pilih bahan</option>
                {materials.map((m) => <option key={m.id} value={m.id}>{m.name} (stok: {m.stock})</option>)}
              </select>
              <input type="number" placeholder="Jumlah" value={ing.quantity} onChange={(e) => updateIngredient(i, "quantity", e.target.value)} className="px-3 py-2 rounded-lg bg-[#0F0F1A] border border-white/10 text-sm text-[#F2F1F8] focus:outline-none focus:border-[#2DD4BF]/50" />
              <input type="text" placeholder="Satuan" value={ing.unit} onChange={(e) => updateIngredient(i, "unit", e.target.value)} className="px-3 py-2 rounded-lg bg-[#0F0F1A] border border-white/10 text-sm text-[#F2F1F8] focus:outline-none focus:border-[#2DD4BF]/50" />
              <button onClick={() => removeIngredient(i)} className="text-[#EC4899] p-1"><Trash2 size={14} /></button>
            </div>
          ))}

          <button onClick={addIngredient} className="text-xs text-[#38BDF8] flex items-center gap-1 self-start"><Plus size={12} /> Tambah bahan</button>

          <div className="flex gap-2 mt-1">
            <button onClick={handleSave} disabled={loading} className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] text-[#0A0A12] text-sm font-semibold disabled:opacity-50">{loading ? "Menyimpan..." : "Simpan Resep"}</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-white/10 text-sm text-[#8B8AA0]">Batal</button>
          </div>
        </div>
      )}

      {recipes.length === 0 ? (
        <p className="text-sm text-[#8B8AA0] text-center py-8">Belum ada resep. Klik "Tambah Resep" untuk mulai.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {recipes.map((r) => {
            const modalPerUnit = totalModalPerUnit(r);
            const isExpanded = expandedId === r.id;
            return (
              <div key={r.id} className="bg-[#0A0A12] border border-white/10 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                  <div>
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-[11px] text-[#8B8AA0]">Hasil: {r.yield_quantity} {r.yield_unit} · Modal/unit: <span className="text-[#EC4899]">Rp{Math.round(modalPerUnit).toLocaleString("id-ID")}</span></p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} className="text-[#8B8AA0] hover:text-[#EC4899] p-1"><Trash2 size={14} /></button>
                    {isExpanded ? <ChevronUp size={16} className="text-[#8B8AA0]" /> : <ChevronDown size={16} className="text-[#8B8AA0]" />}
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-3 border-t border-white/5">
                    <p className="text-[11px] text-[#8B8AA0] mt-2 mb-2">Bahan per {r.yield_quantity} {r.yield_unit}:</p>
                    <div className="flex flex-col gap-1.5">
                      {r.recipe_ingredients.map((ing) => (
                        <div key={ing.id} className="flex items-center justify-between text-xs">
                          <span className="text-[#F2F1F8]">{ing.products?.name || "Bahan"}</span>
                          <span className="text-[#8B8AA0]">{ing.quantity} {ing.unit} · <span className="text-[#EC4899]">Rp{((ing.products?.cost || 0) * ing.quantity).toLocaleString("id-ID")}</span></span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between text-xs border-t border-white/5 pt-2 mt-1">
                        <span className="text-[#8B8AA0] font-medium">Total modal</span>
                        <span className="text-[#EC4899] font-semibold">Rp{(modalPerUnit * r.yield_quantity).toLocaleString("id-ID")}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
