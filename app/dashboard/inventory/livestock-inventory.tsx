
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Search, ArrowLeftRight, Plus, Bird } from "lucide-react";
import { todayWib } from "@/lib/date";
import PeternakanHubNav from "../peternakan/peternakan-hub-nav";
import PeternakanStockAlerts from "../peternakan/peternakan-stock-alerts";
import FnbEmptyState from "../fnb/components/fnb-empty-state";
import DeleteTransactionButton from "../delete-transaction-button";
import EditProductModal from "./edit-product-modal";

const BTN_GRAD = { background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" } as const;

type Product = { id: string; name: string; sku: string | null; stock: number; min_stock: number; price: number | null; cost: number | null; category: string | null; photo_url: string | null };

const HEWAN_CATS = ["Ayam Broiler", "Ayam Kampung", "Bebek", "Sapi", "Kambing", "Ikan", "Kelinci"];
const PAKAN_CATS = ["Pakan"];
const OBAT_CATS = ["Obat", "Vitamin", "Vaksin"];
const ALAT_CATS = ["Peralatan"];

export default function LivestockInventory({ products, userId, businessId }: { products: Product[]; userId: string; businessId?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveType, setMoveType] = useState<"masuk" | "keluar">("masuk");
  const [moveReason, setMoveReason] = useState("dijual");
  const [moveQty, setMoveQty] = useState("");
  const [moveDate, setMoveDate] = useState(todayWib());
  const [moveNote, setMoveNote] = useState("");
  const [moveLoading, setMoveLoading] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("5");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  const hewan = filtered.filter((p) => HEWAN_CATS.includes(p.category || ""));
  const pakan = filtered.filter((p) => PAKAN_CATS.includes(p.category || ""));
  const obat = filtered.filter((p) => OBAT_CATS.includes(p.category || ""));
  const alat = filtered.filter((p) => ALAT_CATS.includes(p.category || ""));
  const lainnya = filtered.filter((p) => !HEWAN_CATS.includes(p.category || "") && !PAKAN_CATS.includes(p.category || "") && !OBAT_CATS.includes(p.category || "") && !ALAT_CATS.includes(p.category || ""));

  const handleAdd = async (defaultCat: string, cats: string[]) => {
    if (!name || !stock) return;
    setFormLoading(true);
    await supabase.from("products").insert({
      user_id: userId, business_id: businessId,
      name, category: category || defaultCat,
      stock: Number(stock), min_stock: Number(minStock),
      price: price ? Number(price) : null,
      cost: cost ? Number(cost) : null,
    });
    setFormLoading(false);
    setName(""); setStock(""); setMinStock("5"); setPrice(""); setCost(""); setCategory("");
    setShowForm(null);
    router.refresh();
  };

  const handleMove = async (product: Product) => {
    if (!moveQty || Number(moveQty) <= 0) return;
    setMoveLoading(true);
    const qty = Number(moveQty);
    const isHewan = HEWAN_CATS.includes(product.category || "");
    const isPakan = PAKAN_CATS.includes(product.category || "");
    const newStock = moveType === "masuk" ? product.stock + qty : Math.max(0, product.stock - qty);
    const isSell = ["dijual", "terjual"].includes(moveReason);
    const isLoss = ["mati", "rusak", "sakit"].includes(moveReason);
    const profitLoss = moveType === "keluar" && isSell && product.price && product.cost
      ? (product.price - product.cost) * qty
      : moveType === "keluar" && isLoss && product.cost ? -product.cost * qty : 0;

    await supabase.from("products").update({ stock: newStock }).eq("id", product.id);
    await supabase.from("stock_movements").insert({
      user_id: userId, product_id: product.id, type: moveType,
      reason: moveType === "keluar" ? moveReason : null,
      quantity: qty, note: moveNote || null,
      profit_loss: profitLoss, movement_date: moveDate,
    });

    if (moveType === "masuk" && product.cost) {
      await supabase.from("transactions").insert({
        user_id: userId, business_id: businessId, type: "pengeluaran", scope: "bisnis",
        category: isPakan ? "Pembelian Pakan" : OBAT_CATS.includes(product.category || "") ? "Pembelian Obat" : "Pembelian Hewan",
        description: `Beli ${product.name} (${qty} ${isHewan ? "ekor" : "kg/pcs"}) - via Inventory`,
        amount: product.cost * qty, transaction_date: moveDate,
      });
    } else if (moveType === "keluar" && isSell && product.price) {
      await supabase.from("transactions").insert({
        user_id: userId, business_id: businessId, type: "pemasukan", scope: "bisnis",
        category: isHewan ? "Penjualan Hewan" : "Penjualan",
        description: `Dijual ${product.name} (${qty} ${isHewan ? "ekor" : "pcs"}) - via Inventory`,
        amount: product.price * qty, transaction_date: moveDate,
      });
    } else if (moveType === "keluar" && isLoss && product.cost) {
      await supabase.from("transactions").insert({
        user_id: userId, business_id: businessId, type: "pengeluaran", scope: "bisnis",
        category: "Kerugian Ternak",
        description: `${moveReason} ${product.name} (${qty} ${isHewan ? "ekor" : "pcs"}) - via Inventory`,
        amount: product.cost * qty, transaction_date: moveDate,
      });
    }

    setMoveLoading(false); setMovingId(null); setMoveQty(""); setMoveNote("");
    router.refresh();
  };

  const inputCls = "w-full px-3 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50 text-sm";

  const AddForm = ({ type, cats, defaultCat, label, satuanHarga, satuanStok }: { type: string; cats: string[]; defaultCat: string; label: string; satuanHarga: string; satuanStok: string }) => (
    <div className="bg-[#0A0A12] border border-[#2DD4BF]/20 rounded-xl p-4 mb-3">
      <p className="text-xs font-medium text-[#2DD4BF] mb-3">Tambah {label} Baru</p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input className={inputCls} placeholder={`Nama ${label.toLowerCase()}`} value={name} onChange={(e) => setName(e.target.value)} />
        <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Pilih kategori</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value="Lainnya">Lainnya</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input className={inputCls} type="number" placeholder={`Jumlah (${satuanStok})`} value={stock} onChange={(e) => setStock(e.target.value)} />
        <input className={inputCls} type="number" placeholder="Min. stok aman" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <input className={inputCls} type="number" placeholder={`Harga beli/${satuanHarga}`} value={cost} onChange={(e) => setCost(e.target.value)} />
        <input className={inputCls} type="number" placeholder={`Harga jual/${satuanHarga}`} value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button onClick={() => handleAdd(defaultCat, cats)} disabled={formLoading} className="flex-1 py-2 rounded-lg font-semibold text-sm disabled:opacity-50" style={BTN_GRAD}>{formLoading ? "Menyimpan..." : `+ ${label}`}</button>
        <button onClick={() => setShowForm(null)} className="px-4 py-2 rounded-lg border border-white/10 text-sm text-[#8B8AA0]">Batal</button>
      </div>
    </div>
  );

  const MoveModal = ({ product }: { product: Product }) => {
    const isHewan = HEWAN_CATS.includes(product.category || "");
    const isPakan = PAKAN_CATS.includes(product.category || "");
    const keluarOptions = isHewan
      ? [{ value: "dijual", label: "Dijual" }, { value: "mati", label: "Mati" }, { value: "sakit", label: "Sakit/Karantina" }, { value: "rusak", label: "Afkir" }]
      : isPakan
      ? [{ value: "terpakai", label: "Terpakai" }, { value: "rusak", label: "Rusak/Expired" }]
      : [{ value: "terjual", label: "Terjual" }, { value: "terpakai", label: "Terpakai" }, { value: "rusak", label: "Rusak" }];
    const satuan = isHewan ? "ekor" : isPakan ? "kg" : "pcs";
    const profitPreview = moveType === "keluar" && ["dijual","terjual"].includes(moveReason) && product.price && product.cost && moveQty
      ? (product.price - product.cost) * Number(moveQty)
      : moveType === "keluar" && ["mati","rusak","sakit"].includes(moveReason) && product.cost && moveQty
      ? -product.cost * Number(moveQty) : null;

    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setMovingId(null)}>
        <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm">Catat Pergerakan — {product.name}</h3>
            <button onClick={() => setMovingId(null)} className="text-[#8B8AA0] text-lg">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button onClick={() => setMoveType("masuk")} className={"py-2 rounded-lg text-sm font-medium border " + (moveType === "masuk" ? "bg-[#2DD4BF]/15 border-[#2DD4BF]/40 text-[#2DD4BF]" : "border-white/10 text-[#8B8AA0]")}>
              ⬇ {isHewan ? "Beli/Masuk" : "Beli/Masuk"}
            </button>
            <button onClick={() => setMoveType("keluar")} className={"py-2 rounded-lg text-sm font-medium border " + (moveType === "keluar" ? "bg-[#EC4899]/15 border-[#EC4899]/40 text-[#EC4899]" : "border-white/10 text-[#8B8AA0]")}>
              ⬆ {isHewan ? "Keluar" : "Keluar"}
            </button>
          </div>
          {moveType === "keluar" && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {keluarOptions.map((o) => (
                <button key={o.value} onClick={() => setMoveReason(o.value)} className={"py-2 rounded-lg text-xs border " + (moveReason === o.value ? "border-[#EC4899]/40 bg-[#EC4899]/10 text-[#EC4899]" : "border-white/10 text-[#8B8AA0]")}>{o.label}</button>
              ))}
            </div>
          )}
          <input className={inputCls + " mb-2"} type="number" placeholder={`Jumlah (${satuan})`} value={moveQty} onChange={(e) => setMoveQty(e.target.value)} />
          <div className="mb-2">
            <label className="text-[10px] text-[#8B8AA0] mb-1 block">Tanggal</label>
            <input className={inputCls} type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} style={{ colorScheme: "dark" }} />
          </div>
          <input className={inputCls + " mb-3"} placeholder="Catatan (opsional)" value={moveNote} onChange={(e) => setMoveNote(e.target.value)} />
          {profitPreview !== null && moveQty && (
            <div className={"rounded-lg px-3 py-2 text-sm font-mono mb-3 " + (profitPreview >= 0 ? "bg-[#2DD4BF]/10 text-[#2DD4BF]" : "bg-[#EC4899]/10 text-[#EC4899]")}>
              {profitPreview >= 0 ? "Estimasi untung" : "Estimasi rugi"}: Rp{Math.abs(profitPreview).toLocaleString("id-ID")}
            </div>
          )}
          <p className="text-[10px] text-[#5A5B6A] mb-3">Otomatis tercatat di Keuangan Bisnis</p>
          <button onClick={() => handleMove(product)} disabled={moveLoading} className="w-full py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50" style={BTN_GRAD}>{moveLoading ? "Menyimpan..." : "Simpan"}</button>
        </div>
      </div>
    );
  };

  const ItemRow = ({ p }: { p: Product }) => {
    const isHewan = HEWAN_CATS.includes(p.category || "");
    const satuan = isHewan ? "ekor" : PAKAN_CATS.includes(p.category || "") ? "kg" : "pcs";
    const isKritis = p.stock <= p.min_stock;
    return (
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] last:border-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#38BDF8]/15 to-[#8B5CF6]/15 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {p.photo_url ? <img src={p.photo_url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span className="text-lg">{isHewan ? "🐄" : PAKAN_CATS.includes(p.category || "") ? "🌾" : "💊"}</span>}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-medium">{p.name}</p>
              {p.category && <span className="text-[10px] text-[#8B8AA0] bg-white/5 px-1.5 py-0.5 rounded">{p.category}</span>}
            </div>
            <p className="text-[11px] text-[#8B8AA0]">
              {p.cost ? `Beli Rp${Number(p.cost).toLocaleString("id-ID")}` : ""}
              {p.price ? ` · Jual Rp${Number(p.price).toLocaleString("id-ID")}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className={"font-mono font-semibold text-sm " + (isKritis ? "text-[#EC4899]" : "text-[#F2F1F8]")}>{p.stock} {satuan}</p>
            {isKritis && <p className="text-[10px] text-[#EC4899]">Stok kritis!</p>}
          </div>
          <button onClick={() => { setMovingId(p.id); setMoveType("masuk"); setMoveReason("dijual"); }} className="text-[#8B8AA0] hover:text-[#2DD4BF] transition-colors p-1"><ArrowLeftRight size={14} /></button>
          <EditProductModal product={p} />
          <DeleteTransactionButton id={p.id} table="products" />
        </div>
        {movingId === p.id && <MoveModal product={p} />}
      </div>
    );
  };

  const Section = ({ title, items, color, formKey, cats, defaultCat, satuanHarga, satuanStok }: { title: string; items: Product[]; color: string; formKey: string; cats: string[]; defaultCat: string; satuanHarga: string; satuanStok: string }) => (
    <div className="mb-4">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]" style={{ background: `${color}08` }}>
        <span className="text-[11px] font-semibold tracking-wide uppercase" style={{ color }}>{title} ({items.length})</span>
        <button onClick={() => setShowForm(showForm === formKey ? null : formKey)} className="text-[10px] flex items-center gap-1 px-2.5 py-1 rounded-lg border" style={{ color, borderColor: `${color}40`, background: `${color}10` }}>
          <Plus size={10} /> Tambah
        </button>
      </div>
      {showForm === formKey && (
        <div className="px-4 py-3">
          <AddForm type={formKey} cats={cats} defaultCat={defaultCat} label={title} satuanHarga={satuanHarga} satuanStok={satuanStok} />
        </div>
      )}
      {items.length === 0 ? (
        <FnbEmptyState
          icon={Bird}
          title={"Belum ada " + title.toLowerCase()}
          subtitle={formKey === "hewan" ? "Buat batch di Manajemen Ternak — stok hewan otomatis masuk." : "Tambah stok atau catat pembelian via batch."}
          actionLabel={formKey === "hewan" ? "Ke Manajemen Ternak" : "Tambah"}
          actionHref={formKey === "hewan" ? "/dashboard/peternakan" : undefined}
          onAction={formKey !== "hewan" ? () => setShowForm(formKey) : undefined}
        />
      ) : (
        items.map((p) => <ItemRow key={p.id} p={p} />)
      )}
    </div>
  );

  const hewanCount = hewan.reduce((s, p) => s + p.stock, 0);
  const pakanKritis = pakan.filter(p => p.stock <= p.min_stock).length;

  return (
    <div className="pb-24 md:pb-6">
      <PeternakanHubNav />
      <p className="mb-4 rounded-xl border border-white/[0.06] px-3 py-2 text-[11px] leading-relaxed text-[#5A5B7A]" style={{ background: "#0D0D1A" }}>
        <span className="text-[#2DD4BF] font-medium">Alur:</span> Buat batch → catat bibit/pakan/panen di{" "}
        <Link href="/dashboard/peternakan" className="text-[#2DD4BF] underline">Manajemen Ternak</Link>
        {" "}→ otomatis sync stok & Keuangan Bisnis.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <div className="rounded-2xl border border-white/[0.08] p-4" style={{ background: "#0D0D1A" }}>
          <p className="text-xs text-[#8B8AA0] mb-1">Total hewan</p>
          <p className="text-lg font-mono font-semibold text-[#2DD4BF]">{hewanCount} ekor</p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] p-4" style={{ background: "#0D0D1A" }}>
          <p className="text-xs text-[#8B8AA0] mb-1">Pakan kritis</p>
          <p className="text-lg font-mono font-semibold text-[#EC4899]">{pakanKritis}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] p-4 col-span-2 sm:col-span-1" style={{ background: "#0D0D1A" }}>
          <p className="text-xs text-[#8B8AA0] mb-1">Item stok</p>
          <p className="text-lg font-mono font-semibold text-[#8B5CF6]">{products.length}</p>
        </div>
      </div>

      <PeternakanStockAlerts products={products} />

    <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl overflow-hidden">
      <div className="px-4 py-4 border-b border-white/10 flex items-center gap-3">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8AA0]" />
          <input type="text" placeholder="Cari hewan, pakan, obat..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] text-sm placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50" />
        </div>
        <a href="/dashboard/chat" className="text-xs px-3 py-2 rounded-lg bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] text-[#0A0A12] font-medium whitespace-nowrap">+ Tanya Gercep</a>
      </div>

      <Section title="Hewan Ternak" items={hewan} color="#2DD4BF" formKey="hewan" cats={HEWAN_CATS} defaultCat="Ayam Broiler" satuanHarga="ekor" satuanStok="ekor" />
      <Section title="Pakan" items={pakan} color="#F59E0B" formKey="pakan" cats={["Pakan"]} defaultCat="Pakan" satuanHarga="kg" satuanStok="kg" />
      <Section title="Obat & Vitamin" items={obat} color="#8B5CF6" formKey="obat" cats={["Obat", "Vitamin", "Vaksin"]} defaultCat="Obat" satuanHarga="pcs" satuanStok="pcs" />
      <Section title="Peralatan" items={alat} color="#6366F1" formKey="alat" cats={["Peralatan"]} defaultCat="Peralatan" satuanHarga="unit" satuanStok="unit" />
      {lainnya.length > 0 && <Section title="Lainnya" items={lainnya} color="#8B8AA0" formKey="lainnya" cats={["Lainnya"]} defaultCat="Lainnya" satuanHarga="pcs" satuanStok="pcs" />}
    </div>
    </div>
  );
}
