import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const supabase = await createClient();
  if (!admin) notFound();

  const { data: userData, error } = await admin.auth.admin.getUserById(id);
  if (error || !userData?.user) notFound();
  const user = userData.user;

  const [{ data: profile }, { data: sub }, { data: businesses }, { data: events }, { data: payments }] =
    await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", id).maybeSingle(),
      supabase.from("subscriptions").select("*").eq("user_id", id).maybeSingle(),
      supabase.from("businesses").select("id, name, type, created_at").eq("user_id", id),
      admin
        .from("app_events")
        .select("id, event, module, path, created_at, meta")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("payments")
        .select("id, plan, amount, status, created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  return (
    <div className="px-4 py-6 sm:px-8">
      <Link href="/admin/users" className="mb-4 inline-block text-xs text-[#8B8AA0] hover:text-[#2DD4BF]">
        ← Users
      </Link>
      <h1 className="mb-1 text-xl font-bold">{user.email}</h1>
      <p className="mb-6 text-xs text-[#5A5B7A]">
        {(profile as { full_name?: string } | null)?.full_name || "—"} · id {id.slice(0, 8)}…
      </p>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card label="Last sign in" value={user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("id-ID") : "—"} />
        <Card label="Plan" value={(sub as { plan?: string } | null)?.plan || "free"} />
        <Card
          label="Trial ends"
          value={
            (sub as { trial_ends_at?: string } | null)?.trial_ends_at
              ? new Date((sub as { trial_ends_at: string }).trial_ends_at).toLocaleDateString("id-ID")
              : "—"
          }
        />
      </div>

      <Section title="Bisnis">
        <ul className="space-y-2 text-sm">
          {(businesses || []).map((b: { id: string; name: string; type: string }) => (
            <li key={b.id}>
              {b.name} <span className="text-[#5A5B7A]">({b.type})</span>
            </li>
          ))}
          {(businesses || []).length === 0 && <li className="text-[#5A5B7A]">Belum ada bisnis</li>}
        </ul>
      </Section>

      <Section title="Payments">
        <ul className="space-y-2 text-sm">
          {(payments || []).map((p: { id: string; plan: string; amount: number; status: string; created_at: string }) => (
            <li key={p.id}>
              {p.plan} · Rp{Number(p.amount).toLocaleString("id-ID")} · {p.status} ·{" "}
              {new Date(p.created_at).toLocaleDateString("id-ID")}
            </li>
          ))}
          {(payments || []).length === 0 && <li className="text-[#5A5B7A]">Belum ada payment</li>}
        </ul>
      </Section>

      <Section title="Activity timeline">
        <ul className="space-y-2 text-sm">
          {(events || []).map((e: { id: string; event: string; module: string | null; created_at: string }) => (
            <li key={e.id} className="border-b border-white/[0.04] pb-2">
              <span className="text-xs text-[#5A5B7A]">{new Date(e.created_at).toLocaleString("id-ID")}</span>
              <p>
                <span className="text-[#2DD4BF]">{e.event}</span>
                {e.module ? <span className="text-[#5A5B7A]"> · {e.module}</span> : null}
              </p>
            </li>
          ))}
          {(events || []).length === 0 && (
            <li className="text-[#5A5B7A]">Belum ada event (atau tabel app_events belum dimigrasi)</li>
          )}
        </ul>
      </Section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] p-4" style={{ background: "#0D0D1A" }}>
      <p className="mb-1 text-[10px] tracking-wide text-[#5A5B7A] uppercase">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-2xl border border-white/[0.08] p-4" style={{ background: "#0D0D1A" }}>
      <p className="mb-3 text-xs font-semibold tracking-wide text-[#8B8AA0] uppercase">{title}</p>
      {children}
    </div>
  );
}
