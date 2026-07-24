import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export default async function AdminBusinessesPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, type, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  const emailMap = new Map<string, string>();
  if (admin) {
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    (data?.users || []).forEach((u) => {
      if (u.email) emailMap.set(u.id, u.email);
    });
  }

  const rows = businesses || [];

  return (
    <div className="px-4 py-6 sm:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold sm:text-2xl">Bisnis</h1>
        <p className="text-xs text-[#5A5B7A]">{rows.length} bisnis terdaftar</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/[0.08]" style={{ background: "#0D0D1A" }}>
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-[10px] tracking-wide text-[#5A5B7A] uppercase">
              <th className="p-3">Nama</th>
              <th className="p-3">Tipe</th>
              <th className="p-3">Owner</th>
              <th className="p-3">Dibuat</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b: { id: string; name: string; type: string; user_id: string; created_at: string }) => (
              <tr key={b.id} className="border-b border-white/[0.04]">
                <td className="p-3 font-medium">{b.name || "—"}</td>
                <td className="p-3 text-[#2DD4BF]">{b.type || "—"}</td>
                <td className="p-3">
                  <Link href={`/admin/users/${b.user_id}`} className="text-[#38BDF8] hover:underline">
                    {emailMap.get(b.user_id) || b.user_id.slice(0, 8)}
                  </Link>
                </td>
                <td className="p-3 text-xs text-[#8B8AA0]">{new Date(b.created_at).toLocaleDateString("id-ID")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
