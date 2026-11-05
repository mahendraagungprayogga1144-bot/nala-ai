/**
 * Backend-only provider configuration.
 * Secrets must come from environment — never from client or repo.
 */

export type MentorProviderConfig = {
  provider: "anthropic" | "none";
  model: string;
  apiKeyPresent: boolean;
  timeoutMs: number;
  maxTokens: number;
};

export function getMentorProviderConfig(): MentorProviderConfig {
  const providerRaw = (process.env.MASTER_MENTOR_PROVIDER || "anthropic").trim().toLowerCase();
  const provider = providerRaw === "anthropic" ? "anthropic" : providerRaw === "none" ? "none" : "anthropic";
  const model =
    (process.env.MASTER_MENTOR_MODEL || process.env.ANTHROPIC_MODEL || "claude-opus-5-5").trim();
  const apiKeyPresent = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const timeoutMs = Number(process.env.MASTER_MENTOR_TIMEOUT_MS || 55_000);
  const maxTokens = Number(process.env.MASTER_MENTOR_MAX_TOKENS || 4096);
  return {
    provider,
    model,
    apiKeyPresent: provider === "anthropic" ? apiKeyPresent : false,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 55_000,
    maxTokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 4096,
  };
}

/** Rough public list price estimate for monitoring only — not billing. */
export function estimateAnthropicCostUsd(model: string, inputTokens: number, outputTokens: number) {
  // Conservative Sonnet-class defaults; override via env if needed.
  const inPerM = Number(process.env.MASTER_MENTOR_COST_INPUT_PER_M || 3);
  const outPerM = Number(process.env.MASTER_MENTOR_COST_OUTPUT_PER_M || 15);
  void model;
  return (inputTokens / 1_000_000) * inPerM + (outputTokens / 1_000_000) * outPerM;
}
