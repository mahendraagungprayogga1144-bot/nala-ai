import { retrieveMentorContext } from "../../memory-retrieval";
import { buildIntelligencePack } from "../../intelligence/pack";
import { buildFinanceSnapshot } from "../../finance/calculations";
import { listPortfolioBusinesses } from "../../portfolio-service";
import { proposeAction } from "../../actions/action-service";
import { proposeMemoryCandidate } from "../../memory-candidates-service";
import { registerTool } from "../tool-registry";

let registered = false;

/** Idempotent builtin tool registration. */
export function registerBuiltinTools() {
  if (registered) return;
  registered = true;

  registerTool({
    name: "memory.retrieve",
    description: "Ambil Business Memory relevan untuk query owner.",
    permissionLevel: 0,
    risk: "low",
    requiresApproval: false,
    businessScoped: true,
    inputSchema: { query: "string", businessId: "uuid?" },
    outputSchema: { topics: "string[]", sourcesUsed: "string[]", missing: "string[]" },
    handler: async (ctx, input) => {
      const pack = await retrieveMentorContext(ctx.db, ctx.ownerUserId, {
        query: String(input.query || "bisnis"),
        businessId: (input.businessId as string) || ctx.businessId || null,
        includeFinance: true,
      });
      return {
        topics: pack.topics,
        sourcesUsed: pack.sourcesUsed,
        missing: pack.missing,
        businessId: pack.businessId,
        hitCount: pack.hits.length,
        note: pack.note,
      };
    },
  });

  registerTool({
    name: "intelligence.pack",
    description: "Muat Phase 4 operational intelligence pack (Gercep facts).",
    permissionLevel: 0,
    risk: "low",
    requiresApproval: false,
    businessScoped: true,
    inputSchema: { businessId: "uuid?", period: "string?" },
    outputSchema: { summary: "object", missing: "string[]" },
    handler: async (ctx, input) => {
      const pack = await buildIntelligencePack(
        ctx.db,
        ctx.ownerUserId,
        (input.businessId as string) || ctx.businessId || null,
        (input.period as "last_7_days" | "last_30_days") || "last_30_days",
      );
      return {
        linked: pack.linked,
        notices: pack.notices || [],
        missing: pack.missing || [],
        performance: pack.performance ? { ok: true } : { ok: false },
        risks: Array.isArray(pack.risks) ? pack.risks.length : 0,
      };
    },
  });

  registerTool({
    name: "finance.snapshot",
    description: "Hitung snapshot keuangan dari Financial Memory saja.",
    permissionLevel: 0,
    risk: "low",
    requiresApproval: false,
    businessScoped: true,
    inputSchema: { businessId: "uuid?" },
    outputSchema: { missing: "string[]", evidence: "string[]" },
    handler: async (ctx, input) => {
      const pack = await retrieveMentorContext(ctx.db, ctx.ownerUserId, {
        query: "keuangan revenue cash",
        businessId: (input.businessId as string) || ctx.businessId || null,
        includeFinance: true,
      });
      const snap = buildFinanceSnapshot(pack.financial);
      return {
        currency: snap.currency,
        missing: snap.missing,
        evidence: snap.evidence.slice(0, 8),
        derived: snap.derived,
      };
    },
  });

  registerTool({
    name: "portfolio.list",
    description: "Daftar bisnis di portfolio owner.",
    permissionLevel: 0,
    risk: "low",
    requiresApproval: false,
    businessScoped: false,
    inputSchema: {},
    outputSchema: { count: "number", businesses: "array" },
    handler: async (ctx) => {
      const { rows, notice } = await listPortfolioBusinesses(ctx.db, ctx.ownerUserId);
      return {
        count: rows.length,
        notice,
        businesses: rows.map((b) => ({ id: b.id, name: b.name, status: b.status, category: b.category })),
      };
    },
  });

  registerTool({
    name: "report.prepare_briefing",
    description: "Susun draft ringkasan internal (tidak dikirim keluar).",
    permissionLevel: 1,
    risk: "low",
    requiresApproval: false,
    businessScoped: true,
    inputSchema: { focus: "string?" },
    outputSchema: { draft: "string" },
    handler: async (ctx, input) => {
      const focus = String(input.focus || "ringkasan operasional");
      const mem = await retrieveMentorContext(ctx.db, ctx.ownerUserId, {
        query: focus,
        businessId: ctx.businessId || null,
        includeFinance: true,
      });
      const draft = [
        `Draft briefing HENIMA — ${new Date().toISOString().slice(0, 10)}`,
        `Fokus: ${focus}`,
        `Bisnis: ${mem.business?.name || ctx.businessId || "—"}`,
        `Sumber: ${mem.sourcesUsed.join(", ") || "kosong"}`,
        `Missing: ${mem.missing.join("; ") || "—"}`,
        "Status: DRAFT INTERNAL — belum dikirim ke siapapun.",
      ].join("\n");
      return { draft, sourcesUsed: mem.sourcesUsed };
    },
  });

  registerTool({
    name: "action.propose_recommendation",
    description: "Usulkan rekomendasi ke Phase 5 Approval Center (pending).",
    permissionLevel: 1,
    risk: "medium",
    requiresApproval: false,
    businessScoped: true,
    inputSchema: { title: "string", description: "string", risk_level: "string?" },
    outputSchema: { actionId: "uuid" },
    handler: async (ctx, input) => {
      const action = await proposeAction(ctx.db, ctx.ownerUserId, {
        business_id: ctx.businessId || null,
        conversation_id: null,
        action_type: "note_recommendation",
        title: String(input.title || "Rekomendasi Autonomous Assistant").slice(0, 200),
        description: String(input.description || "").slice(0, 4000),
        business_context: "Phase 7 autonomous task",
        expected_impact: "Menunggu keputusan owner.",
        risk_level: (input.risk_level as "low" | "medium" | "high") || "medium",
        requested_permissions: ["WRITE"],
        payload: { source: "phase7_autonomy" },
        evidence: ["autonomous_assistant"],
        source: "system",
        expires_in_hours: 168,
      });
      return { actionId: action.id, status: action.status };
    },
  });

  registerTool({
    name: "action.propose_decision",
    description: "Usulkan kandidat keputusan ke memory candidates (pending).",
    permissionLevel: 1,
    risk: "medium",
    requiresApproval: false,
    businessScoped: true,
    inputSchema: { title: "string", description: "string" },
    outputSchema: { candidateId: "uuid?" },
    handler: async (ctx, input) => {
      if (!ctx.businessId) return { candidateId: null, notice: "business_id wajib" };
      const cand = await proposeMemoryCandidate(ctx.db, ctx.ownerUserId, {
        business_id: ctx.businessId,
        memory_kind: "decision",
        classification: "recommendation",
        proposed_payload: {
          title: String(input.title || "Keputusan dari Autonomous Assistant").slice(0, 120),
          description: String(input.description || "").slice(0, 2000),
          reasoning: "Dihasilkan Phase 7 task planner.",
          expected_outcome: "",
          risks: "",
          decision_date: new Date().toISOString().slice(0, 10),
        },
        source_ref: `auto_task:${ctx.taskId || "unknown"}`,
      });
      return { candidateId: cand.id };
    },
  });

  registerTool({
    name: "external.message_draft",
    description: "Siapkan draft pesan eksternal → Approval Center (tidak auto-kirim).",
    permissionLevel: 2,
    risk: "high",
    requiresApproval: true,
    businessScoped: true,
    inputSchema: { title: "string", body: "string", channel: "string?" },
    outputSchema: { actionId: "uuid" },
    handler: async (ctx, input) => {
      const action = await proposeAction(ctx.db, ctx.ownerUserId, {
        business_id: ctx.businessId || null,
        conversation_id: null,
        action_type: "external_message_draft",
        title: String(input.title || "Draft pesan eksternal").slice(0, 200),
        description: String(input.body || "").slice(0, 4000),
        business_context: `channel=${input.channel || "whatsapp"}`,
        expected_impact: "Draft saja — kirim hanya setelah owner approve + eksekusi terpisah.",
        risk_level: "high",
        requested_permissions: ["EXTERNAL_MESSAGE"],
        payload: {
          channel: input.channel || "whatsapp",
          body: String(input.body || ""),
          source: "phase7_autonomy",
        },
        evidence: ["autonomous_assistant"],
        source: "system",
        expires_in_hours: 72,
      });
      return { actionId: action.id, status: "pending_approval", autoSent: false };
    },
  });

  registerTool({
    name: "financial.memory_write_propose",
    description: "Usulkan tulis Financial Memory (estimate) via Approval Center.",
    permissionLevel: 2,
    risk: "high",
    requiresApproval: true,
    businessScoped: true,
    inputSchema: { metric_type: "string", amount: "number", description: "string?" },
    outputSchema: { actionId: "uuid" },
    handler: async (ctx, input) => {
      if (!ctx.businessId) return { actionId: null, notice: "business_id wajib" };
      const action = await proposeAction(ctx.db, ctx.ownerUserId, {
        business_id: ctx.businessId,
        conversation_id: null,
        action_type: "financial_memory_write",
        title: `Tulis financial: ${input.metric_type}`,
        description: String(input.description || "Usulan dari Autonomous Assistant"),
        business_context: "Phase 7",
        expected_impact: "Menambah Financial Memory setelah approve.",
        risk_level: "high",
        requested_permissions: ["WRITE"],
        payload: {
          metric_type: input.metric_type,
          amount: Number(input.amount),
          currency: "IDR",
          certainty: "estimate",
          transaction_date: new Date().toISOString().slice(0, 10),
          description: String(input.description || ""),
          transaction_category: "autonomy_propose",
        },
        evidence: ["autonomous_assistant"],
        source: "system",
        expires_in_hours: 168,
      });
      return { actionId: action.id, status: "pending_approval" };
    },
  });

  registerTool({
    name: "report.run_internal_summary",
    description: "Level 3: buat ringkasan internal terjadwal (tanpa kirim eksternal).",
    permissionLevel: 3,
    risk: "low",
    requiresApproval: false,
    businessScoped: true,
    inputSchema: {},
    outputSchema: { summary: "string" },
    handler: async (ctx) => {
      const mem = await retrieveMentorContext(ctx.db, ctx.ownerUserId, {
        query: "ringkasan bisnis",
        businessId: ctx.businessId || null,
        includeFinance: true,
      });
      return {
        summary: `Internal summary ${new Date().toISOString()}: bisnis=${mem.business?.name || "—"}; sumber=${mem.sourcesUsed.join(",") || "none"}; missing=${mem.missing.length}`,
        verified: true,
      };
    },
  });

  registerTool({
    name: "reminder.create_internal",
    description: "Level 3: buat pengingat internal (disimpan sebagai rekomendasi pending).",
    permissionLevel: 3,
    risk: "low",
    requiresApproval: false,
    businessScoped: true,
    inputSchema: { text: "string" },
    outputSchema: { actionId: "uuid" },
    handler: async (ctx, input) => {
      const action = await proposeAction(ctx.db, ctx.ownerUserId, {
        business_id: ctx.businessId || null,
        conversation_id: null,
        action_type: "note_recommendation",
        title: "Pengingat internal Autonomous Assistant",
        description: String(input.text || "Pengingat").slice(0, 2000),
        business_context: "level3_reminder",
        expected_impact: "Internal only",
        risk_level: "low",
        requested_permissions: ["WRITE"],
        payload: { kind: "internal_reminder" },
        evidence: ["autonomous_assistant"],
        source: "system",
        expires_in_hours: 168,
      });
      return { actionId: action.id };
    },
  });

  registerTool({
    name: "data.check_scheduled_health",
    description: "Level 3: cek kesehatan data (memory + missing signals).",
    permissionLevel: 3,
    risk: "low",
    requiresApproval: false,
    businessScoped: true,
    inputSchema: {},
    outputSchema: { healthy: "boolean", issues: "string[]" },
    handler: async (ctx) => {
      const mem = await retrieveMentorContext(ctx.db, ctx.ownerUserId, {
        query: "keuangan stok risiko",
        businessId: ctx.businessId || null,
        includeFinance: true,
      });
      const issues = [...mem.missing];
      if (!mem.business) issues.push("Business memory kosong");
      return { healthy: issues.length === 0, issues, sourcesUsed: mem.sourcesUsed };
    },
  });
}
