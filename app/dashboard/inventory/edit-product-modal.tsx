"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { X, Pencil, ImagePlus } from "lucide-react";
import { upsertProductAttrs, type AttrsMode, type ProductAttr } from "./lib/typed-stock-actions";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  min_stock: number;
  price: number | null;
  cost: number | null;
  category: string | null;
  photo_url: string | null;
};

export default function EditProductModal({
  product,
  userId,
  businessId,
  attrsMode = "none",
  attr,
}: {
  product: Product;
  userId?: string;
  businessId?: string;
  attrsMode?: AttrsMode;
  attr?: ProductAttr | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(product.name);
  const [sku, setSku] = useState(product.sku || "");
  const [stock, setStock] = useState(String(product.stock));
  const [minStock, setMinStock] = useState(String(product.min_stock));
  const [price, setPrice] = useState(product.price ? String(product.price) : "");
  const [cost, setCost] = useState(product.cost ? String(product.cost) : "");
  const [category, setCategory] = useState(product.category || "");
  const [expiry, setExpiry] = useState(attr?.expiry_date || "");
  const [moq, setMoq] = useState(attr?.min_order_qty != null ? String(attr.min_order_qty) : "");
  const [wprice, setWprice] = useState(
    attr?.wholesale_price != null ? String(attr.wholesale_price) : "",
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState(product.photo_url || "");
  const [loading, setLoading] = useState(false);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let photoUrl = product.photo_url;
    if (photoFile) {
      const path = `${product.id}-${Date.now()}-${photoFile.name}`;
      const { error: uploadError } = await supabase.storage.from("product-photos").upload(path, photoFile);
      if (!uploadError) {
        const { data } = supabase.storage.from("product-photos").getPublicUrl(path);
        photoUrl = data.publicUrl;
      }
    }

    const { error } = await supabase
      .from("products")
      .update({
        name,
        sku,
        category,
        photo_url: photoUrl,
        stock: Number(stock),
        min_stock: Number(minStock),
        price: price ? Number(price) : null,
        cost: cost ? Number(cost) : null,
      })
      .eq("id", product.id);

    if (error) {
      setLoading(false);
      alert("Gagal simpan: " + error.message);
      return;
    }

    if (userId && businessId && attrsMode !== "none") {
      const attrErr = await upsertProductAttrs(supabase, {
        userId,
        businessId,
        productId: product.id,
        expiryDate: attrsMode === "expiry" && expiry ? expiry : null,
        moq: attrsMode === "wholesale" && moq ? Number(moq) : null,
        wholesalePrice: attrsMode === "wholesale" && wprice ? Number(wprice) : null,
      });
      if (attrErr) {
        setLoading(false);
        alert("Produk tersimpan, tapi attrs gagal: " + attrErr.message);
        router.refresh();
        return;
      }
    }

    setLoading(false);
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-1 text-[#8B8AA0] transition-colors hover:text-[#38BDF8]"
      >
        <Pencil size={14} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[min(92dvh,640px)] w-full max-w-[420px] overflow-y-auto overscroll-contain rounded-t-2xl border border-white/10 bg-[#0F0F1A] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-medium">Edit Produk</h2>
              <button onClick={() => setOpen(false)} className="text-[#8B8AA0]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-3">
              <label className="flex cursor-pointer items-center gap-3">
                <div
                  style={{
                    width: 56,
                    height: 56,
                    minWidth: 56,
                    minHeight: 56,
                    maxWidth: 56,
                    maxHeight: 56,
                    overflow: "hidden",
                  }}
                  className="flex flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#0A0A12]"
                >
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoPreview}
                      alt="preview"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <ImagePlus size={18} className="text-[#8B8AA0]" />
                  )}
                </div>
                <span className="text-xs text-[#8B8AA0]">Ganti foto produk</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    padding: 0,
                    margin: -1,
                    overflow: "hidden",
                    clip: "rect(0,0,0,0)",
                    whiteSpace: "nowrap",
                    border: 0,
                  }}
                />
              </label>

              <div className="grid grid-cols-[1fr_110px] gap-3">
                <input
                  type="text"
                  required
                  placeholder="Nama produk"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-lg border border-white/10 bg-[#0A0A12] px-4 py-2.5 text-[#F2F1F8] focus:border-[#2DD4BF]/50 focus:outline-none"
                />
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="rounded-lg border border-white/10 bg-[#0A0A12] px-3 py-2.5 font-mono text-xs text-[#2DD4BF] focus:border-[#2DD4BF]/50 focus:outline-none"
                />
              </div>
              <input
                type="text"
                placeholder="Kategori"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-white/10 bg-[#0A0A12] px-4 py-2.5 text-[#F2F1F8] focus:border-[#2DD4BF]/50 focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  required
                  placeholder="Stok"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="rounded-lg border border-white/10 bg-[#0A0A12] px-4 py-2.5 text-[#F2F1F8] focus:border-[#2DD4BF]/50 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Stok minimum"
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value)}
                  className="rounded-lg border border-white/10 bg-[#0A0A12] px-4 py-2.5 text-[#F2F1F8] focus:border-[#2DD4BF]/50 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder="Harga jual"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="rounded-lg border border-white/10 bg-[#0A0A12] px-4 py-2.5 text-[#F2F1F8] focus:border-[#2DD4BF]/50 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Modal (HPP)"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="rounded-lg border border-white/10 bg-[#0A0A12] px-4 py-2.5 text-[#F2F1F8] focus:border-[#2DD4BF]/50 focus:outline-none"
                />
              </div>

              {attrsMode === "expiry" && (
                <div>
                  <label className="mb-1 block text-[11px] text-[#8B8AA0]">Tanggal kadaluarsa (ED)</label>
                  <input
                    type="date"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#0A0A12] px-4 py-2.5 text-[#F2F1F8] focus:border-[#2DD4BF]/50 focus:outline-none"
                    style={{ colorScheme: "dark" }}
                  />
                </div>
              )}
              {attrsMode === "wholesale" && (
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="MOQ"
                    value={moq}
                    onChange={(e) => setMoq(e.target.value)}
                    className="rounded-lg border border-white/10 bg-[#0A0A12] px-4 py-2.5 text-[#F2F1F8] focus:border-[#2DD4BF]/50 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Harga grosir"
                    value={wprice}
                    onChange={(e) => setWprice(e.target.value)}
                    className="rounded-lg border border-white/10 bg-[#0A0A12] px-4 py-2.5 text-[#F2F1F8] focus:border-[#2DD4BF]/50 focus:outline-none"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 rounded-lg bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] py-2.5 font-semibold text-[#0A0A12] disabled:opacity-50"
              >
                {loading ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
