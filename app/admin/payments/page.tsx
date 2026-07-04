import { createClient } from "@/lib/supabase/server";
import AdminPaymentsClient from "./admin-payments-client";

export type AdminPayment = {
  id: string;
  user_id: string;
  user_name: string | null;
  plan: string;
  amount: number;
  method: string | null;
  status: string;
  invoice_id: string | null;
  created_at: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
};

export default async function AdminPaymentsPage() {
  const supabase = await createClient();

  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: businesses } = await supabase
    .from("businesses")
    .select("user_id, name")
    .order("created_at", { ascending: true });

  const nameMap = new Map<string, string>();
  (businesses || []).forEach(b => { if (!nameMap.has(b.user_id)) nameMap.set(b.user_id, b.name); });

  const result: AdminPayment[] = (payments || []).map(p => ({
    ...p,
    user_name: nameMap.get(p.user_id) || null,
  }));

  return <AdminPaymentsClient payments={result} />;
}
