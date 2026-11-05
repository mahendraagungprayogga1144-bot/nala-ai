import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BUSINESS_CATEGORIES,
  BUSINESS_STATUSES,
  MentorValidationError,
  isBusinessCategory,
  isBusinessStatus,
  type MentorPortfolioBusiness,
} from "./types";

const TABLE = "module_master_mentor_businesses";

function cleanText(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .trim()
    .slice(0, max);
}

export function isMissingPortfolioTable(err: unknown) {
  const msg =
    err && typeof err === "object" && "message" in err
      ? String((err as { message?: unknown }).message || "")
      : err instanceof Error
        ? err.message
        : String(err || "");
  return /module_master_mentor_businesses|does not exist|schema cache|relation/i.test(msg);
}

export type PortfolioNotice =
  | { kind: "ok" }
  | { kind: "missing_table"; message: string }
  | { kind: "error"; message: string };

export async function listPortfolioBusinesses(
  db: SupabaseClient,
  ownerUserId: string,
): Promise<{ rows: MentorPortfolioBusiness[]; notice: PortfolioNotice }> {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingPortfolioTable(error)) {
      return {
        rows: [],
        notice: {
          kind: "missing_table",
          message:
            "Tabel portfolio belum aktif di database. Jalankan migration master mentor, lalu muat ulang halaman ini.",
        },
      };
    }
    return { rows: [], notice: { kind: "error", message: error.message } };
  }

  return { rows: (data || []) as MentorPortfolioBusiness[], notice: { kind: "ok" } };
}

export type PortfolioInput = {
  name: string;
  category: string;
  description: string;
  status: string;
  targets: string;
};

export function parsePortfolioInput(body: unknown): PortfolioInput {
  if (!body || typeof body !== "object") {
    throw new MentorValidationError("Payload tidak valid.");
  }
  const raw = body as Record<string, unknown>;
  const name = cleanText(raw.name, 120);
  const category = cleanText(raw.category, 40).toLowerCase();
  const description = cleanText(raw.description, 2000);
  const status = cleanText(raw.status, 20).toLowerCase() || "draft";
  const targets = cleanText(raw.targets, 2000);

  if (!name) throw new MentorValidationError("Nama bisnis wajib diisi.");
  if (!isBusinessCategory(category)) {
    throw new MentorValidationError(
      `Kategori tidak valid. Pilih: ${BUSINESS_CATEGORIES.join(", ")}.`,
    );
  }
  if (!isBusinessStatus(status)) {
    throw new MentorValidationError(
      `Status tidak valid. Pilih: ${BUSINESS_STATUSES.join(", ")}.`,
    );
  }

  return { name, category, description, status, targets };
}

export async function createPortfolioBusiness(
  db: SupabaseClient,
  ownerUserId: string,
  input: PortfolioInput,
): Promise<MentorPortfolioBusiness> {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from(TABLE)
    .insert({
      owner_user_id: ownerUserId,
      name: input.name,
      category: input.category,
      description: input.description,
      status: input.status,
      targets: input.targets,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    if (isMissingPortfolioTable(error)) {
      throw new MentorValidationError(
        "Tabel portfolio belum aktif. Jalankan migration master mentor terlebih dahulu.",
      );
    }
    throw new MentorValidationError(error.message || "Gagal menyimpan bisnis.");
  }

  return data as MentorPortfolioBusiness;
}

export async function updatePortfolioBusiness(
  db: SupabaseClient,
  ownerUserId: string,
  id: string,
  input: PortfolioInput,
): Promise<MentorPortfolioBusiness> {
  const businessId = cleanText(id, 80);
  if (!businessId) throw new MentorValidationError("ID bisnis tidak valid.");

  const { data, error } = await db
    .from(TABLE)
    .update({
      name: input.name,
      category: input.category,
      description: input.description,
      status: input.status,
      targets: input.targets,
      updated_at: new Date().toISOString(),
    })
    .eq("id", businessId)
    .eq("owner_user_id", ownerUserId)
    .select("*")
    .maybeSingle();

  if (error) {
    if (isMissingPortfolioTable(error)) {
      throw new MentorValidationError(
        "Tabel portfolio belum aktif. Jalankan migration master mentor terlebih dahulu.",
      );
    }
    throw new MentorValidationError(error.message || "Gagal memperbarui bisnis.");
  }
  if (!data) throw new MentorValidationError("Bisnis tidak ditemukan.");
  return data as MentorPortfolioBusiness;
}

export async function deletePortfolioBusiness(
  db: SupabaseClient,
  ownerUserId: string,
  id: string,
): Promise<void> {
  const businessId = cleanText(id, 80);
  if (!businessId) throw new MentorValidationError("ID bisnis tidak valid.");

  const { data, error } = await db
    .from(TABLE)
    .delete()
    .eq("id", businessId)
    .eq("owner_user_id", ownerUserId)
    .select("id");

  if (error) {
    if (isMissingPortfolioTable(error)) {
      throw new MentorValidationError(
        "Tabel portfolio belum aktif. Jalankan migration master mentor terlebih dahulu.",
      );
    }
    throw new MentorValidationError(error.message || "Gagal menghapus bisnis.");
  }
  if (!data?.length) throw new MentorValidationError("Bisnis tidak ditemukan.");
}
