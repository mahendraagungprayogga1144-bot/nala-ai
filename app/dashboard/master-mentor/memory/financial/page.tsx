import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import { listBusinessMemory } from "@/lib/master-mentor/business-memory-service";
import { listFinancialRecords } from "@/lib/master-mentor/financial-memory-service";
import { createClient } from "@/lib/supabase/server";
import FinancialMemoryClient from "./financial-memory-client";

export default async function FinancialMemoryPage() {
  const owner = await requireMentorOwnerPage();
  const db = await createClient();
  const [{ rows: businesses }, fin] = await Promise.all([
    listBusinessMemory(db, owner.userId),
    listFinancialRecords(db, owner.userId, {
      businessId: undefined,
    }),
  ]);
  const firstBiz = businesses[0]?.id;
  const scoped = firstBiz
    ? await listFinancialRecords(db, owner.userId, { businessId: firstBiz })
    : fin;
  return (
    <FinancialMemoryClient
      businesses={businesses.map((b) => ({ id: b.id, name: b.name }))}
      initial={scoped.rows}
      notice={scoped.notice}
    />
  );
}
