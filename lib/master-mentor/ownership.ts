import type { SupabaseClient } from "@supabase/supabase-js";
import { MentorValidationError } from "./types";
import { isMissingTable, requireUuid } from "./text";

const BIZ = "module_master_mentor_businesses";

export async function assertOwnedBusiness(
  db: SupabaseClient,
  ownerUserId: string,
  businessIdRaw: unknown,
): Promise<{ id: string; name: string }> {
  const businessId = requireUuid(businessIdRaw, "Business ID");
  const { data, error } = await db
    .from(BIZ)
    .select("id, name")
    .eq("id", businessId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error, BIZ)) {
      throw new MentorValidationError(
        "Tabel portfolio belum aktif. Jalankan migration master mentor terlebih dahulu.",
      );
    }
    throw new MentorValidationError(error.message || "Gagal memverifikasi bisnis.");
  }
  if (!data) {
    throw new MentorValidationError(
      "Bisnis tidak ditemukan atau bukan milik owner ini. Data antar bisnis tidak boleh dicampur.",
    );
  }
  return data as { id: string; name: string };
}
