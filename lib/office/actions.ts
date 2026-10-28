"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";
import { officeRepository } from "./repository";
import { answerOfficeQuestion, loadOfficeSnapshot, resolveStockInstruction, stockChangeMessage } from "./service";
import { STOK_AGENT_ID, type OfficeSnapshot, type WaInboxThread } from "./types";
import { loadWaInbox, saveWaGreeting } from "./wa-reply";
import { ensureFonnteKey, saveFonnteToken } from "./fonnte";

async function ownedBusiness(businessId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, message: "Masuk dulu untuk mengatur data bisnis ini." };
  const { business } = await getActiveBusiness(supabase, user.id);
  if (!business || business.id !== businessId) {
    return { ok: false as const, message: "Bisnis aktif tidak cocok. Muat ulang halaman." };
  }
  return { ok: true as const, supabase, userId: user.id };
}

async function freshOrEmpty(businessId: string): Promise<OfficeSnapshot> {
  try {
    return await loadOfficeSnapshot(businessId);
  } catch {
    return {
      business_id: businessId,
      agents: [],
      crew_active: 0,
      crew_total: 0,
      tasks_running: 0,
      notices: ["Data kantor belum bisa dimuat. Coba muat ulang."],
      products: [],
      wa_path: null,
      wa_url: null,
    };
  }
}

export async function askOfficeAgent(businessId: string, agentId: string, question: string) {
  const gate = await ownedBusiness(businessId);
  if (!gate.ok) {
    return { message: gate.message, snapshot: await freshOrEmpty(businessId) };
  }

  if (agentId === STOK_AGENT_ID) {
    const resolved = await resolveStockInstruction(businessId, question);
    if (resolved?.wrote) {
      const result = await officeRepository.adjustStock(gate.supabase, {
        businessId,
        userId: gate.userId,
        productId: resolved.productId,
        direction: resolved.direction,
        quantity: resolved.quantity,
      });
      return { message: stockChangeMessage(result), snapshot: await loadOfficeSnapshot(businessId) };
    }
    if (resolved && !resolved.wrote) {
      return { message: resolved.message, snapshot: await loadOfficeSnapshot(businessId) };
    }
  }

  const message = await answerOfficeQuestion(businessId, agentId, question);
  return { message, snapshot: await loadOfficeSnapshot(businessId) };
}

export async function loadOfficeWaInbox(businessId: string): Promise<{ threads: WaInboxThread[]; message: string | null }> {
  const gate = await ownedBusiness(businessId);
  if (!gate.ok) return { threads: [], message: gate.message };
  return { threads: await loadWaInbox(businessId), message: null };
}

export async function loadOfficeFonnte(businessId: string) {
  const gate = await ownedBusiness(businessId);
  if (!gate.ok) return { ok: false as const, message: gate.message, webhook: null, device: null, hasToken: false };
  const ready = await ensureFonnteKey(businessId);
  return {
    ok: ready.ok,
    message: ready.message,
    webhook: ready.webhook,
    device: ready.device,
    hasToken: ready.hasToken,
  };
}

export async function saveOfficeFonnte(businessId: string, token: string) {
  const gate = await ownedBusiness(businessId);
  if (!gate.ok) return { ok: false as const, message: gate.message, webhook: null, device: null };
  return saveFonnteToken(businessId, token);
}

export async function saveOfficeWaGreeting(businessId: string, greeting: string) {
  const gate = await ownedBusiness(businessId);
  if (!gate.ok) return { message: gate.message, snapshot: await freshOrEmpty(businessId) };
  const saved = await saveWaGreeting(businessId, greeting);
  return { message: saved.message, snapshot: await loadOfficeSnapshot(businessId) };
}

export async function adjustOfficeStock(input: {
  businessId: string;
  productId: string;
  direction: "masuk" | "keluar";
  quantity: number;
}) {
  const gate = await ownedBusiness(input.businessId);
  if (!gate.ok) {
    return { message: gate.message, snapshot: await freshOrEmpty(input.businessId) };
  }
  const result = await officeRepository.adjustStock(gate.supabase, {
    businessId: input.businessId,
    userId: gate.userId,
    productId: input.productId,
    direction: input.direction,
    quantity: input.quantity,
  });
  return { message: stockChangeMessage(result), snapshot: await loadOfficeSnapshot(input.businessId) };
}
