/**
 * Thin OpenSEO MCP client for HENIMA AI.
 * Env:
 * - OPENSEO_API_KEY (required) — Settings → API keys di OpenSEO
 * - OPENSEO_MCP_URL (optional) — default https://app.openseo.so/mcp
 * - OPENSEO_PROJECT_ID (optional) — project workspace; kalau kosong pakai project pertama
 * - OPENSEO_DOMAIN (optional) — domain fokus HENIMA, default gercepos.id
 */

export type OpenSeoConfig = {
  apiKey: string;
  mcpUrl: string;
  projectId: string | null;
  domain: string;
};

export function getOpenSeoConfig(): OpenSeoConfig | null {
  const apiKey = process.env.OPENSEO_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    mcpUrl: (process.env.OPENSEO_MCP_URL || "https://app.openseo.so/mcp").trim().replace(/\/$/, ""),
    projectId: process.env.OPENSEO_PROJECT_ID?.trim() || null,
    domain: (process.env.OPENSEO_DOMAIN || "gercepos.id").trim().replace(/^https?:\/\//, "").replace(/\/$/, ""),
  };
}

export function isOpenSeoConfigured() {
  return Boolean(getOpenSeoConfig());
}

type JsonRpcResult = {
  result?: unknown;
  error?: { message?: string; code?: number };
};

async function mcpCall(
  cfg: OpenSeoConfig,
  method: string,
  params?: Record<string, unknown>,
  timeoutMs = 20_000,
): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(cfg.mcpUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        ...(params ? { params } : {}),
      }),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`OpenSEO MCP HTTP ${res.status}: ${text.slice(0, 240)}`);
    }
    // Some MCP transports reply SSE; pick last JSON object if needed.
    const jsonLine = text.trim().startsWith("{")
      ? text
      : [...text.split("\n")].reverse().find((l) => l.trim().startsWith("{") || l.trim().startsWith("data:"));
    const raw = jsonLine?.startsWith("data:") ? jsonLine.slice(5).trim() : jsonLine || text;
    const parsed = JSON.parse(raw) as JsonRpcResult;
    if (parsed.error) {
      throw new Error(parsed.error.message || `OpenSEO MCP error ${parsed.error.code}`);
    }
    return parsed.result;
  } finally {
    clearTimeout(timer);
  }
}

function textFromToolResult(result: unknown): string {
  if (!result || typeof result !== "object") return String(result ?? "");
  const r = result as { content?: { type?: string; text?: string }[]; structuredContent?: unknown };
  if (Array.isArray(r.content)) {
    return r.content
      .map((c) => (c?.type === "text" ? c.text || "" : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  if (r.structuredContent != null) {
    try {
      return JSON.stringify(r.structuredContent).slice(0, 6000);
    } catch {
      return "";
    }
  }
  try {
    return JSON.stringify(result).slice(0, 6000);
  } catch {
    return "";
  }
}

export async function callOpenSeoTool(
  name: string,
  args: Record<string, unknown>,
  timeoutMs = 25_000,
): Promise<{ ok: true; text: string; raw: unknown } | { ok: false; error: string }> {
  const cfg = getOpenSeoConfig();
  if (!cfg) return { ok: false, error: "OPENSEO_API_KEY belum di-set." };
  try {
    const result = await mcpCall(
      cfg,
      "tools/call",
      { name, arguments: args },
      timeoutMs,
    );
    return { ok: true, text: textFromToolResult(result), raw: result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "OpenSEO gagal" };
  }
}

export async function resolveOpenSeoProjectId(): Promise<string | null> {
  const cfg = getOpenSeoConfig();
  if (!cfg) return null;
  if (cfg.projectId) return cfg.projectId;
  const listed = await callOpenSeoTool("list_projects", {});
  if (!listed.ok) return null;
  // Prefer structured, else scrape id-looking tokens from text.
  const raw = listed.raw as { structuredContent?: { projects?: { id?: string; name?: string }[] } };
  const projects = raw?.structuredContent?.projects;
  if (Array.isArray(projects) && projects[0]?.id) return String(projects[0].id);
  const m = listed.text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m?.[0] || null;
}
