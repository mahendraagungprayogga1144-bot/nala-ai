import { SalesError } from "./types";
import {
  downloadHiggsfieldImage,
  higgsfieldConfigured,
  higgsfieldSubscribe,
  higgsfieldUpload,
} from "./higgsfield";
import {
  geminiAspectRatio,
  getStudioPreset,
  resolveGeminiModel,
  studioOutputSize,
  type StudioFrameId,
  type StudioPresetId,
} from "./studio-presets";

export type StudioProviderId = "photoroom" | "removebg" | "gemini" | "higgsfield";

export { higgsfieldConfigured };

export function studioProvider(): Exclude<StudioProviderId, "gemini"> | null {
  if (higgsfieldConfigured()) return "higgsfield";
  if (process.env.PHOTOROOM_API_KEY?.trim()) return "photoroom";
  if (process.env.REMOVEBG_API_KEY?.trim()) return "removebg";
  return null;
}

export function geminiApiKey() {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    ""
  );
}

export function geminiConfigured() {
  return Boolean(geminiApiKey());
}

export function studioConfigured() {
  return studioProvider() != null;
}

export type StudioEditRequest = {
  bytes: Uint8Array;
  mime: string;
  filename: string;
  presetId: StudioPresetId;
  prompt: string | null;
  frame: StudioFrameId;
};

export type StudioEditResult = {
  bytes: Uint8Array;
  mime: string;
  ext: string;
  provider: StudioProviderId;
};

export async function swapBottleInScene(input: {
  sceneBytes: Uint8Array;
  sceneMime: string;
  bottleBytes: Uint8Array;
  bottleMime: string;
  prompt: string;
  frame: StudioFrameId;
  modelRaw?: string | null;
}): Promise<StudioEditResult> {
  const picked = resolveGeminiModel(input.modelRaw);
  if (higgsfieldConfigured()) {
    return editWithHiggsfield({
      imageUrls: [
        await higgsfieldUpload(input.sceneBytes, input.sceneMime),
        await higgsfieldUpload(input.bottleBytes, input.bottleMime),
      ],
      prompt: input.prompt,
      frame: input.frame,
      model: picked.higgsfield,
      resolution: picked.resolution,
    });
  }
  const key = geminiApiKey();
  if (!key) {
    throw new SalesError(
      "Mode tukar botol butuh HF_KEY (Higgsfield) di Vercel. Paste key_id:secret, Save, Redeploy.",
      "studio_unconfigured",
      503,
    );
  }
  try {
    return await callGeminiImage(key, picked.model, input);
  } catch (err) {
    if (err instanceof SalesError && err.code === "studio_model") {
      throw new SalesError(
        `${picked.label} belum aktif di key Gemini. Pasang HF_KEY Higgsfield, atau enable model di Google AI Studio.`,
        "studio_model",
        404,
      );
    }
    throw err;
  }
}

async function editWithHiggsfield(input: {
  imageUrls: string[];
  prompt: string;
  frame: StudioFrameId;
  model: string;
  resolution: string;
}): Promise<StudioEditResult> {
  const url = await higgsfieldSubscribe(input.model, {
    prompt: input.prompt,
    aspect_ratio: geminiAspectRatio(input.frame),
    resolution: input.resolution,
    image_references: input.imageUrls,
  });
  const file = await downloadHiggsfieldImage(url);
  return { ...file, provider: "higgsfield" };
}

function toB64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

