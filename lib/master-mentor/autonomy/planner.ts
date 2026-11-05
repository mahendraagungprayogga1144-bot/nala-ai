import type { AutonomyLevel, TaskPlan } from "./types";

/**
 * Deterministic task planner (no free-form LLM tool inventing).
 * Maps owner goals to registered tools only.
 */
export function planFromGoal(goal: string, maxLevel: AutonomyLevel): TaskPlan {
  const g = (goal || "").toLowerCase();
  const steps: TaskPlan["steps"] = [];

  steps.push({
    title: "Ambil konteks Business Memory",
    tool_name: "memory.retrieve",
    specialist: "chairman",
    input: { query: goal.slice(0, 500) },
  });

  const wantsFinance = /omzet|laba|profit|kas|cash|keuangan|margin|bep|untung|revenue|cogs/i.test(g);
  const wantsSales = /penjualan|sales|minggu|bulan|order|conversion|growth/i.test(g);
  const wantsStock = /stok|inventory|pabrik|v1|v2|sampel/i.test(g);
  const wantsMessage = /kirim|whatsapp|wa |pesan|follow.?up pelanggan/i.test(g);
  const wantsWriteFin = /catat keuangan|simpan angka|tulis financial/i.test(g);

  steps.push({
    title: "Daftar portfolio bisnis",
    tool_name: "portfolio.list",
    specialist: "operations",
  });

  if (wantsFinance || wantsSales || wantsStock || /analisis|analisa|tingkatkan|naikkan/.test(g)) {
    steps.push({
      title: "Muat intelligence operasional Phase 4",
      tool_name: "intelligence.pack",
      specialist: "cfo",
    });
  }

  if (wantsFinance) {
    steps.push({
      title: "Snapshot Financial Memory",
      tool_name: "finance.snapshot",
      specialist: "cfo",
    });
  }

  if (maxLevel >= 1) {
    steps.push({
      title: "Susun draft briefing internal",
      tool_name: "report.prepare_briefing",
      specialist: "strategy",
      input: { focus: goal.slice(0, 300) },
    });
    steps.push({
      title: "Usulkan rekomendasi ke Approval Center",
      tool_name: "action.propose_recommendation",
      specialist: "chairman",
      input: {
        title: `Rekomendasi: ${goal.slice(0, 80)}`,
        description: `Hasil perencanaan Autonomous Assistant untuk: ${goal.slice(0, 1500)}`,
        risk_level: wantsMessage || wantsWriteFin ? "high" : "medium",
      },
    });
  }

  if (maxLevel >= 1 && /keputusan|putuskan|pilih/.test(g)) {
    steps.push({
      title: "Usulkan kandidat keputusan",
      tool_name: "action.propose_decision",
      specialist: "strategy",
      input: { title: goal.slice(0, 100), description: goal.slice(0, 1500) },
    });
  }

  if (maxLevel >= 2 && wantsMessage) {
    steps.push({
      title: "Draft pesan eksternal (butuh approval)",
      tool_name: "external.message_draft",
      specialist: "growth",
      input: {
        title: "Draft follow-up pelanggan",
        body: `Draft terkait: ${goal.slice(0, 800)}`,
        channel: "whatsapp",
      },
    });
  }

  if (maxLevel >= 2 && wantsWriteFin) {
    steps.push({
      title: "Usulkan tulis Financial Memory (butuh approval)",
      tool_name: "financial.memory_write_propose",
      specialist: "cfo",
      input: {
        metric_type: "revenue",
        amount: 0,
        description: `Usulan dari goal: ${goal.slice(0, 200)} — isi amount di Approval Center`,
      },
    });
  }

  if (maxLevel >= 3) {
    steps.push({
      title: "Pemeriksaan kesehatan data (level 3)",
      tool_name: "data.check_scheduled_health",
      specialist: "operations",
    });
  }

  let permission_level: AutonomyLevel = 0;
  for (const s of steps) {
    // inferred from tool names
    if (s.tool_name.startsWith("report.run") || s.tool_name.startsWith("reminder.") || s.tool_name.startsWith("data.check")) {
      permission_level = Math.max(permission_level, 3) as AutonomyLevel;
    } else if (s.tool_name.startsWith("external.") || s.tool_name.startsWith("financial.memory")) {
      permission_level = Math.max(permission_level, 2) as AutonomyLevel;
    } else if (s.tool_name.startsWith("action.") || s.tool_name.startsWith("report.prepare")) {
      permission_level = Math.max(permission_level, 1) as AutonomyLevel;
    }
  }

  // Cap to owner max
  permission_level = Math.min(permission_level, maxLevel) as AutonomyLevel;

  const risk_level =
    permission_level >= 2 ? "high" : permission_level === 1 ? "medium" : "low";

  return {
    summary: `Rencana untuk: ${goal.slice(0, 200)} (${steps.length} langkah, level ≤ ${maxLevel})`,
    permission_level,
    risk_level,
    steps: steps.slice(0, 12),
  };
}
