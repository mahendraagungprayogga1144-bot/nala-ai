/** Drop a trailing "x 1" / "× 1" that was already baked into the product name. */
export function cleanProductLabel(name: string) {
  const raw = (name || "").replace(/\s+/g, " ").trim();
  const cleaned = raw.replace(/(?:\s*[x×]\s*\d+)+$/gi, "").trim();
  return cleaned || raw || "Produk";
}