async function callGeminiImage(
  key: string,
  model: string,
  input: {
    sceneBytes: Uint8Array;
    sceneMime: string;
    bottleBytes: Uint8Array;
    bottleMime: string;
    prompt: string;
    frame: StudioFrameId;
  },
): Promise<StudioEditResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: input.prompt },
            { inline_data: { mime_type: input.sceneMime || "image/jpeg", data: toB64(input.sceneBytes) } },
            { inline_data: { mime_type: input.bottleMime || "image/jpeg", data: toB64(input.bottleBytes) } },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio: geminiAspectRatio(input.frame) },
      },
    }),
    signal: AbortSignal.timeout(80_000),
  });
  const raw = await res.text();
  let json: {
    error?: { message?: string; status?: string; code?: number };
    candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string } }[] } }[];
  };
  try {
    json = JSON.parse(raw) as typeof json;
  } catch {
    throw new SalesError(`Gemini merespons tidak valid (${res.status}).`, "studio_provider", mapHttp(res.status));
  }
  if (!res.ok) {
    const msg = json.error?.message || `Gemini gagal (${res.status}).`;
    const status = json.error?.code || res.status;
    throw geminiApiError(msg, status);
  }
  const parts = json.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    const data = inline?.data;
    if (data) {
      const blob = inline as { mimeType?: string; mime_type?: string };
      const mime = blob.mimeType || blob.mime_type || "image/png";
      return {
        bytes: Uint8Array.from(Buffer.from(data, "base64")),
        mime,
        ext: mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png",
        provider: "gemini",
      };
    }
  }
  throw new SalesError("Gemini tidak mengembalikan gambar. Coba foto yang lebih jelas atau prompt lebih singkat.", "studio_provider", 502);
}

export async function editStudioPhoto(input: StudioEditRequest): Promise<StudioEditResult> {
  if (higgsfieldConfigured()) {
    const preset = getStudioPreset(input.presetId);
    const prompt =
      input.prompt ||
      (preset.kind === "solid" && preset.color
        ? `Keep the exact perfume bottle. Replace only the background with a clean solid #${preset.color} studio backdrop, no extra objects, no text, no logos.`
        : "");
    if (!prompt) throw new SalesError("Preset latar tidak valid.", "studio_preset");
    const imageUrl = await higgsfieldUpload(input.bytes, input.mime);
    const picked = resolveGeminiModel("flash");
    return editWithHiggsfield({
      imageUrls: [imageUrl],
      prompt,
      frame: input.frame,
      model: picked.higgsfield,
      resolution: picked.resolution,
    });
  }
  const provider = studioProvider();
  if (!provider) {
    throw new SalesError(
      "Studio belum dikonfigurasi. Set HF_KEY Higgsfield di Vercel (disarankan), atau PHOTOROOM_API_KEY.",
      "studio_unconfigured",
      503,
    );
  }
  if (provider === "photoroom") return editWithPhotoroom(input);
  return editWithRemoveBg(input);
}

function fileFrom(input: StudioEditRequest) {
  const copy = Uint8Array.from(input.bytes);
  return new File([copy], input.filename, { type: input.mime || "image/jpeg" });
}

async function editWithPhotoroom(input: StudioEditRequest): Promise<StudioEditResult> {
  const key = process.env.PHOTOROOM_API_KEY!.trim();
  const preset = getStudioPreset(input.presetId);
  const form = new FormData();
  form.append("imageFile", fileFrom(input));
  form.append("removeBackground", "true");
  form.append("outputSize", studioOutputSize(input.frame));
  form.append("padding", "0.12");
  form.append("shadow.mode", "ai.soft");
  form.append("export.format", "png");
  form.append("referenceBox", "originalImage");
  if (preset.kind === "solid" && preset.color) {
    form.append("background.color", preset.color);
  } else if (input.prompt) {
    form.append("background.prompt", input.prompt);
  } else {
    throw new SalesError("Preset latar tidak valid.", "studio_preset");
  }

  const res = await fetch("https://image-api.photoroom.com/v2/edit", {
    method: "POST",
    headers: { "x-api-key": key },
    body: form,
    signal: AbortSignal.timeout(55_000),
  });
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!res.ok) {
    throw new SalesError(photoroomError(bytes, res.status), "studio_provider", mapHttp(res.status));
  }
  return { bytes, mime: "image/png", ext: "png", provider: "photoroom" };
}

