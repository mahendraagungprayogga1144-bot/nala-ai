import type { SupabaseClient } from "@supabase/supabase-js";
import { buildChairmanSystem, buildSpecialistSystem } from "../agents/prompts";
import type { AgentRunOutput, SpecialistBrief, SpecialistId } from "../agents/types";
import { buildFinanceSnapshot } from "../finance/calculations";
import type { MentorLocale } from "../i18n";
import { retrieveMentorContext } from "../memory-retrieval";
import { assertAnalyzeOnly } from "../permissions";
import { createMentorProvider, type MentorProvider, type ProviderUsage } from "../providers";
import { ProviderConfigError, ProviderRuntimeError } from "../providers/types";
import { logMentorUsage, sumUsage } from "../usage";
import {
  buildIntelligencePack,
  formatIntelligencePackForPrompt,
} from "../intelligence/pack";
import {
  extractOwnerStatedFigures,
  formatOwnerStatedFiguresForPrompt,
} from "../chat/owner-stated-figures";
import { formatMemoryContext } from "./context-prompt";
import { planSpecialistRoute } from "./router";


export type OrchestratorProgress = {
  type: "status" | "specialist_start" | "specialist_done" | "token" | "error" | "done";
  message?: string;
  specialist?: SpecialistId;
  label?: string;
  text?: string;
};

export type OrchestratorResult = {
  reply: string;
  specialists: SpecialistBrief[];
  sourcesUsed: string[];
  missing: string[];
  usage: ProviderUsage;
  businessId: string | null;
  complex: boolean;
  routeReasons: string[];
};

const LABELS: Record<SpecialistId, string> = {
  chairman: "Chairman Agent",
  strategy: "Strategy Agent",
  cfo: "CFO Agent",
  growth: "Growth Agent",
  operations: "Operations Agent",
  risk: "Risk Agent",
};

async function runSpecialist(
  provider: MentorProvider,
  specialist: SpecialistId,
  userContent: string,
  locale: MentorLocale,
): Promise<AgentRunOutput> {
  const system = buildSpecialistSystem(specialist, locale);
  const result = await provider.complete({
    system,
    messages: [{ role: "user", content: userContent }],
    temperature: specialist === "cfo" ? 0.1 : 0.3,
  });
  return {
    specialist,
    label: LABELS[specialist],
    analysis: result.text,
    usage: result.usage,
  };
}

