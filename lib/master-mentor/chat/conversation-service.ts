import type { SupabaseClient } from "@supabase/supabase-js";
import { MentorValidationError } from "../types";
import { cleanText, isMissingTable, requireText, requireUuid } from "../text";
import { assertOwnedBusiness } from "../ownership";

const CONV = "module_master_mentor_conversations";
const MSG = "module_master_mentor_messages";

export type MentorConversation = {
  id: string;
  owner_user_id: string;
  business_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
};

export type MentorMessage = {
  id: string;
  conversation_id: string;
  owner_user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  specialists: string[];
  sources_used: string[];
  missing: string[];
  usage: Record<string, unknown> | null;
  created_at: string;
};

export async function listConversations(
  db: SupabaseClient,
  ownerUserId: string,
  q?: string,
): Promise<{ rows: MentorConversation[]; notice: string | null }> {
  let query = db
    .from(CONV)
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .order("updated_at", { ascending: false })
    .limit(50);
  const term = cleanText(q, 120);
  if (term) query = query.ilike("title", `%${term}%`);
  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error, CONV)) {
      return { rows: [], notice: "Tabel percakapan belum aktif. Jalankan migration Phase 3 intelligence." };
    }
    return { rows: [], notice: error.message };
  }
  return { rows: (data || []) as MentorConversation[], notice: null };
}

export async function createConversation(
  db: SupabaseClient,
  ownerUserId: string,
  opts: { businessId?: string | null; title?: string },
): Promise<MentorConversation> {
  if (opts.businessId) await assertOwnedBusiness(db, ownerUserId, opts.businessId);
  const now = new Date().toISOString();
  const { data, error } = await db
    .from(CONV)
    .insert({
      owner_user_id: ownerUserId,
      business_id: opts.businessId || null,
      title: cleanText(opts.title || "New consultation", 120) || "New consultation",
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) {
    if (isMissingTable(error, CONV)) {
      throw new MentorValidationError("Tabel percakapan belum aktif. Jalankan migration Phase 3.");
    }
    throw new MentorValidationError(error.message || "Gagal membuat percakapan.");
  }
  return data as MentorConversation;
}

export async function getConversation(
  db: SupabaseClient,
  ownerUserId: string,
  idRaw: string,
): Promise<MentorConversation> {
  const id = requireUuid(idRaw, "Conversation ID");
  const { data, error } = await db
    .from(CONV)
    .select("*")
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (error) throw new MentorValidationError(error.message);
  if (!data) throw new MentorValidationError("Percakapan tidak ditemukan.");
  return data as MentorConversation;
}

export async function listMessages(
  db: SupabaseClient,
  ownerUserId: string,
  conversationId: string,
): Promise<MentorMessage[]> {
  await getConversation(db, ownerUserId, conversationId);
  const { data, error } = await db
    .from(MSG)
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingTable(error, MSG)) return [];
    throw new MentorValidationError(error.message);
  }
  return (data || []) as MentorMessage[];
}

export async function appendMessage(
  db: SupabaseClient,
  ownerUserId: string,
  opts: {
    conversationId: string;
    role: "user" | "assistant" | "system";
    content: string;
    specialists?: string[];
    sourcesUsed?: string[];
    missing?: string[];
    usage?: Record<string, unknown> | null;
    titleFromUser?: boolean;
  },
): Promise<MentorMessage> {
  const conv = await getConversation(db, ownerUserId, opts.conversationId);
  const content = requireText(opts.content, "Message", 20000);
  const { data, error } = await db
    .from(MSG)
    .insert({
      conversation_id: conv.id,
      owner_user_id: ownerUserId,
      role: opts.role,
      content,
      specialists: opts.specialists || [],
      sources_used: opts.sourcesUsed || [],
      missing: opts.missing || [],
      usage: opts.usage || null,
    })
    .select("*")
    .single();
  if (error) {
    if (isMissingTable(error, MSG)) {
      throw new MentorValidationError("Tabel pesan belum aktif. Jalankan migration Phase 3.");
    }
    throw new MentorValidationError(error.message || "Gagal menyimpan pesan.");
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (opts.titleFromUser && conv.title === "New consultation") {
    patch.title = content.slice(0, 48);
  }
  if (opts.role === "user" && opts.titleFromUser === undefined && conv.title === "New consultation") {
    patch.title = content.slice(0, 48);
  }
  await db.from(CONV).update(patch).eq("id", conv.id).eq("owner_user_id", ownerUserId);
  return data as MentorMessage;
}
