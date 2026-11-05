import { createAnthropicProvider } from "./anthropic-provider";
import { getMentorProviderConfig } from "./config";
import { ProviderConfigError, type MentorProvider } from "./types";

export * from "./types";
export * from "./config";

export function createMentorProvider(): MentorProvider {
  const cfg = getMentorProviderConfig();
  if (cfg.provider === "none") {
    throw new ProviderConfigError("Master Mentor provider dinonaktifkan (MASTER_MENTOR_PROVIDER=none).");
  }
  if (cfg.provider === "anthropic") {
    if (!cfg.apiKeyPresent) {
      throw new ProviderConfigError(
        "ANTHROPIC_API_KEY belum dikonfigurasi di server. Jangan simpan key di repository.",
      );
    }
    return createAnthropicProvider();
  }
  throw new ProviderConfigError(`Provider tidak didukung: ${cfg.provider}`);
}
