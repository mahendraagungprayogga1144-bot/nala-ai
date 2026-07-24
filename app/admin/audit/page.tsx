import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminAuditPage() {
  const admin = createAdminClient();
  const { data } = admin
    ? await admin
        .from("admin_logs")
        .select("id, admin_email, action, target_user_id, detail, created_at")
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };

  const logs = data || [];

  return (
    <div className="px-4 py-6 sm:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold sm:text-2xl">Audit</h1>
        <p className="text-xs text-[#5A5B7A]">Log aksi admin (settings, payment ACC, suspend, dll.)</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/[0.08]" style={{ background: "#0D0D1A" }}>
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-[10px] tracking-wide text-[#5A5B7A] uppercase">
              <th className="p-3">Waktu</th>
              <th className="p-3">Admin</th>
              <th className="p-3">Action</th>
              <th className="p-3">Target</th>
              <th className="p-3">Detail</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l: {
              id: string;
              admin_email: string | null;
              action: string | null;
              target_user_id: string | null;
              detail: unknown;
              created_at: string;
            }) => (
              <tr key={l.id} className="border-b border-white/[0.04]">
                <td className="p-3 text-xs text-[#8B8AA0]">{new Date(l.created_at).toLocaleString("id-ID")}</td>
                <td className="p-3">{l.admin_email || "—"}</td>
                <td className="p-3 font-medium text-[#EC4899]">{l.action}</td>
                <td className="p-3 text-xs text-[#8B8AA0]">{l.target_user_id?.slice(0, 8) || "—"}</td>
                <td className="max-w-[280px] truncate p-3 text-xs text-[#5A5B7A]">
                  {JSON.stringify(l.detail || {})}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-[#5A5B7A]">
                  Belum ada audit log
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
