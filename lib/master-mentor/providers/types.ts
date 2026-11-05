export type ProviderChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type ProviderUsage = {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  provider: string;
  model: string;
};

export type ProviderCompleteResult = {
  text: string;
  usage: ProviderUsage;
};

export type ProviderStreamHandlers = {
  onText?: (chunk: string) => void;
};

export type MentorProvider = {
  id: string;
  model: string;
  complete: (opts: {
    system: string;
    messages: ProviderChatMessage[];
    maxTokens?: number;
    temperature?: number;
    timeoutMs?: number;
  }) => Promise<ProviderCompleteResult>;
  stream?: (opts: {
    system: string;
    messages: ProviderChatMessage[];
    maxTokens?: number;
    temperature?: number;
    timeoutMs?: number;
    handlers?: ProviderStreamHandlers;
  }) => Promise<ProviderCompleteResult>;
};

export class ProviderConfigError extends Error {
  readonly code = "provider_not_configured";
  constructor(message: string) {
    super(message);
    this.name = "ProviderConfigError";
  }
}

export class ProviderRuntimeError extends Error {
  readonly code: string;
  constructor(message: string, code = "provider_error") {
    super(message);
    this.name = "ProviderRuntimeError";
    this.code = code;
  }
}
