import type { SupabaseClient } from "@supabase/supabase-js";
import { updateBusinessMemory } from "../business-memory-service";
import { createDecision } from "../decision-memory-service";
import { createFinancialRecord, listFinancialRecords } from "../financial-memory-service";
import { createLearning } from "../learning-memory-service";
import { upsertOwnerMemory } from "../owner-memory-service";
import {
  createPortfolioBusiness,
  listPortfolioBusinesses,
  updatePortfolioBusiness,
} from "../portfolio-service";
import { createStrategy } from "../strategy-memory-service";
import {
  HENIMA_PACK_VERSION,
  henimaBusinessKnowledge,
  henimaDecision,
  henimaFinancialSeeds,
  henimaLearnings,
  henimaOwnerMemory,
  henimaPortfolio,
  henimaStrategy,
} from "./henima-perfume-pack";

export type SeedHenimaResult = {
  packVersion: string;
  businessId: string;
  createdBusiness: boolean;
  filled: {
    owner: boolean;
    business: boolean;
    financial: number;
    strategy: boolean;
    decision: boolean;
    learnings: number;
  };
  notes: string[];
};

/**
 * Fill Master Mentor memory with HENIMA Perfume pack (owner-triggered).
 * Idempotent-ish: skips financial metrics that already exist for the business.
 */
export async function applyHenimaPerfumePack(
  db: SupabaseClient,
  ownerUserId: string,
): Promise<SeedHenimaResult> {
  const today = new Date().toISOString().slice(0, 10);
  const notes: string[] = [];
  const filled = {
    owner: false,
    business: false,
    financial: 0,
    strategy: false,
    decision: false,
    learnings: 0,
  };

  await upsertOwnerMemory(db, ownerUserId, henimaOwnerMemory);
  filled.owner = true;

  const { rows: portfolio } = await listPortfolioBusinesses(db, ownerUserId);
  const existing =
    portfolio.find((b) => /henima/i.test(b.name)) ||
    portfolio.find((b) => b.category === "perfume") ||
    null;

  let businessId: string;
  let createdBusiness = false;

  if (existing) {
    businessId = existing.id;
    await updatePortfolioBusiness(db, ownerUserId, businessId, {
      name: henimaPortfolio.name,
      category: henimaPortfolio.category,
      description: henimaPortfolio.description,
      status: henimaPortfolio.status,
      targets: henimaPortfolio.targets,
      gercep_business_id: existing.gercep_business_id || null,
    });
    notes.push("Portofolio HENIMA Perfume diperbarui.");
  } else {
    const created = await createPortfolioBusiness(db, ownerUserId, henimaPortfolio);
    businessId = created.id;
    createdBusiness = true;
    notes.push("Portofolio HENIMA Perfume dibuat.");
  }

  await updateBusinessMemory(db, ownerUserId, businessId, henimaBusinessKnowledge(today));
  filled.business = true;

  const { rows: existingFin } = await listFinancialRecords(db, ownerUserId, { businessId });
  const haveMetric = new Set(existingFin.map((r) => r.metric_type));
  for (const seed of henimaFinancialSeeds(businessId, today)) {
    if (seed.amount === 0 && seed.transaction_category === "stok_v1_sampel") {
      // Skip zero-amount placeholder — stok sudah di business knowledge
      continue;
    }
    if (haveMetric.has(seed.metric_type)) {
      notes.push(`Financial ${seed.metric_type} sudah ada — dilewati.`);
      continue;
    }
    await createFinancialRecord(db, ownerUserId, seed);
    filled.financial += 1;
    haveMetric.add(seed.metric_type);
  }

  try {
    await createStrategy(db, ownerUserId, henimaStrategy(businessId));
    filled.strategy = true;
  } catch (err) {
    notes.push(`Strategy: ${err instanceof Error ? err.message : "gagal"}`);
  }

  try {
    await createDecision(db, ownerUserId, henimaDecision(businessId, today));
    filled.decision = true;
  } catch (err) {
    notes.push(`Decision: ${err instanceof Error ? err.message : "gagal"}`);
  }

  for (const lesson of henimaLearnings(businessId, today)) {
    try {
      await createLearning(db, ownerUserId, lesson);
      filled.learnings += 1;
    } catch (err) {
      notes.push(`Learning: ${err instanceof Error ? err.message : "gagal"}`);
    }
  }

  notes.push(`Pack ${HENIMA_PACK_VERSION} diterapkan.`);
  return {
    packVersion: HENIMA_PACK_VERSION,
    businessId,
    createdBusiness,
    filled,
    notes,
  };
}