export async function runMasterOrchestrator(opts: {
  db: SupabaseClient;
  ownerUserId: string;
  question: string;
  businessId?: string | null;
  history?: { role: "user" | "assistant"; content: string }[];
  conversationId?: string | null;
  locale?: MentorLocale;
  onProgress?: (e: OrchestratorProgress) => void;
  streamFinal?: boolean;
}): Promise<OrchestratorResult> {
  assertAnalyzeOnly();
  const onProgress = opts.onProgress || (() => {});
  const locale: MentorLocale = opts.locale === "en" ? "en" : "id";

  let provider: MentorProvider;
  try {
    provider = createMentorProvider();
  } catch (err) {
    if (err instanceof ProviderConfigError) {
      onProgress({ type: "error", message: err.message });
      throw err;
    }
    throw err;
  }

  const route = planSpecialistRoute(opts.question);
  onProgress({
    type: "status",
    message: `Routing: ${route.specialists.join(", ")} → Chairman`,
  });

  const context = await retrieveMentorContext(opts.db, opts.ownerUserId, {
    query: opts.question,
    businessId: opts.businessId || null,
    includeFinance: route.includeFinance,
  });

  const finance = route.includeFinance ? buildFinanceSnapshot(context.financial) : null;
  const memoryBlock = formatMemoryContext(context, finance);

  onProgress({ type: "status", message: "Memuat Phase 4 operational intelligence…" });
  let intelligenceBlock = "";
  try {
    const pack = await buildIntelligencePack(
      opts.db,
      opts.ownerUserId,
      opts.businessId || context.businessId,
      "last_30_days",
    );
    intelligenceBlock = formatIntelligencePackForPrompt(pack);
  } catch (err) {
    intelligenceBlock = `PHASE 4 OPERATIONAL INTELLIGENCE: gagal dimuat (${err instanceof Error ? err.message : "error"}). Jangan mengarang pengganti.`;
  }

  const historyBlock =
    opts.history && opts.history.length
      ? "RIWAYAT PERCAKAPAN (ringkas):\n" +
        opts.history
          .slice(-8)
          .map((m) => `${m.role.toUpperCase()}: ${m.content.slice(0, 1200)}`)
          .join("\n")
      : "";

  const chatCorpus = [
    ...(opts.history || []).filter((m) => m.role === "user").map((m) => m.content),
    opts.question,
  ].join("\n");
  const ownerFigures = extractOwnerStatedFigures(chatCorpus);
  const ownerFiguresBlock = formatOwnerStatedFiguresForPrompt(ownerFigures);

  const baseUser = [
    memoryBlock,
    intelligenceBlock,
    historyBlock,
    ownerFiguresBlock,
    `PERTANYAAN OWNER:\n${opts.question}`,
    ownerFigures.length
      ? "Owner sudah memberi angka di chat. Analisis bersyarat dengan angka itu (estimate percakapan). Jangan mengarang angka lain. Jangan ulang minta data yang sudah disebut."
      : "Jangan mengarang data. Utamakan angka dari Phase 4 intelligence pack dan Financial Memory. Jika missing, sebutkan dan tanya owner.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const specialistOutputs: AgentRunOutput[] = [];
  const usageParts: ProviderUsage[] = [];

  for (const specialist of route.specialists) {
    onProgress({
      type: "specialist_start",
      specialist,
      label: LABELS[specialist],
      message: `${LABELS[specialist]} menganalisis…`,
    });
    try {
      const out = await runSpecialist(provider, specialist, baseUser, locale);
      specialistOutputs.push(out);
      usageParts.push(out.usage);
      await logMentorUsage(opts.db, {
        ownerUserId: opts.ownerUserId,
        conversationId: opts.conversationId,
        specialist,
        usage: out.usage,
        success: true,
      });
      onProgress({
        type: "specialist_done",
        specialist,
        label: LABELS[specialist],
        message: `${LABELS[specialist]} selesai`,
      });
    } catch (err) {
      const code = err instanceof ProviderRuntimeError ? err.code : "specialist_error";
      const message = err instanceof Error ? err.message : "Specialist failed";
      await logMentorUsage(opts.db, {
        ownerUserId: opts.ownerUserId,
        conversationId: opts.conversationId,
        specialist,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostUsd: 0,
          provider: provider.id,
          model: provider.model,
        },
        success: false,
        errorCode: code,
      });
      onProgress({ type: "error", specialist, message });
      // Continue with other specialists; chairman will note failures
      specialistOutputs.push({
        specialist,
        label: LABELS[specialist],
        analysis: `(Spesialis gagal: ${message})`,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostUsd: 0,
          provider: provider.id,
          model: provider.model,
        },
      });
    }
  }

  const peerNotes = specialistOutputs
    .map((s) => `### ${s.label}\n${s.analysis}`)
    .join("\n\n");

  onProgress({
    type: "specialist_start",
    specialist: "chairman",
    label: LABELS.chairman,
    message: "Chairman Agent menyusun rekomendasi akhir…",
  });

  const chairmanUser = [
    baseUser,
    "CATATAN SPESIALIS (hanya yang benar-benar dijalankan):",
    peerNotes || "(tidak ada spesialis domain — jawab langsung sebagai Chairman)",
    route.complex
      ? "Susun jawaban final terstruktur untuk pertanyaan kompleks."
      : "Jawab final singkat dan langsung.",
  ].join("\n\n");

  let reply = "";
  let chairmanUsage: ProviderUsage = {
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
    provider: provider.id,
    model: provider.model,
  };

  try {
    if (opts.streamFinal && provider.stream) {
      const result = await provider.stream({
        system: buildChairmanSystem(route.complex, locale),
        messages: [{ role: "user", content: chairmanUser }],
        temperature: 0.35,
        handlers: {
          onText: (chunk) => onProgress({ type: "token", text: chunk }),
        },
      });
      reply = result.text;
      chairmanUsage = result.usage;
    } else {
      const result = await provider.complete({
        system: buildChairmanSystem(route.complex, locale),
        messages: [{ role: "user", content: chairmanUser }],
        temperature: 0.35,
      });
      reply = result.text;
      chairmanUsage = result.usage;
      onProgress({ type: "token", text: reply });
    }
    usageParts.push(chairmanUsage);
    await logMentorUsage(opts.db, {
      ownerUserId: opts.ownerUserId,
      conversationId: opts.conversationId,
      specialist: "chairman",
      usage: chairmanUsage,
      success: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chairman failed";
    await logMentorUsage(opts.db, {
      ownerUserId: opts.ownerUserId,
      conversationId: opts.conversationId,
      specialist: "chairman",
      usage: chairmanUsage,
      success: false,
      errorCode: err instanceof ProviderRuntimeError ? err.code : "chairman_error",
    });
    throw err instanceof Error ? err : new Error(message);
  }

  onProgress({
    type: "specialist_done",
    specialist: "chairman",
    label: LABELS.chairman,
  });

  const briefs: SpecialistBrief[] = [
    ...specialistOutputs.map((s) => ({
      id: s.specialist,
      label: s.label,
      ran: true,
      summary: s.analysis.slice(0, 280),
      usage: s.usage,
    })),
    {
      id: "chairman",
      label: LABELS.chairman,
      ran: true,
      summary: reply.slice(0, 280),
      usage: chairmanUsage,
    },
  ];

  const missingUi: string[] = [];
  if (ownerFigures.length) {
    missingUi.push(
      "Angka dipakai dari chat (estimate). Simpan ke Memori → Catatan Keuangan agar jadi data resmi.",
    );
    if (!context.financial.length) {
      /* skip harsh "Actual revenue belum tersedia" when chat figures already supplied */
    } else {
      missingUi.push(...(finance?.missing || []).filter((m) => !/belum tersedia/i.test(m)));
    }
  } else {
    missingUi.push(...context.missing, ...(finance?.missing || []));
  }

  const result: OrchestratorResult = {
    reply,
    specialists: briefs,
    sourcesUsed: [
      ...context.sourcesUsed,
      ...(ownerFigures.length ? ["owner_stated_in_chat"] : []),
    ],
    missing: missingUi,
    usage: sumUsage(usageParts),
    businessId: context.businessId,
    complex: route.complex,
    routeReasons: route.reasons,
  };

  onProgress({ type: "done", message: "Selesai" });
  return result;
}
