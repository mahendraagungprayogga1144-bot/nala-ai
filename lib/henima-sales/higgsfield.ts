import { SalesError } from "./types";

const HF_BASE = "https://api.higgsfield.ai";

export function higgsfieldApiKey() {
  const single =
    process.env.HF_KEY?.trim() ||
    process.env.HF_CREDENTIALS?.trim() ||
    process.env.HIGGSFIELD_API_KEY?.trim() ||
    "";
  if (single.includes(":")) return single;
  const id = process.env.HF_API_KEY?.trim() || process.env.HF_API_KEY_ID?.trim() || "";
  const secret = process.env.HF_API_SECRET?.trim() || process.env.HF_API_KEY_SECRET?.trim() || "";
  if (id && secret) return `${id}:${secret}`;
  return "";
}

export function higgsfieldConfigured() {
  return Boolean(higgsfieldApiKey());
}

function authHeader() {
  return { Authorization: `Key ${higgsfieldApiKey()}` };
}

function detailMessage(raw: string, fallback: string) {
  try {
    const json = JSON.parse(raw) as { detail?: unknown; error?: unknown; message?: string };
    if (typeof json.message === "string" && json.message.trim()) return json.message;
    if (typeof json.error === "string" && json.error.trim()) return json.error;
    if (typeof json.detail === "string" && json.detail.trim()) return json.detail;
    if (Array.isArray(json.detail)) {
      const first = json.detail[0] as { msg?: string; message?: string } | string;
      if (typeof first === "string") return first;
      if (first?.msg) return first.msg;
      if (first?.message) return first.message;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function higgsfieldHttpError(status: number, body: string): SalesError {
  const msg = detailMessage(body, `Higgsfield gagal (${status}).`);
  if (status === 401) return new SalesError("HF_KEY / Higgsfield API key tidak valid.", "studio_provider", 401);
  if (status === 402 || status === 403) {
    return new SalesError(
      "Saldo Higgsfield habis atau belum di-top up. Buka https://open.higgsfield.ai → Add funds, lalu generate lagi.",
      "studio_quota",
      402,
    );
  }
  if (status === 404) return new SalesError(msg, "studio_model", 404);
  if (status === 429) return new SalesError("Antrian Higgsfield penuh. Coba beberapa detik lagi.", "studio_quota", 429);
  return new SalesError(msg, "studio_provider", status >= 500 ? 502 : 400);
}

export async function higgsfieldUpload(bytes: Uint8Array, mime: string) {
  const contentType = mime === "image/jpg" ? "image/jpeg" : mime || "image/jpeg";
  const slotRes = await fetch(`${HF_BASE}/files/generate-upload-url`, {
    method: "POST",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: contentType }),
    signal: AbortSignal.timeout(20_000),
  });
  const slotRaw = await slotRes.text();
  if (!slotRes.ok) throw higgsfieldHttpError(slotRes.status, slotRaw);
  const slot = JSON.parse(slotRaw) as {
    public_url?: string;
    upload_url?: string;
    content_type?: string;
    upload_headers?: Record<string, string>;
  };
  if (!slot.upload_url || !slot.public_url) {
    throw new SalesError("Higgsfield tidak memberi URL upload.", "studio_provider", 502);
  }
  const putHeaders = new Headers(slot.upload_headers || { "Content-Type": slot.content_type || contentType });
  const put = await fetch(slot.upload_url, {
    method: "PUT",
    headers: putHeaders,
    body: Buffer.from(bytes),
    signal: AbortSignal.timeout(45_000),
  });
  if (!put.ok) {
    throw new SalesError(`Upload foto ke Higgsfield gagal (${put.status}).`, "studio_provider", 502);
  }
  return slot.public_url;
}

type HiggsfieldStatus = {
  status?: string;
  request_id?: string;
  status_url?: string;
  error?: string;
  images?: { url?: string }[];
  video?: { url?: string };
};

export async function higgsfieldSubscribe(model: string, arguments_: Record<string, unknown>) {
  const path = model.replace(/^\/+/, "");
  const submit = await fetch(`${HF_BASE}/${path}`, {
    method: "POST",
    headers: {
      ...authHeader(),
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(arguments_),
    signal: AbortSignal.timeout(30_000),
  });
  const submitRaw = await submit.text();
  if (!submit.ok) throw higgsfieldHttpError(submit.status, submitRaw);
  let current = JSON.parse(submitRaw) as HiggsfieldStatus;
  const statusUrl = current.status_url || (current.request_id ? `${HF_BASE}/requests/${current.request_id}/status` : "");
  if (!statusUrl) throw new SalesError("Higgsfield tidak mengembalikan status job.", "studio_provider", 502);

  const deadline = Date.now() + 95_000;
  let delay = 2000;
  while (Date.now() < deadline) {
    const st = (current.status || "").toLowerCase();
    if (st === "completed") {
      const url = current.images?.[0]?.url;
      if (!url) throw new SalesError("Higgsfield selesai tapi tidak ada URL gambar.", "studio_provider", 502);
      return url;
    }
    if (st === "failed" || st === "nsfw" || st === "canceled" || st === "cancelled") {
      throw new SalesError(current.error || `Higgsfield ${st}.`, "studio_provider", 502);
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(Math.round(delay * 1.5), 10_000);
    const poll = await fetch(statusUrl, { headers: authHeader(), signal: AbortSignal.timeout(20_000) });
    const pollRaw = await poll.text();
    if (!poll.ok) throw higgsfieldHttpError(poll.status, pollRaw);
    current = JSON.parse(pollRaw) as HiggsfieldStatus;
  }
  throw new SalesError("Higgsfield timeout. Coba lagi, generate-nya masih antri.", "studio_provider", 504);
}

export async function downloadHiggsfieldImage(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });
  if (!res.ok) throw new SalesError("Gagal unduh hasil Higgsfield.", "studio_provider", 502);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
  return { bytes, mime, ext };
}
