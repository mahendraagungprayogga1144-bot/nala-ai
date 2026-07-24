"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Trash2 } from "lucide-react";

export default function DeleteTransactionButton({ id, table = "transactions" }: { id: string; table?: "transactions" | "products" }) {
  const router = useRouter();
  const supabase = createClient();

  const handleDelete = async () => {
    if (!confirm("Yakin mau hapus ini?")) return;
    if (table === "products") {
      await supabase.from("weight_logs").delete().eq("product_id", id);
      await supabase.from("health_schedules").delete().eq("product_id", id);
      await supabase.from("stock_movements").delete().eq("product_id", id);
      await supabase.from("harvest_batches").delete().eq("product_id", id);
      await supabase.from("recipe_ingredients").delete().eq("material_id", id);
      await supabase.from("recipes").delete().eq("product_id", id);
      await supabase.from("module_product_attrs").delete().eq("product_id", id);
    }
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      alert("Gagal hapus: " + error.message);
      return;
    }
    router.refresh();
  };

  return (
    <button onClick={handleDelete} className="text-[#8B8AA0] hover:text-[#EC4899] transition-colors p-1">
      <Trash2 size={14} />
    </button>
  );
}
