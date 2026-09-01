"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ImagePlus, Loader2, Sparkles, Trash2 } from "lucide-react";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../../components/module-form-styles";
import { STUDIO_GEMINI_MODELS } from "@/lib/henima-sales/studio-presets";

type Product = { id: string; name: string };
type Preset = { id: string; label: string; hint: string; swatch: string; kind: string };
type Frame = { id: string; label: string };
type Asset = {
  id: string;
  product_id: string | null;
  product_name: string | null;
  preset: string;
  frame: string;
  originalUrl: string | null;
  resultUrl: string | null;
  created_at: string;
};
type Mode = "swap" | "background";

export default function StudioClient({
  role,
  configured,
  swapConfigured,
  provider,
  tableReady,
  products,
  presets,
  frames,
  defaultSwapPrompt,
  assets,
}: {
  role: string;
  configured: boolean;
  swapConfigured: boolean;
  provider: "photoroom" | "removebg" | null;
  tableReady: boolean;
  products: Product[];
  presets: Preset[];
  frames: Frame[];
  defaultSwapPrompt: string;
  assets: Asset[];
}) {
  const router = useRouter();
  const bottleRef = useRef<HTMLInputElement>(null);
  const sceneRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("swap");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [sceneFile, setSceneFile] = useState<File | null>(null);
  const [scenePreview, setScenePreview] = useState("");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [preset, setPreset] = useState(presets[0]?.id || "afternoon_gold");
  const [frame, setFrame] = useState("square");
  const [geminiModel, setGeminiModel] = useState<(typeof STUDIO_GEMINI_MODELS)[number]["id"]>("pro");
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [prompt, setPrompt] = useState(defaultSwapPrompt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Asset | null>(assets[0] || null);

  const productName = products.find((p) => p.id === productId)?.name || "";
  const selectedPreset = presets.find((p) => p.id === preset);
  const canCustom = selectedPreset?.kind === "custom";
  const sceneNeedsPhotoroom = selectedPreset?.kind === "scene" || selectedPreset?.kind === "custom";

  const providerLabel = useMemo(() => {
    if (mode === "swap") {
      if (!swapConfigured) return "Belum ada GEMINI_API_KEY";
      return STUDIO_GEMINI_MODELS.find((m) => m.id === geminiModel)?.label || "Nano Banana Pro";
    }
    if (provider === "photoroom") return "Photoroom AI";
    if (provider === "removebg") return "remove.bg";
    return "Belum ada API key";
  }, [mode, swapConfigured, provider, geminiModel]);

  const onPickBottle = (next: File | null) => {
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : "");
    setError("");
  };

  const onPickScene = (next: File | null) => {
    setSceneFile(next);
    setSourceId(null);
    setScenePreview(next ? URL.createObjectURL(next) : "");
    setError("");
  };

  const generate = async () => {
    if (mode === "swap") {
      if (!swapConfigured) {
        setError("Set GEMINI_API_KEY di Vercel dulu (Google AI Studio). Ini yang dipakai untuk @img1 + @img2.");
        return;
      }
      if (!file) {
        setError("Upload @img2 botol Henima dulu.");
        return;
      }
      if (!sceneFile && !sourceId) {
        setError("Upload @img1 foto referensi (yang sudah jadi) dulu.");
        return;
      }
    } else {
      if (!configured) {
        setError("Set PHOTOROOM_API_KEY di server dulu (atau REMOVEBG_API_KEY untuk cutout + warna solid).");
        return;
      }
      if (!file && !sourceId) {
        setError("Upload foto botol dulu.");
        return;
      }
      if (canCustom && !prompt.trim()) {
        setError("Isi prompt custom, contoh: botol di atas batu pantai saat sunset.");
        return;
      }
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("mode", mode);
      if (file) form.append("file", file);
      if (mode === "swap" && sceneFile) form.append("scene", sceneFile);
      if (sourceId) form.append("source_id", sourceId);
      form.append("preset", preset);
      form.append("frame", frame);
      form.append("gemini_model", geminiModel);
      form.append("prompt", prompt);
      if (productId) form.append("product_id", productId);
      if (productName) form.append("product_name", productName);
      const res = await fetch("/api/sales/studio", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal generate.");
      setResult(json.asset);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal generate.");
    } finally {
      setBusy(false);
    }
  };

  const apply = async (id: string) => {
    if (!productId) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/sales/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply", id, product_id: productId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal tempel ke katalog.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal tempel ke katalog.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus foto studio ini?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/sales/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal hapus.");
      if (result?.id === id) setResult(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal hapus.");
    } finally {
      setBusy(false);
    }
  };

  const reuse = (a: Asset) => {
    setMode(a.preset === "swap_ref" ? "swap" : "background");
    setSourceId(a.id);
    setSceneFile(null);
    setScenePreview(a.originalUrl || "");
    if (a.preset !== "swap_ref") {
      setFile(null);
      setPreview(a.originalUrl || "");
      setPreset(a.preset);
    }
    setFrame(a.frame);
    if (a.product_id) setProductId(a.product_id);
  };

  const downloadResult = async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      a.click();
      URL.revokeObjectURL(href);
    } catch {
      window.open(url, "_blank");
    }
  };

  const uploadBox = (
    previewUrl: string,
    emptyLabel: string,
    filledLabel: string,
    onClick: () => void,
  ) => (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-[#0A0A12] px-3 py-5 text-xs text-[#8B8AA0] hover:border-[#2DD4BF]/40 hover:text-[#F0EFF8]"
    >
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="upload" className="h-28 w-full rounded-lg object-contain" />
      ) : (
        <ImagePlus size={22} />
      )}
      {previewUrl ? filledLabel : emptyLabel}
    </button>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-3">
        <section className={MODULE_CARD + " flex gap-1.5 p-2"}>
          <button
            type="button"
            onClick={() => {
              setMode("swap");
              setPrompt(defaultSwapPrompt);
            }}
            className={
              "flex-1 rounded-lg px-2 py-2 text-[11px] font-medium " +
              (mode === "swap" ? "bg-[#2DD4BF]/15 text-[#2DD4BF]" : "text-[#8B8AA0]")
            }
          >
            Tukar botol
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("background");
              setPrompt("");
            }}
            className={
              "flex-1 rounded-lg px-2 py-2 text-[11px] font-medium " +
              (mode === "background" ? "bg-[#2DD4BF]/15 text-[#2DD4BF]" : "text-[#8B8AA0]")
            }
          >
            Ganti latar
          </button>
        </section>

        {mode === "swap" ? (
          <>
            <section className={MODULE_CARD}>
              <p className="mb-2 text-[10px] uppercase tracking-wide text-[#8B8AA0]">@img1 Referensi</p>
              {uploadBox(
                scenePreview,
                "Foto yang sudah jadi (scene)",
                sceneFile ? sceneFile.name : "Pakai scene dari galeri",
                () => sceneRef.current?.click(),
              )}
              <input
                ref={sceneRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => onPickScene(e.target.files?.[0] || null)}
              />
            </section>
            <section className={MODULE_CARD}>
              <p className="mb-2 text-[10px] uppercase tracking-wide text-[#8B8AA0]">@img2 Botol Henima</p>
              {uploadBox(preview, "Foto botol asli / katalog", file ? file.name : "Upload botol", () =>
                bottleRef.current?.click(),
              )}
              <input
                ref={bottleRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => onPickBottle(e.target.files?.[0] || null)}
              />
            </section>
          </>
        ) : (
          <section className={MODULE_CARD}>
            <p className="mb-2 text-[10px] uppercase tracking-wide text-[#8B8AA0]">1. Foto</p>
            {uploadBox(
              preview,
              "Upload foto botol",
              file ? file.name : sourceId ? "Pakai foto asli dari galeri" : "Upload foto botol",
              () => bottleRef.current?.click(),
            )}
            <input
              ref={bottleRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => onPickBottle(e.target.files?.[0] || null)}
            />
          </section>
        )}

        <section className={MODULE_CARD}>
          <p className="mb-2 text-[10px] uppercase tracking-wide text-[#8B8AA0]">Produk</p>
          <select className={MODULE_INPUT} value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.length === 0 && <option value="">Belum ada produk</option>}
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </section>

        {mode === "swap" ? (
          <section className={MODULE_CARD}>
            <p className="mb-2 text-[10px] uppercase tracking-wide text-[#8B8AA0]">Prompt</p>
            <textarea
              className={MODULE_INPUT + " min-h-[120px] text-[11px]"}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </section>
        ) : (
          <section className={MODULE_CARD}>
            <p className="mb-2 text-[10px] uppercase tracking-wide text-[#8B8AA0]">3. Latar</p>
            <div className="grid grid-cols-2 gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  className={
                    "rounded-xl border px-2 py-2 text-left " +
                    (preset === p.id
                      ? "border-[#2DD4BF]/50 bg-[#2DD4BF]/10"
                      : "border-white/10 hover:border-white/20")
                  }
                >
                  <span className="mb-1 block h-2 w-full rounded-full" style={{ background: p.swatch }} />
                  <span className="block text-[11px] font-medium text-[#F0EFF8]">{p.label}</span>
                </button>
              ))}
            </div>
            {canCustom && (
              <textarea
                className={MODULE_INPUT + " mt-2 min-h-[72px]"}
                placeholder="Contoh: botol di atas batu basah, sunset pantai, bokeh lampu kota"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            )}
            {provider === "removebg" && sceneNeedsPhotoroom && (
              <p className="mt-2 text-[10px] text-[#F59E0B]">
                remove.bg hanya cutout + warna. Latar AI butuh PHOTOROOM_API_KEY.
              </p>
            )}
          </section>
        )}

        {mode === "swap" && (
          <section className={MODULE_CARD}>
            <p className="mb-2 text-[10px] uppercase tracking-wide text-[#8B8AA0]">Model</p>
            <div className="space-y-1.5">
              {STUDIO_GEMINI_MODELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setGeminiModel(m.id)}
                  className={
                    "w-full rounded-xl border px-3 py-2 text-left " +
                    (geminiModel === m.id
                      ? "border-[#2DD4BF]/50 bg-[#2DD4BF]/10"
                      : "border-white/10 hover:border-white/20")
                  }
                >
                  <span className="block text-[12px] font-medium text-[#F0EFF8]">{m.label}</span>
                  <span className="block text-[10px] text-[#8B8AA0]">{m.hint}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className={MODULE_CARD}>
          <p className="mb-2 text-[10px] uppercase tracking-wide text-[#8B8AA0]">Frame</p>
          <div className="flex flex-wrap gap-1.5">
            {frames.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFrame(f.id)}
                className={
                  "rounded-lg border px-2.5 py-1.5 text-[11px] " +
                  (frame === f.id
                    ? "border-[#2DD4BF]/50 bg-[#2DD4BF]/15 text-[#2DD4BF]"
                    : "border-white/10 text-[#8B8AA0]")
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>

        <button type="button" disabled={busy} onClick={generate} className={MODULE_BTN + " flex w-full items-center justify-center gap-2"}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {busy ? "Sedang proses…" : mode === "swap" ? "Tukar botol" : "Ganti latar"}
        </button>
        <p className="text-[10px] text-[#5A5B7A]">Provider: {providerLabel} · ada biaya per generate</p>
      </aside>

      <div className="space-y-4">
        {!tableReady && (
          <p className="rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 py-2 text-xs text-[#F59E0B]">
            Tabel studio belum aktif. Jalankan migration <code>20260901_henima_studio.sql</code> di Supabase.
          </p>
        )}
        {mode === "swap" && !swapConfigured && (
          <p className="rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 py-2 text-xs text-[#F59E0B]">
            Mode tukar botol butuh <code>GEMINI_API_KEY</code> di Vercel. Ambil di Google AI Studio, Save, Redeploy.
          </p>
        )}
        {mode === "background" && !configured && (
          <p className="rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 py-2 text-xs text-[#F59E0B]">
            Tambah <code>PHOTOROOM_API_KEY</code> di env server (Vercel). Bisa juga <code>REMOVEBG_API_KEY</code> untuk cutout + warna solid.
          </p>
        )}
        {error && (
          <p className="rounded-xl border border-[#EC4899]/30 bg-[#EC4899]/10 px-3 py-2 text-xs text-[#EC4899]">{error}</p>
        )}

        <section className={MODULE_CARD + " min-h-[320px]"}>
          <p className="mb-3 text-[10px] uppercase tracking-wide text-[#8B8AA0]">Preview</p>
          {result?.resultUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.resultUrl} alt="hasil studio" className="mx-auto max-h-[520px] w-full rounded-xl object-contain" />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const url = result.resultUrl;
                    if (!url) return;
                    void downloadResult(url, `henima-${result.product_name || "studio"}.png`);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#F0EFF8]"
                >
                  <Download size={12} /> Unduh
                </button>
                {role === "FOUNDER" && productId && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => apply(result.id)}
                    className="rounded-lg border border-[#2DD4BF]/40 px-3 py-1.5 text-xs text-[#2DD4BF]"
                  >
                    Tempel ke {productName || "katalog"}
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="py-16 text-center text-sm text-[#5A5B7A]">
              {mode === "swap"
                ? "Upload @img1 scene + @img2 botol, lalu tukar botol."
                : "Hasil muncul di sini setelah ganti latar."}
            </p>
          )}
        </section>

        <section>
          <p className="mb-2 text-sm font-medium">Galeri</p>
          {assets.length === 0 ? (
            <p className="text-sm text-[#8B8AA0]">Belum ada hasil.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {assets.map((a) => (
                <figure key={a.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D0D1A]">
                  {a.resultUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.resultUrl}
                      alt={a.product_name || a.preset}
                      className="h-40 w-full cursor-pointer object-cover"
                      onClick={() => setResult(a)}
                    />
                  ) : (
                    <div className="flex h-40 items-center justify-center text-[10px] text-[#5A5B7A]">Expired</div>
                  )}
                  <figcaption className="flex items-center justify-between gap-1 p-2">
                    <span className="truncate text-[10px] text-[#8B8AA0]">
                      {a.product_name || "Produk"} · {a.preset.replaceAll("_", " ")}
                    </span>
                    <span className="flex gap-1">
                      <button type="button" className="text-[10px] text-[#2DD4BF]" onClick={() => reuse(a)}>
                        Pakai
                      </button>
                      <button type="button" className="text-[#8B8AA0]" onClick={() => remove(a.id)} aria-label="Hapus">
                        <Trash2 size={12} />
                      </button>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
