import {
  callOpenSeoTool,
  getOpenSeoConfig,
  isOpenSeoConfigured,
  resolveOpenSeoProjectId,
} from "./openseo-client";

export type SeoBrief = {
  configured: boolean;
  domain: string;
  projectId: string | null;
  sourcesUsed: string[];
  missing: string[];
  summary: string;
};

const SEO_HINT =
  /seo|keyword|ranking|rank|backlink|serp|search console|google|trafik organik|organic|domain authority|kompetitor web|iklan search|adsense|semrush|ahrefs|openseo|gercepos\.id|landing page|meta title|konten blog/i;

export function wantsSeoContext(question: string) {
  return SEO_HINT.test(question);
}

/** Ringkas fakta OpenSEO buat prompt HENIMA AI (aman kalau gagal/timeout). */
export async function buildSeoBrief(opts?: {
  question?: string;
  seeds?: string[];
  timeoutMs?: number;
}): Promise<SeoBrief> {
  const cfg = getOpenSeoConfig();
  if (!cfg) {
    return {
      configured: false,
      domain: "gercepos.id",
      projectId: null,
      sourcesUsed: [],
      missing: ["OPENSEO_API_KEY belum di-set — HENIMA AI belum nyambung OpenSEO"],
      summary: "",
    };
  }

  const sourcesUsed: string[] = [];
  const missing: string[] = [];
  const parts: string[] = [];
  const projectId = await resolveOpenSeoProjectId();
  if (!projectId) {
    missing.push("OpenSEO project belum ketemu — set OPENSEO_PROJECT_ID atau buat project di OpenSEO");
    return {
      configured: true,
      domain: cfg.domain,
      projectId: null,
      sourcesUsed,
      missing,
      summary: "",
    };
  }

  const seeds = (opts?.seeds?.length
    ? opts.seeds
    : extractSeeds(opts?.question || "", cfg.domain)
  ).slice(0, 3);

  const overview = await callOpenSeoTool(
    "get_domain_overview",
    { projectId, domain: cfg.domain },
    opts?.timeoutMs || 18_000,
  );
  if (overview.ok && overview.text) {
    sourcesUsed.push("openseo:get_domain_overview");
    parts.push(`DOMAIN ${cfg.domain}:\n${overview.text.slice(0, 2500)}`);
  } else if (!overview.ok) {
    missing.push(`domain overview: ${overview.error}`);
  }

  if (seeds.length) {
    const kw = await callOpenSeoTool(
      "research_keywords",
      {
        projectId,
        seeds: seeds.map((seed) => ({ seed })),
      },
      opts?.timeoutMs || 22_000,
    );
    if (kw.ok && kw.text) {
      sourcesUsed.push("openseo:research_keywords");
      parts.push(`KEYWORD SEEDS (${seeds.join(", ")}):\n${kw.text.slice(0, 2800)}`);
    } else if (!kw.ok) {
      missing.push(`keyword research: ${kw.error}`);
    }
  }

  const backlinks = await callOpenSeoTool(
    "get_backlinks_overview",
    { projectId, target: cfg.domain },
    opts?.timeoutMs || 18_000,
  );
  if (backlinks.ok && backlinks.text) {
    sourcesUsed.push("openseo:get_backlinks_overview");
    parts.push(`BACKLINKS ${cfg.domain}:\n${backlinks.text.slice(0, 1800)}`);
  } else if (!backlinks.ok) {
    // soft — banyak akun belum punya data backlink
    missing.push(`backlinks: ${backlinks.error}`);
  }

  return {
    configured: true,
    domain: cfg.domain,
    projectId,
    sourcesUsed,
    missing,
    summary: parts.join("\n\n").slice(0, 7000),
  };
}

export function formatSeoBriefForPrompt(brief: SeoBrief): string {
  if (!brief.configured) {
    return "OPENSEO: belum dikonfigurasi. Jangan mengarang data SEO. Saran tetap boleh umum tanpa angka volume/KD palsu.";
  }
  if (!brief.summary) {
    return [
      "OPENSEO: terkoneksi tapi data kosong / gagal diambil.",
      brief.missing.length ? `Missing: ${brief.missing.join("; ")}` : "",
      "Jangan mengarang volume keyword / ranking. Beri saran SEO praktis bersyarat.",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    "FAKTA OPENSEO (sumber live — jangan mengarang angka di luar ini):",
    `Domain fokus: ${brief.domain}`,
    brief.summary,
    brief.missing.length ? `Catatan missing: ${brief.missing.join("; ")}` : "",
    "Pakai fakta ini untuk saran growth/SEO HENIMA. Kalau kurang, bilang jujur.",
  ]
    .filter(Boolean)
    .join("\n");
}

function extractSeeds(question: string, domain: string): string[] {
  const seeds = new Set<string>();
  const quoted = [...question.matchAll(/"([^"]{2,60})"/g)].map((m) => m[1].trim());
  for (const q of quoted) seeds.add(q);
  // Kata kunci umum HENIMA / Gercep kalau owner tanya SEO generik.
  if (/henima|parfum|perfume/i.test(question)) {
    seeds.add("parfum henima");
    seeds.add("henima perfume");
  }
  if (/gercep|pos|kasir/i.test(question)) {
    seeds.add("aplikasi kasir");
    seeds.add("gercep os");
  }
  if (!seeds.size) {
    seeds.add(domain.replace(/^www\./, ""));
    seeds.add("henima");
  }
  return [...seeds].slice(0, 3);
}

export { isOpenSeoConfigured };
