import { NextResponse } from "next/server";
import { withMentorOwner } from "@/lib/master-mentor/authz";
import {
  compareBusinesses,
  loadBusinessFacts,
  buildBusinessReport,
  buildFinancialIntelligence,
  buildGrowthIntelligence,
  buildInventoryIntelligence,
  buildPeopleAnalytics,
  buildPerformanceAnalytics,
  buildRiskAlerts,
  parsePeriodParam,
  resolveIntelligencePeriod,
  resolveLinkedBusiness,
  type IntelligencePeriod,
  type ReportKind,
} from "@/lib/master-mentor/intelligence";
import { writeAudit } from "@/lib/master-mentor/audit";
import { MentorValidationError } from "@/lib/master-mentor/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODULES = [
  "performance",
  "financial",
  "growth",
  "people",
  "inventory",
  "risk",
  "comparison",
  "report",
] as const;

type ModuleName = (typeof MODULES)[number];

export async function GET(request: Request) {
  return withMentorOwner(async ({ owner, db }) => {
    const url = new URL(request.url);
    const module = (url.searchParams.get("module") || "performance") as ModuleName;
    if (!(MODULES as readonly string[]).includes(module)) {
      return NextResponse.json(
        { error: `Module tidak valid. Pilih: ${MODULES.join(", ")}` },
        { status: 400 },
      );
    }

    const period = parsePeriodParam(url.searchParams.get("period"));
    const from = url.searchParams.get("from") || undefined;
    const to = url.searchParams.get("to") || undefined;

    try {
      if (module === "comparison") {
        const ids = (url.searchParams.get("businessIds") || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (!ids.length) {
          throw new MentorValidationError("businessIds wajib (pisahkan dengan koma).");
        }
        const result = await compareBusinesses(db, owner.userId, ids, period, { from, to });
        await writeAudit(db, {
          ownerUserId: owner.userId,
          entityType: "intelligence",
          entityId: "comparison",
          action: "update",
          summary: `comparison ${ids.length} businesses period=${period}`,
        });
        return { module, period, ...result };
      }

      const businessId = url.searchParams.get("businessId");
      if (!businessId) throw new MentorValidationError("businessId wajib.");

      const linked = await resolveLinkedBusiness(db, owner.userId, businessId);
      const window = resolveIntelligencePeriod(period as IntelligencePeriod, { from, to });
      const facts = await loadBusinessFacts(db, linked, window);

      if (module === "report") {
        const kind = (url.searchParams.get("kind") || "weekly") as ReportKind;
        const report = buildBusinessReport(facts, kind);
        return { module, linked: linked.linked, report };
      }

      const payload: Record<string, unknown> = {
        module,
        linked: linked.linked,
        business: {
          mentorBusinessId: linked.mentorBusinessId,
          mentorBusinessName: linked.mentorBusinessName,
          gercepBusinessId: linked.gercepBusinessId,
          gercepBusinessName: linked.gercepBusinessName,
        },
        period: window,
      };

      if (module === "performance") payload.data = buildPerformanceAnalytics(facts);
      if (module === "financial") payload.data = buildFinancialIntelligence(facts);
      if (module === "growth") payload.data = buildGrowthIntelligence(facts);
      if (module === "people") payload.data = buildPeopleAnalytics(facts);
      if (module === "inventory") payload.data = buildInventoryIntelligence(facts);
      if (module === "risk") payload.data = { alerts: buildRiskAlerts(facts) };

      await writeAudit(db, {
        ownerUserId: owner.userId,
        businessId: linked.mentorBusinessId,
        entityType: "intelligence",
        entityId: module,
        action: "update",
        summary: `${module} period=${window.kind} linked=${linked.linked}`,
      });

      return payload;
    } catch (err) {
      if (err instanceof MentorValidationError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
      }
      if (err instanceof Error && /custom date|tanggal/i.test(err.message)) {
        return NextResponse.json({ error: err.message, code: "validation_error" }, { status: 400 });
      }
      throw err;
    }
  });
}
