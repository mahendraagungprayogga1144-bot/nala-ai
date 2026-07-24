import { createClient } from "@/lib/supabase/server";
import BatchDetail from "./batch-detail";
import { normalizeBizType } from "@/lib/auth/post-login";

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    const { data: batch } = await supabase
      .from("farm_batches")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!batch) {
      return <div className="px-8 py-8 text-[#8B8AA0]">Batch tidak ditemukan.</div>;
    }

    const { data: transactions } = await supabase
      .from("farm_transactions")
      .select("*")
      .eq("batch_id", id)
      .order("tanggal", { ascending: true });

    const cookieStore = await (await import("next/headers")).cookies();
    const activeBusinessId = cookieStore.get("active_business_id")?.value;
    const { data: businesses } = await supabase
      .from("businesses")
      .select("id, type")
      .eq("user_id", user.id);

    const ternakList = (businesses || []).filter((b) => normalizeBizType(b.type) === "ternak");
    const businessId =
      (activeBusinessId && ternakList.find((b) => b.id === activeBusinessId)?.id) ||
      ternakList[0]?.id ||
      batch.business_id ||
      "";

    return (
      <BatchDetail
        batch={batch}
        transactions={transactions || []}
        userId={user.id}
        businessId={businessId}
      />
    );
  } catch (err) {
    console.error("[peternakan/batch]", err);
    return (
      <div className="px-8 py-12 text-center">
        <p className="mb-2 text-[#EC4899]">Gagal memuat batch.</p>
        <p className="text-xs text-[#8B8AA0]">Coba muat ulang atau buka dari daftar Manajemen Ternak.</p>
        <a href="/dashboard/peternakan" className="mt-4 inline-block text-sm text-[#2DD4BF]">
          ← Kembali
        </a>
      </div>
    );
  }
}
