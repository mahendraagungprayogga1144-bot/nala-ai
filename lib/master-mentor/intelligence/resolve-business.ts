import type { SupabaseClient } from "@supabase/supabase-js";
import { MentorValidationError } from "../types";
import { isMissingTable, requireUuid } from "../text";

const PORTFOLIO = "module_master_mentor_businesses";

export type LinkedBusiness = {
  mentorBusinessId: string;
  mentorBusinessName: string;
  gercepBusinessId: string | null;
  gercepBusinessName: string | null;
  linked: boolean;
};

/**
 * Resolve mentor portfolio row and optional Gercep link.
 * Verifies Gercep ownership when a link exists.
 */
export async function resolveLinkedBusiness(
  db: SupabaseClient,
  ownerUserId: string,
  mentorBusinessIdRaw: unknown,
): Promise<LinkedBusiness> {
  const mentorBusinessId = requireUuid(mentorBusinessIdRaw, "Business ID");
  const { data, error } = await db
    .from(PORTFOLIO)
    .select("id, name, gercep_business_id")
    .eq("id", mentorBusinessId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error, PORTFOLIO)) {
      throw new MentorValidationError(
        "Tabel portfolio belum aktif. Jalankan migration master mentor terlebih dahulu.",
      );
    }
    // Column may be missing before Phase 4 migration — retry without it
    if (/gercep_business_id/i.test(error.message || "")) {
      const fallback = await db
        .from(PORTFOLIO)
        .select("id, name")
        .eq("id", mentorBusinessId)
        .eq("owner_user_id", ownerUserId)
        .maybeSingle();
      if (fallback.error || !fallback.data) {
        throw new MentorValidationError("Bisnis tidak ditemukan atau bukan milik owner ini.");
      }
      return {
        mentorBusinessId: fallback.data.id,
        mentorBusinessName: fallback.data.name,
        gercepBusinessId: null,
        gercepBusinessName: null,
        linked: false,
      };
    }
    throw new MentorValidationError(error.message || "Gagal memverifikasi bisnis.");
  }
  if (!data) {
    throw new MentorValidationError(
      "Bisnis tidak ditemukan atau bukan milik owner ini. Data antar bisnis tidak boleh dicampur.",
    );
  }

  const gercepId = (data as { gercep_business_id?: string | null }).gercep_business_id || null;
  if (!gercepId) {
    return {
      mentorBusinessId: data.id,
      mentorBusinessName: data.name,
      gercepBusinessId: null,
      gercepBusinessName: null,
      linked: false,
    };
  }

  const gercep = await db
    .from("businesses")
    .select("id, name")
    .eq("id", gercepId)
    .eq("user_id", ownerUserId)
    .maybeSingle();

  if (gercep.error || !gercep.data) {
    return {
      mentorBusinessId: data.id,
      mentorBusinessName: data.name,
      gercepBusinessId: null,
      gercepBusinessName: null,
      linked: false,
    };
  }

  return {
    mentorBusinessId: data.id,
    mentorBusinessName: data.name,
    gercepBusinessId: gercep.data.id,
    gercepBusinessName: gercep.data.name,
    linked: true,
  };
}

/** Verify owner owns a Gercep business id (for portfolio linking). */
export async function assertOwnedGercepBusiness(
  db: SupabaseClient,
  ownerUserId: string,
  gercepBusinessIdRaw: unknown,
): Promise<{ id: string; name: string }> {
  if (gercepBusinessIdRaw == null || gercepBusinessIdRaw === "") {
    throw new MentorValidationError("Gercep business ID wajib diisi untuk tautan.");
  }
  const id = requireUuid(gercepBusinessIdRaw, "Gercep business ID");
  const { data, error } = await db
    .from("businesses")
    .select("id, name")
    .eq("id", id)
    .eq("user_id", ownerUserId)
    .maybeSingle();
  if (error) throw new MentorValidationError(error.message || "Gagal memverifikasi bisnis Gercep.");
  if (!data) throw new MentorValidationError("Bisnis Gercep tidak ditemukan atau bukan milik Anda.");
  return data as { id: string; name: string };
}