async function editWithRemoveBg(input: StudioEditRequest): Promise<StudioEditResult> {
  const key = process.env.REMOVEBG_API_KEY!.trim();
  const preset = getStudioPreset(input.presetId);
  const form = new FormData();
  form.append("image_file", fileFrom(input));
  form.append("size", "auto");
  form.append("format", "png");
  if (preset.kind === "solid" && preset.color) {
    form.append("bg_color", preset.color);
  } else if (preset.kind === "scene" && preset.swatch) {
    form.append("bg_color", preset.swatch.replace("#", ""));
  } else if (preset.kind === "custom") {
    throw new SalesError(
      "Latar custom butuh PHOTOROOM_API_KEY. remove.bg hanya cutout + warna solid.",
      "studio_provider",
      503,
    );
  }

  const res = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": key },
    body: form,
    signal: AbortSignal.timeout(45_000),
  });
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!res.ok) {
    throw new SalesError(removeBgError(bytes, res.status), "studio_provider", mapHttp(res.status));
  }
  return { bytes, mime: "image/png", ext: "png", provider: "removebg" };
}

export function geminiApiError(msg: string, status: number): SalesError {
  if (status === 404 || /not found|not supported/i.test(msg)) {
    return new SalesError(msg, "studio_model", 404);
  }
  if (status === 401 || status === 403) {
    return new SalesError("GEMINI_API_KEY tidak valid.", "studio_provider", 401);
  }
  if (status === 429 || /quota|resource.?exhausted|rate limit/i.test(msg)) {
    if (/free_tier|limit:\s*0/i.test(msg)) {
      return new SalesError(
        "Key Gemini masih free tier — kuota generate gambar = 0, jadi retry 20 detik tidak akan jalan. Enable billing di Google AI Studio (bukan OpenAI), buat API key baru dari project yang sudah berbayar, update GEMINI_API_KEY di Vercel, lalu Redeploy. Sementara itu mode Ganti latar (Photoroom) tetap bisa dipakai.",
        "studio_quota",
        429,
      );
    }
    return new SalesError(
      "Kuota Gemini habis atau kena rate limit. Cek https://ai.dev/rate-limit, tunggu sebentar, lalu generate lagi.",
      "studio_quota",
      429,
    );
  }
  return new SalesError(msg, "studio_provider", mapHttp(status));
}

function mapHttp(status: number) {
  if (status === 401 || status === 403) return 502;
  if (status === 402) return 402;
  if (status === 429) return 429;
  if (status >= 500) return 502;
  return 400;
}

function photoroomError(bytes: Uint8Array, status: number) {
  const parsed = parseJsonError(bytes);
  if (status === 402) return parsed || "Kuota Photoroom habis. Cek billing Photoroom.";
  if (status === 401 || status === 403) return "PHOTOROOM_API_KEY tidak valid.";
  return parsed || `Photoroom gagal (${status}).`;
}

function removeBgError(bytes: Uint8Array, status: number) {
  const parsed = parseJsonError(bytes);
  if (status === 402) return parsed || "Kredit remove.bg habis. Cek billing remove.bg.";
  if (status === 401 || status === 403) return "REMOVEBG_API_KEY tidak valid.";
  return parsed || `remove.bg gagal (${status}).`;
}

function parseJsonError(bytes: Uint8Array) {
  try {
    const json = JSON.parse(new TextDecoder().decode(bytes)) as {
      message?: string;
      error?: { message?: string } | string;
      errors?: { title?: string; detail?: string }[];
    };
    if (typeof json.message === "string" && json.message.trim()) return json.message;
    if (typeof json.error === "string" && json.error.trim()) return json.error;
    if (json.error && typeof json.error === "object" && json.error.message) return json.error.message;
    const first = json.errors?.[0];
    if (first?.detail || first?.title) return first.detail || first.title || "";
  } catch {
    /* binary */
  }
  return "";
}
