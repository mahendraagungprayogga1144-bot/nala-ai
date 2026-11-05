import type { SupabaseClient } from "@supabase/supabase-js";
import { buildChairmanSystem, buildSpecialistSystem } from "../agents/prompts";
import { looksTruncatedReply, toPlainChatText } from "../chat/plain-text";
import type { AgentRunOutput, SpecialistBrief, SpecialistId } from "../agents/types";
import { buildFinanceSnapshot } from "../finance/calculations";
import type { MentorLocale } from "../i18n";
import { retrieveMentorContext } from "../memory-retrieval";
import { assertAnalyzeOnly } from "../permissions";
import { getMentorProviderConfig } from "../providers/config";
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
  chairman: "Mentor",
  strategy: "Strategi",
  cfo: "Keuangan",
  growth: "Growth",
  operations: "Operasi",
  risk: "Risiko",
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
    maxTokens: 1600,
    timeoutMs: 40_000,
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

  onProgress({ type: "status", message: "Menyiapkan provider AI…" });
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
  // Cap fan-out: sequential Opus calls were timing out on Hobby before any reply.
  const specialistsToRun = route.specialists.slice(0, 2);
  onProgress({
    type: "status",
    message: specialistsToRun.length
      ? `Lagi lihat: ${specialistsToRun.map((s) => LABELS[s]).join(", ")}…`
      : "Mentor lagi ngetik…",
  });

  onProgress({ type: "status", message: "Baca memori bisnis…" });
  const context = await retrieveMentorContext(opts.db, opts.ownerUserId, {
    query: opts.question,
    businessId: opts.businessId || null,
    includeFinance: route.includeFinance,
  });

  const finance = route.includeFinance ? buildFinanceSnapshot(context.financial) : null;
  const memoryBlock = formatMemoryContext(context, finance);

  onProgress({ type: "status", message: "Cek angka operasional…" });
  let intelligenceBlock = "";
  try {
    const intelPromise = buildIntelligencePack(
      opts.db,
      opts.ownerUserId,
      opts.businessId || context.businessId,
      "last_30_days",
    );
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 10_000);
    });
    const pack = await Promise.race([intelPromise, timeoutPromise]);
    if (!pack) {
      intelligenceBlock =
        "PHASE 4 OPERATIONAL INTELLIGENCE: timeout 10s. Lanjut dengan Financial Memory + angka chat saja — jangan mengarang.";
    } else {
      intelligenceBlock = formatIntelligencePackForPrompt(pack);
    }
  } catch (err) {
    intelligenceBlock = `PHASE 4 OPERATIONAL INTELLIGENCE: gagal (${err instanceof Error ? err.message : "error"}). Lanjut dengan Financial Memory + angka chat saja — jangan mengarang.`;
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

  // Run domain specialists in parallel (was sequential → multi-minute hangs).
  await Promise.all(
    specialistsToRun.map(async (specialist) => {
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
    }),
  );

  const peerNotes = specialistOutputs
    .map((s) => `### ${s.label}\n${s.analysis}`)
    .join("\n\n");

  onProgress({
    type: "specialist_start",
    specialist: "chairman",
    label: LABELS.chairman,
    message: "Mentor lagi ngetik…",
  });

  const chairmanUser = [
    baseUser,
    "CATATAN TIM (kalau ada):",
    peerNotes || "(tidak ada catatan tim — jawab langsung sebagai mentor)",
    route.complex
      ? "Jawab gaya chat dengan struktur ringan (inti → angka → rekomendasi → risiko)."
      : "Jawab singkat seperti chat WhatsApp — enak dibaca.",
  ].join("\n\n");

  let reply = "";
  let chairmanUsage: ProviderUsage = {
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
    provider: provider.id,
    model: provider.model,
  };

  const providerCfg = getMentorProviderConfig();
  const chairmanMaxTokens = Math.max(providerCfg.maxTokens || 4096, 3200);
  const chairmanTimeoutMs = Math.max(providerCfg.timeoutMs || 55_000, 90_000);
  const chairmanSystem = buildChairmanSystem(route.complex, locale);

  try {
    if (opts.streamFinal && provider.stream) {
      const result = await provider.stream({
        system: chairmanSystem,
        messages: [{ role: "user", content: chairmanUser }],
        temperature: 0.35,
        maxTokens: chairmanMaxTokens,
        timeoutMs: chairmanTimeoutMs,
        handlers: {
          onText: (chunk) => onProgress({ type: "token", text: chunk }),
        },
      });
      reply = result.text;
      chairmanUsage = result.usage;
    } else {
      const result = await provider.complete({
        system: chairmanSystem,
        messages: [{ role: "user", content: chairmanUser }],
        temperature: 0.35,
        maxTokens: chairmanMaxTokens,
        timeoutMs: chairmanTimeoutMs,
      });
      reply = result.text;
      chairmanUsage = result.usage;
      onProgress({ type: "token", text: reply });
    }

    // One continuation if the model cut mid-list / mid-sentence (mentor must finish).
    if (looksTruncatedReply(reply)) {
      onProgress({ type: "status", message: "Mentor menyelesaikan jawaban…" });
      const cont = await provider.complete({
        system: chairmanSystem,
        messages: [
          { role: "user", content: chairmanUser },
          { role: "assistant", content: reply },
          {
            role: "user",
            content:
              "Lanjutkan persis dari potongan terakhir. Jangan ulangi yang sudah ditulis. Selesaikan semua poin sampai tuntas. Plain text saja, tanpa markdown.",
          },
        ],
        temperature: 0.3,
        maxTokens: 1800,
        timeoutMs: chairmanTimeoutMs,
      });
      if (cont.text.trim()) {
        const extra = cont.text.trim();
        reply = `${reply.trimEnd()}\n${extra}`;
        onProgress({ type: "token", text: `\n${extra}` });
        chairmanUsage = sumUsage([chairmanUsage, cont.usage]);
      }
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

  // Keep missing for internal/API use — do not dump UUID/jargon into chat UI.
  const missingUi: string[] = [];
  if (!ownerFigures.length) {
    missingUi.push(
      ...context.missing.filter((m) => !/uuid|business:|owner_stated/i.test(m)),
      ...(finance?.missing || []).filter((m) => !/belum tersedia|uuid/i.test(m)),
    );
  }

  const result: OrchestratorResult = {
    reply: toPlainChatText(reply),
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
