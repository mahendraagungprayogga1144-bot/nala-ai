import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";

export default async function KasirHubPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { business } = await getActiveBusiness(supabase, user!.id);

  if (business?.type === "kuliner") {
    redirect("/dashboard/fnb/kasir");
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 text-center sm:px-8">
      <h1 className="mb-2 text-xl font-semibold">AI Kasir</h1>
      <p className="mb-4 text-sm text-[#8B8AA0]">
        Modul kasir lengkap (struk, shift, meja) tersedia untuk bisnis tipe <strong className="text-[#2DD4BF]">Kuliner / F&B</strong>.
      </p>
      <p className="text-xs text-[#5A5B7A]">
        Ganti bisnis aktif ke Warung/kuliner di sidebar, atau buat bisnis kuliner baru lewat Multi Bisnis.
      </p>
      <a href="/dashboard/bisnis" className="mt-6 inline-block rounded-xl bg-gradient-to-r from-[#2DD4BF] to-[#8B5CF6] px-5 py-2.5 text-sm font-semibold text-[#070711]">
        Kelola Bisnis
      </a>
    </div>
  );
}
