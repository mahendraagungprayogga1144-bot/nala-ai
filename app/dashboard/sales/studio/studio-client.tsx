"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ImagePlus, Loader2, Sparkles, Trash2 } from "lucide-react";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../../components/module-form-styles";

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

export default function StudioClient({
  role,
  configured,
  provider,
  tableReady,
  products,
  presets,
  frames,
  assets,
}: {
  role: string;
  configured: boolean;
  provider: "photoroom" | "removebg" | null;
  tableReady: boolean;
  products: Product[];
  presets: Preset[];
  frames: Frame[];
  assets: Asset[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [preset, setPreset] = useState(presets[0]?.id || "afternoon_gold");
  const [frame, setFrame] = useState("square");
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Asset | null>(assets[0] || null);

  const productName = products.find((p) => p.id === productId)?.name || "";
  const selectedPreset = presets.find((p) => p.id === preset);
  const canCustom = selectedPreset?.kind === "custom";
  const sceneNeedsPhotoroom = selectedPreset?.kind === "scene" || selectedPreset?.kind === "custom";

  const providerLabel = useMemo(() => {
    if (provider === "photoroom") return "Photoroom AI";
    if (provider === "removebg") return "remove.bg";
    return "Belum ada API key";
  }, [provider]);

  const onPick = (next: File | null) => {
    setFile(next);
    setSourceId(null);
    setPreview(next ? URL.createObjectURL(next) : "");
    setError("");
  };

  const generate = async () => {
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
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      if (file) form.append("file", file);
      if (sourceId) form.append("source_id", sourceId);
      form.append("preset", preset);
      form.append("frame", frame);
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
    setSourceId(a.id);
    setFile(null);
    setPreview(a.originalUrl || "");
    setPreset(a.preset);
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

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-3">
        <section className={MODULE_CARD}>
          <p className="mb-2 text-[10px] uppercase tracking-wide text-[#8B8AA0]">1. Foto</p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-[#0A0A12] px-3 py-6 text-xs text-[#8B8AA0] hover:border-[#2DD4BF]/40 hover:text-[#F0EFF8]"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="upload" className="h-28 w-full rounded-lg object-contain" />
            ) : (
              <ImagePlus size={22} />
            )}
            {file ? file.name : sourceId ? "Pakai foto asli dari galeri" : "Upload foto botol"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0] || null)}
          />
        </section>

        <section className={MODULE_CARD}>
          <p className="mb-2 text-[10px] uppercase tracking-wide text-[#8B8AA0]">2. Produk</p>
          <select
            className={MODULE_INPUT}
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            {products.length === 0 && <option value="">Belum ada produk</option>}
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </section>

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

        <section className={MODULE_CARD}>
          <p className="mb-2 text-[10px] uppercase tracking-wide text-[#8B8AA0]">4. Frame</p>
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
          {busy ? "Sedang ganti latar…" : "Ganti latar"}
        </button>
        <p className="text-[10px] text-[#5A5B7A]">Provider: {providerLabel} · ada biaya per generate</p>
      </aside>

      <div className="space-y-4">
        {!tableReady && (
          <p className="rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 py-2 text-xs text-[#F59E0B]">
            Tabel studio belum aktif. Jalankan migration <code>20260901_henima_studio.sql</code> di Supabase.
          </p>
        )}
        {!configured && (
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
            <p className="py-16 text-center text-sm text-[#5A5B7A]">Hasil muncul di sini setelah ganti latar.</p>
          )}
        </section>

        <section>
          <p className="mb-2 text-sm font-medium">Galeri</p>
          {assets.length === 0 ? (
            <p className="text-sm text-[#8B8AA0]">Belum ada hasil. Upload foto botol, pilih latar, lalu generate.</p>
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
