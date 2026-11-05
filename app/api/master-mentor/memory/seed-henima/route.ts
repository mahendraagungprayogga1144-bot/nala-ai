import { withMentorOwner } from "@/lib/master-mentor/authz";
import { applyHenimaPerfumePack } from "@/lib/master-mentor/seed/apply-henima-pack";

export const dynamic = "force-dynamic";

/** Owner-only: isi memori lengkap HENIMA Perfume (profil, bisnis, keuangan, stok, strategi). */
export async function POST() {
  return withMentorOwner(async ({ owner, db }) => {
    const result = await applyHenimaPerfumePack(db, owner.userId);
    return { ok: true, ...result };
  });
}
