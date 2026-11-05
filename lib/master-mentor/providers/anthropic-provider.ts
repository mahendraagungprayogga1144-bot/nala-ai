import Anthropic from "@anthropic-ai/sdk";
import { estimateAnthropicCostUsd, getMentorProviderConfig } from "./config";
import {
  ProviderConfigError,
  ProviderRuntimeError,
  type MentorProvider,
  type ProviderChatMessage,
  type ProviderCompleteResult,
} from "./types";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new ProviderRuntimeError("Provider timeout.", "timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function splitSystem(messages: ProviderChatMessage[], system: string) {
  const rest = messages.filter((m) => m.role !== "system");
  return { system, messages: rest };
}

/** Newer Claude models (e.g. Opus 5.x) reject `temperature` as deprecated. */
function modelAllowsTemperature(model: string): boolean {
  const m = model.toLowerCase();
  if (m.includes("opus-5") || /claude-opus-4-5|claude-opus-4\.5/.test(m)) return false;
  return true;
}

function buildMessageParams(opts: {
  model: string;
  maxTokens: number;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  temperature?: number;
}) {
  const base = {
    model: opts.model,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: opts.messages,
  };
  if (!modelAllowsTemperature(opts.model)) return base;
  return { ...base, temperature: opts.temperature ?? 0.3 };
}

export function createAnthropicProvider(): MentorProvider {
  const cfg = getMentorProviderConfig();
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new ProviderConfigError(
      "Mesin Master Mentor belum dikonfigurasi. Set ANTHROPIC_API_KEY di server (jangan di repository).",
    );
  }
  const client = new Anthropic({ apiKey });
  const model = cfg.model;

  const complete: MentorProvider["complete"] = async ({ system, messages, maxTokens, temperature, timeoutMs }) => {
    const split = splitSystem(messages, system);
    try {
      const res = await withTimeout(
        client.messages.create(
          buildMessageParams({
            model,
            maxTokens: maxTokens || cfg.maxTokens,
            temperature,
            system: split.system,
            messages: split.messages.map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content,
            })),
          }),
        ),
        timeoutMs || cfg.timeoutMs,
      );
      const text = res.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      const inputTokens = res.usage?.input_tokens || 0;
      const outputTokens = res.usage?.output_tokens || 0;
      return {
        text,
        usage: {
          inputTokens,
          outputTokens,
          estimatedCostUsd: estimateAnthropicCostUsd(model, inputTokens, outputTokens),
          provider: "anthropic",
          model,
        },
      };
    } catch (err) {
      if (err instanceof ProviderRuntimeError || err instanceof ProviderConfigError) throw err;
      const msg = err instanceof Error ? err.message : "Provider failure";
      throw new ProviderRuntimeError(msg, "anthropic_error");
    }
  };

  const stream: NonNullable<MentorProvider["stream"]> = async ({
    system,
    messages,
    maxTokens,
    temperature,
    timeoutMs,
    handlers,
  }) => {
    const split = splitSystem(messages, system);
    try {
      const streamRes = client.messages.stream(
        buildMessageParams({
          model,
          maxTokens: maxTokens || cfg.maxTokens,
          temperature,
          system: split.system,
          messages: split.messages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
        }),
      );

      let text = "";
      const finalPromise = withTimeout(
        (async () => {
          for await (const event of streamRes) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              text += event.delta.text;
              handlers?.onText?.(event.delta.text);
            }
          }
          const final = await streamRes.finalMessage();
          const inputTokens = final.usage?.input_tokens || 0;
          const outputTokens = final.usage?.output_tokens || 0;
          return {
            text: text.trim() || final.content
              .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
              .map((b) => b.text)
              .join("\n")
              .trim(),
            usage: {
              inputTokens,
              outputTokens,
              estimatedCostUsd: estimateAnthropicCostUsd(model, inputTokens, outputTokens),
              provider: "anthropic",
              model,
            },
          } satisfies ProviderCompleteResult;
        })(),
        timeoutMs || cfg.timeoutMs,
      );
      return await finalPromise;
    } catch (err) {
      if (err instanceof ProviderRuntimeError || err instanceof ProviderConfigError) throw err;
      const msg = err instanceof Error ? err.message : "Provider stream failure";
      throw new ProviderRuntimeError(msg, "anthropic_stream_error");
    }
  };

  return { id: "anthropic", model, complete, stream };
}
