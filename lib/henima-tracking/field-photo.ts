/**
 * Kompres + normalisasi foto lapangan (iPhone HEIC / kamera besar)
 * jadi JPEG yang diterima storage henima-tracking.
 */

const MAX_INPUT_BYTES = 12 * 1024 * 1024;
const MAX_EDGE = 1600;
const TARGET_BYTES = 1.6 * 1024 * 1024;

function isLikelyImage(file: File) {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i.test(file.name);
}

async function bitmapFromFile(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file);
  } catch {
    /* Safari sering gagal createImageBitmap untuk HEIC — coba lewat <img> */
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", quality));
  if (!blob) throw new Error("Gagal kompres foto.");
  return blob;
}

/** Hasil: File JPEG siap upload (nama .jpg). */
export async function prepareFieldPhoto(file: File): Promise<File> {
  if (!isLikelyImage(file)) {
    throw new Error("Pilih foto dari kamera / galeri.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("Foto terlalu besar (maks 12MB). Ambil ulang dengan resolusi lebih kecil.");
  }

  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await bitmapFromFile(file);
  } catch {
    throw new Error("Format foto tidak terbaca di HP ini. Ambil ulang, atau pilih JPG dari Galeri.");
  }

  const sw = "naturalWidth" in source ? source.naturalWidth || source.width : source.width;
  const sh = "naturalHeight" in source ? source.naturalHeight || source.height : source.height;
  if (!sw || !sh) {
    if ("close" in source) source.close();
    throw new Error("Foto kosong / rusak. Ambil ulang.");
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if ("close" in source) source.close();
    throw new Error("Browser tidak bisa kompres foto.");
  }
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  if ("close" in source) source.close();

  let quality = 0.82;
  let blob = await canvasToJpeg(canvas, quality);
  while (blob.size > TARGET_BYTES && quality > 0.45) {
    quality -= 0.1;
    blob = await canvasToJpeg(canvas, quality);
  }
  if (blob.size > 5 * 1024 * 1024) {
    throw new Error("Foto masih terlalu besar setelah kompres. Ambil ulang lebih dekat / lebih gelap.");
  }

  const base = file.name.replace(/\.[^.]+$/, "") || "foto";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}
