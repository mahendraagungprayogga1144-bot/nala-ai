"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, AlertTriangle, Upload, Image as ImageIcon, Link as LinkIcon, Search, UtensilsCrossed } from "lucide-react";

import { calcHpp, calcMargin, fmtRp, hppStatus, recipeLineCost, unwrapProduct } from "../lib/calc";
import type { FnbMenu } from "../lib/calc";
import FnbHubNav from "../components/fnb-hub-nav";
import FnbWorkflowSteps from "../components/fnb-workflow-steps";
import FnbKpiRow from "../components/fnb-kpi-row";
import FnbStockAlerts from "../components/fnb-stock-alerts";
import FnbEmptyState from "../components/fnb-empty-state";
import FnbVividShell, { FNB_VIVID_CARD, FnbGradientLine } from "../components/fnb-vivid-shell";

type Product = { id: string; name: string; cost: number | null; stock: number; min_stock?: number; category: string | null };
const KATEGORI_MENU = ["Makanan", "Minuman", "Snack", "Paket", "Lainnya"];
const KATEGORI_COLOR: Record<string, string> = { "Makanan": "#2DD4BF", "Minuman": "#38BDF8", "Snack": "#F59E0B", "Paket": "#8B5CF6", "Lainnya": "#8B8AA0" };
const BTN_GRAD = { background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" } as const;
const inputCls = "w-full px-3 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50 text-sm";

type FormMenuProps = {
  editMenu: FnbMenu | null;
  fNama: string; setFNama: (v: string) => void;
  fKategori: string; setFKategori: (v: string) => void;
  fHarga: string; setFHarga: (v: string) => void;
  fStatus: string; setFStatus: (v: string) => void;
  fYield: string; setFYield: (v: string) => void;
  fFotoUrl: string; setFFotoUrl: (v: string) => void;
  uploadingFoto: boolean;
  onUploadFoto: (file: File) => void;
  loading: boolean;
  onSave: () => void; onCancel: () => void;
};

function FormMenu({ editMenu, fNama, setFNama, fKategori, setFKategori, fHarga, setFHarga, fStatus, setFStatus, fYield, setFYield, fFotoUrl, setFFotoUrl, uploadingFoto, onUploadFoto, loading, onSave, onCancel }: FormMenuProps) {
  const [fotoMode, setFotoMode] = useState<"upload" | "url">("upload");
  const fileInputRef = useState<HTMLInputElement | null>(null);
  return (
    <div className="bg-[#0A0A12] border border-[#2DD4BF]/20 rounded-xl p-4 mb-4">
      <p className="text-xs font-medium text-[#2DD4BF] mb-3">{editMenu ? "Edit Menu" : "Tambah Menu Baru"}</p>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 mb-1">
          <button type="button" onClick={() => setFotoMode("upload")} className={"flex-1 text-xs py-1.5 rounded-lg border flex items-center justify-center gap-1.5 " + (fotoMode === "upload" ? "border-[#2DD4BF]/40 bg-[#2DD4BF]/10 text-[#2DD4BF]" : "border-white/10 text-[#8B8AA0]")}>
            <Upload size={12} /> Upload Foto
          </button>
          <button type="button" onClick={() => setFotoMode("url")} className={"flex-1 text-xs py-1.5 rounded-lg border flex items-center justify-center gap-1.5 " + (fotoMode === "url" ? "border-[#2DD4BF]/40 bg-[#2DD4BF]/10 text-[#2DD4BF]" : "border-white/10 text-[#8B8AA0]")}>
            <LinkIcon size={12} /> URL Foto
          </button>
        </div>

        {fotoMode === "upload" ? (
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-white/10 rounded-lg py-6 cursor-pointer hover:border-[#2DD4BF]/30 transition-colors">
            {fFotoUrl ? (
              <img src={fFotoUrl} alt="Preview" className="w-20 h-20 object-cover rounded-lg" />
            ) : (
              <ImageIcon size={28} className="text-[#3A3B52]" />
            )}
            <span className="text-xs text-[#8B8AA0]">{uploadingFoto ? "Mengupload..." : fFotoUrl ? "Klik untuk ganti foto" : "Klik untuk upload foto"}</span>
            <input type="file" accept="image/*" className="hidden" disabled={uploadingFoto} onChange={e => { const f = e.target.files?.[0]; if (f) onUploadFoto(f); }} />
          </label>
        ) : (
          <div className="flex flex-col gap-2">
            <input className={inputCls} placeholder="https://contoh.com/foto-menu.jpg" value={fFotoUrl} onChange={e => setFFotoUrl(e.target.value)} />
            {fFotoUrl && <img src={fFotoUrl} alt="Preview" className="w-20 h-20 object-cover rounded-lg" onError={e => (e.target as HTMLImageElement).style.display = "none"} />}
          </div>
        )}

        <input className={inputCls} placeholder="Nama menu" value={fNama} onChange={e => setFNama(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <select className={inputCls} value={fKategori} onChange={e => setFKategori(e.target.value)}>
            <option value="">Pilih kategori</option>
            {KATEGORI_MENU.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <input className={inputCls} type="number" placeholder="Harga jual (Rp)" value={fHarga} onChange={e => setFHarga(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-[#8B8AA0] mb-1 block">1 batch resep menghasilkan</label>
            <input className={inputCls} type="number" placeholder="Contoh: 40" value={fYield} onChange={e => setFYield(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] text-[#8B8AA0] mb-1 block">Status</label>
            <select className={inputCls} value={fStatus} onChange={e => setFStatus(e.target.value)}>
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Non-aktif</option>
            </select>
          </div>
        </div>
        {fYield && Number(fYield) > 1 && fHarga && (
          <div className="text-[11px] text-[#8B8AA0] px-1">
            HPP per porsi akan dihitung dari total bahan dibagi {fYield} porsi
          </div>
        )}
        <div className="flex gap-2 mt-1">
          <button onClick={onSave} disabled={loading} className="flex-1 py-2 rounded-lg font-semibold text-sm disabled:opacity-50" style={BTN_GRAD}>
            {loading ? "Menyimpan..." : "Simpan"}
          </button>
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-white/10 text-sm text-[#8B8AA0]">Batal</button>
        </div>
      </div>
    </div>
  );
}

type FormResepProps = {
  menuId: string; products: Product[];
  fProductId: string; setFProductId: (v: string) => void;
  fQty: string; setFQty: (v: string) => void;
  fUnit: string; setFUnit: (v: string) => void;
  loading: boolean;
  onSave: () => void; onCancel: () => void;
};

function FormResep({ products, fProductId, setFProductId, fQty, setFQty, fUnit, setFUnit, loading, onSave, onCancel }: FormResepProps) {
  const selectedProduct = products.find(p => p.id === fProductId);
  const estimasiBiaya = selectedProduct?.cost && fQty ? selectedProduct.cost * Number(fQty) : null;

  const handlePilihBahan = (productId: string) => {
    setFProductId(productId);
    const p = products.find(x => x.id === productId);
    if (p) {
      const satuanMap: Record<string, string> = {
        "Bahan Baku": "kg", "Bumbu": "gr", "Minuman": "pcs", "Kemasan": "pcs"
      };
      setFUnit(satuanMap[p.category || ""] || "pcs");
    }
  };

  return (
    <div className="bg-[#0A0A12] border border-[#8B5CF6]/20 rounded-xl p-3 mt-2">
      <p className="text-xs font-medium text-[#8B5CF6] mb-2">Tambah Bahan</p>
      <select className={inputCls + " mb-2"} value={fProductId} onChange={e => handlePilihBahan(e.target.value)}>
        <option value="">Pilih bahan dari inventory</option>
        {products.map(p => <option key={p.id} value={p.id}>{p.name} — stok {p.stock} · {p.cost ? "Rp" + Number(p.cost).toLocaleString("id-ID") + "/satuan" : "harga belum diset"}</option>)}
      </select>
      {selectedProduct && (
        <div className="bg-[#0F0F1A] rounded-lg px-3 py-2 mb-2 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#8B8AA0]">Stok tersedia</p>
            <p className="text-sm font-mono text-[#F2F1F8]">{selectedProduct.stock} {fUnit}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#8B8AA0]">Harga beli/satuan</p>
            <p className="text-sm font-mono text-[#EC4899]">{selectedProduct.cost ? "Rp" + Number(selectedProduct.cost).toLocaleString("id-ID") : "Belum diset"}</p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input className={inputCls} type="number" placeholder="Jumlah dipakai" value={fQty} onChange={e => setFQty(e.target.value)} />
        <input className={inputCls} placeholder="Satuan (gr/ml/pcs)" value={fUnit} onChange={e => setFUnit(e.target.value)} />
      </div>
      {estimasiBiaya !== null && fQty && (
        <div className="bg-[#EC4899]/10 border border-[#EC4899]/20 rounded-lg px-3 py-2 mb-2 flex justify-between items-center">
          <span className="text-xs text-[#8B8AA0]">Estimasi biaya bahan ini</span>
          <span className="text-sm font-mono font-medium text-[#EC4899]">{"Rp" + Math.round(estimasiBiaya).toLocaleString("id-ID")}</span>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={onSave} disabled={loading} className="flex-1 py-1.5 rounded-lg font-semibold text-xs disabled:opacity-50" style={BTN_GRAD}>
          {loading ? "..." : "Tambah Bahan"}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-[#8B8AA0]">Batal</button>
      </div>
    </div>
  );
}

export default function FnbMenuClient({ menus, products, userId, businessId, businessName }: { menus: FnbMenu[]; products: Product[]; userId: string; businessId: string; businessName?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState("Semua");
  const [search, setSearch] = useState("");
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [editMenu, setEditMenu] = useState<FnbMenu | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showResepForm, setShowResepForm] = useState<string | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [resepLoading, setResepLoading] = useState(false);

  const [fNama, setFNama] = useState("");
  const [fKategori, setFKategori] = useState("Makanan");
  const [fHarga, setFHarga] = useState("");
  const [fStatus, setFStatus] = useState("aktif");
  const [fYield, setFYield] = useState("1");
  const [fFotoUrl, setFFotoUrl] = useState("");
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const [fProductId, setFProductId] = useState("");
  const [fQty, setFQty] = useState("");
  const [fUnit, setFUnit] = useState("gr");

  const resetMenuForm = () => { setFNama(""); setFKategori("Makanan"); setFHarga(""); setFStatus("aktif"); setFYield("1"); setFFotoUrl(""); setEditMenu(null); };

  const handleUploadFoto = async (file: File) => {
    setUploadingFoto(true);
    const ext = file.name.split(".").pop();
    const fileName = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("menu-photos").upload(fileName, file);
    if (error) {
      alert("Gagal upload foto: " + error.message);
      setUploadingFoto(false);
      return;
    }
    const { data } = supabase.storage.from("menu-photos").getPublicUrl(fileName);
    setFFotoUrl(data.publicUrl);
    setUploadingFoto(false);
  };
  const resetResepForm = () => { setFProductId(""); setFQty(""); setFUnit("gr"); };

  const filtered = (activeTab === "Semua" ? menus : menus.filter(m => m.kategori === activeTab))
    .filter(m => m.nama.toLowerCase().includes(search.toLowerCase()));

  const handleSaveMenu = async () => {
    if (!fNama || !fHarga) return;
    setMenuLoading(true);
    const base = {
      user_id: userId,
      business_id: businessId,
      nama: fNama.trim(),
      kategori: fKategori,
      harga_jual: Number(fHarga),
      status: (fStatus || "aktif").toLowerCase() === "nonaktif" ? "nonaktif" : "aktif",
      yield_quantity: Number(fYield) || 1,
    };
    const withPhoto = { ...base, photo_url: fFotoUrl || null };
    let error = (
      editMenu
        ? await supabase.from("menus").update(withPhoto).eq("id", editMenu.id)
        : await supabase.from("menus").insert(withPhoto)
    ).error;
    // Older DBs may only have foto_url or neither photo column
    if (error && /photo_url|foto_url|column/i.test(error.message)) {
      const withFoto = { ...base, foto_url: fFotoUrl || null };
      error = (
        editMenu
          ? await supabase.from("menus").update(withFoto).eq("id", editMenu.id)
          : await supabase.from("menus").insert(withFoto)
      ).error;
    }
    if (error && /photo_url|foto_url|column/i.test(error.message)) {
      error = (
        editMenu
          ? await supabase.from("menus").update(base).eq("id", editMenu.id)
          : await supabase.from("menus").insert(base)
      ).error;
    }
    setMenuLoading(false);
    if (error) { alert("Gagal simpan menu: " + error.message); return; }
    resetMenuForm(); setShowMenuForm(false);
    router.push("/dashboard/fnb/kasir");
    router.refresh();
  };

  const handleDeleteMenu = async (id: string) => {
    if (!confirm("Hapus menu ini beserta resepnya?")) return;
    const { error: e1 } = await supabase.from("menu_recipes").delete().eq("menu_id", id);
    if (e1) { alert(e1.message); return; }
    const { error: e2 } = await supabase.from("menus").delete().eq("id", id);
    if (e2) { alert(e2.message); return; }
    router.refresh();
  };

  const handleSaveResep = async (menuId: string) => {
    if (!fProductId || !fQty) return;
    setResepLoading(true);
    const { error } = await supabase.from("menu_recipes").insert({ menu_id: menuId, product_id: fProductId, quantity: Number(fQty), unit: fUnit });
    setResepLoading(false);
    if (error) { alert("Gagal simpan resep: " + error.message); return; }
    resetResepForm(); setShowResepForm(null); router.refresh();
  };

  const handleDeleteResep = async (id: string) => {
    const { error } = await supabase.from("menu_recipes").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    router.refresh();
  };

  const startEdit = (m: FnbMenu) => {
    setEditMenu(m); setFNama(m.nama); setFKategori(m.kategori || "Makanan");
    setFHarga(m.harga_jual.toString()); setFStatus(m.status || "aktif"); setFYield((m.yield_quantity || 1).toString()); setFFotoUrl(m.foto_url || (m as { photo_url?: string | null }).photo_url || ""); setShowMenuForm(true);
  };

  const totalMenu = menus.length;
  const totalAktif = menus.filter(m => m.status === "aktif").length;
  const avgMargin = menus.length > 0 ? menus.reduce((sum, m) => {
    const hpp = calcHpp(m);
    return sum + (hpp > 0 ? ((m.harga_jual - hpp) / m.harga_jual * 100) : 0);
  }, 0) / menus.length : 0;
  const menuRugi = menus.filter(m => {
    const hpp = calcHpp(m);
    return hpp > 0 && hpp > m.harga_jual;
  }).length;

  return (
    <FnbVividShell>
      <FnbHubNav />
      <FnbWorkflowSteps activePath="/dashboard/master-menu" />

      <FnbKpiRow variant="vivid" items={[
        { label: "Total menu", value: String(totalMenu), color: "#38BDF8" },
        { label: "Menu aktif", value: String(totalAktif), color: "#2DD4BF" },
        { label: "Margin rata-rata", value: `${Math.round(avgMargin)}%`, color: "#8B5CF6", sub: "Food cost otomatis" },
        { label: "Menu rugi", value: String(menuRugi), color: menuRugi > 0 ? "#EC4899" : "#2DD4BF" },
      ]} />
      <FnbStockAlerts businessName={businessName} products={products.map(p => ({ id: p.id, name: p.name, stock: p.stock, min_stock: p.min_stock ?? 5, category: p.category }))} />

      <div className={FNB_VIVID_CARD}>
        <FnbGradientLine />
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-3 py-2.5 md:px-4 md:py-3">
          <span className="text-sm font-medium">Daftar Menu</span>
          <button onClick={() => { resetMenuForm(); setShowMenuForm(!showMenuForm); }} className="flex flex-shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold" style={BTN_GRAD}>
            <Plus size={13} /> Tambah
          </button>
        </div>

        <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0F0F1A]/95 backdrop-blur-md md:static md:bg-transparent">
          <div className="px-3 py-2.5 md:px-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8AA0]" />
              <input type="text" placeholder="Cari menu..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0A0A12] py-2.5 pl-9 pr-3 text-sm text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:border-[#2DD4BF]/50 focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-3 py-2 scrollbar-none md:px-4 md:py-2.5">
            {["Semua", ...KATEGORI_MENU].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={"whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[11px] transition-colors " + (activeTab === tab ? "border-[#2DD4BF]/40 bg-[#2DD4BF]/15 font-medium text-[#2DD4BF]" : "border-white/10 text-[#8B8AA0]")}>{tab}</button>
            ))}
          </div>
        </div>

        {showMenuForm && (
          <div className="px-4 py-3 border-b border-white/10">
            <FormMenu editMenu={editMenu} fNama={fNama} setFNama={setFNama} fKategori={fKategori} setFKategori={setFKategori} fHarga={fHarga} setFHarga={setFHarga} fStatus={fStatus} setFStatus={setFStatus} fYield={fYield} setFYield={setFYield} fFotoUrl={fFotoUrl} setFFotoUrl={setFFotoUrl} uploadingFoto={uploadingFoto} onUploadFoto={handleUploadFoto} loading={menuLoading} onSave={handleSaveMenu} onCancel={() => { resetMenuForm(); setShowMenuForm(false); }} />
          </div>
        )}

        {filtered.length === 0 ? (
          <FnbEmptyState
            icon={UtensilsCrossed}
            title={search ? "Menu tidak ketemu" : "Belum ada menu nih"}
            subtitle={search ? "Coba kata kunci lain atau ganti kategori." : "Tambah menu pertama, lalu isi resep bahannya biar HPP kehitung otomatis."}
            actionLabel={search ? undefined : "Tambah menu pertama"}
            onAction={search ? undefined : () => { resetMenuForm(); setShowMenuForm(true); }}
          />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtered.map(m => {
              const mcalc = calcMargin(m);
              const hpp = mcalc?.hpp ?? calcHpp(m);
              const laba = mcalc?.laba ?? m.harga_jual - hpp;
              const margin = mcalc?.marginPct ?? (hpp > 0 ? Math.round(laba / m.harga_jual * 100) : null);
              const isRugi = mcalc?.isLoss ?? (hpp > 0 && laba < 0);
              const isExpanded = expandedId === m.id;
              const kat = m.kategori || "Lainnya";
              const katColor = KATEGORI_COLOR[kat] || "#8B8AA0";
              const status = hppStatus(m);
              const bahanHabis = m.menu_recipes.filter(r => (unwrapProduct(r.products)?.stock ?? 0) <= 0);
              return (
                <div key={m.id} className="border-b border-white/[0.04] last:border-0">
                  {/* Mobile */}
                  <div className="md:hidden">
                    <button type="button" className="w-full px-3 py-3 text-left" onClick={() => setExpandedId(isExpanded ? null : m.id)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#F0EFF8]">{m.nama}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className="rounded-md px-1.5 py-0.5 text-[9px] font-medium" style={{ background: katColor + "18", color: katColor }}>{kat}</span>
                            <span className={"rounded-md px-1.5 py-0.5 text-[9px] " + (m.status === "aktif" ? "bg-[#2DD4BF]/15 text-[#2DD4BF]" : "bg-white/5 text-[#8B8AA0]")}>{m.status}</span>
                            {bahanHabis.length > 0 && <span className="rounded-md bg-[#EC4899]/15 px-1.5 py-0.5 text-[9px] text-[#EC4899]">Bahan habis</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-mono text-base font-bold text-[#2DD4BF]">{fmtRp(m.harga_jual)}</p>
                          {status === "ok" && <p className="text-[10px] text-[#8B8AA0]">HPP {fmtRp(Math.round(hpp))}</p>}
                        </div>
                      </div>
                      {status !== "ok" && (
                        <p className="mt-2 text-[10px] text-[#F59E0B]">{status === "no_cost" ? "Isi harga beli bahan di Stok" : "Tap untuk tambah resep bahan"}</p>
                      )}
                    </button>
                    <div className="flex gap-2 border-t border-white/[0.04] px-3 py-2">
                      <button type="button" onClick={() => startEdit(m)} className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] py-2 text-xs text-[#8B8AA0]"><Edit2 size={14} /> Edit</button>
                      <button type="button" onClick={() => handleDeleteMenu(m.id)} className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[#8B8AA0]"><Trash2 size={14} /></button>
                      <button type="button" onClick={() => setExpandedId(isExpanded ? null : m.id)} className="rounded-xl border border-[#2DD4BF]/25 bg-[#2DD4BF]/10 px-3 py-2 text-[#2DD4BF]">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>
                  {/* Desktop */}
                  <div className="hidden cursor-pointer items-center gap-3 px-4 py-3 md:flex" onClick={() => setExpandedId(isExpanded ? null : m.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-sm font-medium">{m.nama}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: katColor + "18", color: katColor }}>{kat}</span>
                        <span className={"text-[10px] px-2 py-0.5 rounded-full " + (m.status === "aktif" ? "bg-[#2DD4BF]/15 text-[#2DD4BF]" : "bg-white/5 text-[#8B8AA0]")}>{m.status}</span>
                        {bahanHabis.length > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EC4899]/15 text-[#EC4899]"><AlertTriangle size={9} className="inline mr-1" />bahan habis</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="text-sm font-mono font-semibold text-white">{fmtRp(m.harga_jual)}</span>
                        <span className="text-[#5A5B7A]">jual</span>
                      </div>
                      {/* HPP card — selalu terlihat */}
                      <div className="mt-2 flex items-center justify-between rounded-xl border border-[#2DD4BF]/25 bg-gradient-to-r from-[#2DD4BF]/10 to-[#8B5CF6]/5 px-3 py-2">
                        <span className="text-[11px] font-semibold text-[#2DD4BF]">HPP / Modal</span>
                        {status === "ok" ? (
                          <div className="text-right">
                            <span className="font-mono text-sm font-bold text-[#F0EFF8]">{fmtRp(Math.round(hpp))}</span>
                            {margin !== null && (
                              <span className={"ml-2 text-[10px] font-medium " + (isRugi ? "text-[#EC4899]" : "text-[#2DD4BF]")}>
                                {isRugi ? "Rugi" : "Untung"} {Math.abs(margin)}%
                              </span>
                            )}
                          </div>
                        ) : status === "no_cost" ? (
                          <span className="text-[10px] text-[#F59E0B]">Isi harga beli bahan di Stok</span>
                        ) : (
                          <span className="text-[10px] text-[#F59E0B]">Tap → tambah resep bahan</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={e => { e.stopPropagation(); startEdit(m); }} className="text-[#8B8AA0] hover:text-[#38BDF8] p-1"><Edit2 size={14} /></button>
                      <button onClick={e => { e.stopPropagation(); handleDeleteMenu(m.id); }} className="text-[#8B8AA0] hover:text-[#EC4899] p-1"><Trash2 size={14} /></button>
                      {isExpanded ? <ChevronUp size={14} className="text-[#8B8AA0]" /> : <ChevronDown size={14} className="text-[#8B8AA0]" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-white/[0.04] bg-[#0A0A12]/40 px-3 pb-4 pt-2 md:px-4">
                      <div className="flex items-center justify-between py-2 mb-1">
                        <p className="text-[11px] font-medium text-[#8B5CF6] uppercase tracking-wide">Resep — {m.nama}</p>
                        <button onClick={() => setShowResepForm(showResepForm === m.id ? null : m.id)} className="text-[10px] flex items-center gap-1 px-2 py-1 rounded-lg border border-[#8B5CF6]/40 bg-[#8B5CF6]/10 text-[#8B5CF6]">
                          <Plus size={10} /> Tambah Bahan
                        </button>
                      </div>

                      {showResepForm === m.id && (
                        <FormResep menuId={m.id} products={products} fProductId={fProductId} setFProductId={setFProductId} fQty={fQty} setFQty={setFQty} fUnit={fUnit} setFUnit={setFUnit} loading={resepLoading} onSave={() => handleSaveResep(m.id)} onCancel={() => { resetResepForm(); setShowResepForm(null); }} />
                      )}

                      {m.menu_recipes.length === 0 ? (
                        <p className="text-xs text-[#5A5B6A] py-3 text-center">Belum ada bahan. Tambah bahan untuk hitung HPP otomatis.</p>
                      ) : (
                        <div className="flex flex-col">
                          {m.menu_recipes.map(r => {
                            const p = unwrapProduct(r.products);
                            const biaya = recipeLineCost(r);
                            const isHabis = (p?.stock ?? 0) <= 0;
                            return (
                              <div key={r.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                                <div className="flex items-center gap-2">
                                  <div className={"w-1.5 h-1.5 rounded-full flex-shrink-0 " + (isHabis ? "bg-[#EC4899]" : "bg-[#2DD4BF]")}></div>
                                  <div>
                                    <p className={"text-xs " + (isHabis ? "text-[#EC4899]" : "text-[#F2F1F8]")}>{p?.name || "?"} {isHabis && "(habis)"}</p>
                                    <p className="text-[10px] text-[#8B8AA0]">{r.quantity} {r.unit} · stok {p?.stock ?? 0} · beli {p?.cost ? fmtRp(p.cost) : "belum diset"}/satuan</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-[#EC4899]">Rp{Math.round(biaya).toLocaleString("id-ID")}</span>
                                  <button onClick={() => handleDeleteResep(r.id)} className="text-[#8B8AA0] hover:text-[#EC4899] p-0.5"><Trash2 size={12} /></button>
                                </div>
                              </div>
                            );
                          })}
                          <div className="flex items-center justify-between pt-2 mt-1 border-t border-white/10">
                            <span className="text-xs text-[#8B8AA0]">Total biaya bahan</span>
                            <span className="text-sm font-mono text-[#EC4899]">Rp{Math.round(hpp * (m.yield_quantity || 1)).toLocaleString("id-ID")}</span>
                          </div>
                          {(m.yield_quantity || 1) > 1 && (
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-xs text-[#8B8AA0]">Hasil per batch</span>
                              <span className="text-sm font-mono text-[#F59E0B]">{m.yield_quantity} porsi</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-xs text-[#8B8AA0]">HPP per porsi</span>
                            <span className="text-sm font-mono font-semibold text-[#EC4899]">Rp{Math.round(hpp).toLocaleString("id-ID")}</span>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-xs text-[#8B8AA0]">Harga jual</span>
                            <span className="text-sm font-mono text-[#2DD4BF]">Rp{m.harga_jual.toLocaleString("id-ID")}</span>
                          </div>
                          <div className={"flex items-center justify-between pt-1 mt-1 border-t border-white/10 " + (isRugi ? "text-[#EC4899]" : "text-[#2DD4BF]")}>
                            <span className="text-xs font-semibold">{isRugi ? "RUGI per porsi" : "Laba per porsi"}</span>
                            <span className="text-sm font-mono font-semibold">
                              {isRugi ? "-" : "+"}Rp{Math.abs(Math.round(laba)).toLocaleString("id-ID")}
                              {margin !== null && " (" + Math.abs(Math.round(margin)) + "%)"}
                            </span>
                          </div>
                          {isRugi && (
                            <div className="mt-2 flex items-center gap-2 bg-[#EC4899]/10 border border-[#EC4899]/20 rounded-lg px-3 py-2">
                              <AlertTriangle size={13} className="text-[#EC4899] flex-shrink-0" />
                              <p className="text-[11px] text-[#EC4899]">Menu ini dijual rugi! Naikkan harga jual atau kurangi bahan.</p>
                            </div>
                          )}
                          {bahanHabis.length > 0 && (
                            <div className="mt-2 flex items-center gap-2 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-lg px-3 py-2">
                              <AlertTriangle size={13} className="text-[#F59E0B] flex-shrink-0" />
                              <p className="text-[11px] text-[#F59E0B]">Bahan habis: {bahanHabis.map(b => unwrapProduct(b.products)?.name).filter(Boolean).join(", ")}. Segera restock.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </FnbVividShell>
  );
}
