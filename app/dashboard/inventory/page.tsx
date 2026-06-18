"use client";
import { useState, useEffect } from "react";
import { Package, Plus, ArrowLeft, Search, AlertCircle, TrendingDown, X, Edit } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Product {
  id: number;
  name: string;
  category: string;
  stock: number;
  min_stock: number;
  hpp: number;
  price: number;
  unit: string;
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showSell, setShowSell] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [sellQty, setSellQty] = useState("1");
  const [form, setForm] = useState({ name: "", category: "Parfum", stock: "", min_stock: "10", hpp: "", price: "", unit: "botol" });

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    setLoading(true);
    const { data } = await supabase.from("products").select("*").order("name");
    if (data) setProducts(data);
    setLoading(false);
  };

  const addProduct = async () => {
    if (!form.name || !form.stock) return;
    const { data, error } = await supabase.from("products").insert([{
      name: form.name, category: form.category,
      stock: parseInt(form.stock), min_stock: parseInt(form.min_stock),
      hpp: parseInt(form.hpp) || 0, price: parseInt(form.price) || 0,
      unit: form.unit
    }]).select().single();
    if (!error && data) {
      setProducts([...products, data]);
      setForm({ name: "", category: "Parfum", stock: "", min_stock: "10", hpp: "", price: "", unit: "botol" });
      setShowForm(false);
    }
  };

  const sellProduct = async () => {
    if (!showSell) return;
    const qty = parseInt(sellQty);
    if (qty <= 0 || qty > showSell.stock) return;
    const newStock = showSell.stock - qty;
    const { error } = await supabase.from("products").update({ stock: newStock }).eq("id", showSell.id);
    if (!error) {
      // Also record to transactions
      await supabase.from("transactions").insert([{
        type: "income", amount: showSell.price * qty,
        description: `Jual ${qty} ${showSell.name}`,
        category: "Penjualan", date: new Date().toISOString().split("T")[0]
      }]);
      setProducts(products.map(p => p.id === showSell.id ? { ...p, stock: newStock } : p));
      setShowSell(null); setSellQty("1");
    }
  };

  const deleteProduct = async (id: number) => {
    if (!confirm("Hapus produk ini?")) return;
    await supabase.from("products").delete().eq("id", id);
    setProducts(products.filter(p => p.id !== id));
  };

  const formatRp = (n: number) => "Rp " + n.toLocaleString("id-ID");
  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const lowStock = products.filter(p => p.stock <= p.min_stock);
  const totalValue = products.reduce((a, b) => a + (b.stock * b.hpp), 0);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0a1a0f 0%, #061009 40%, #040d07 100%)", color: "white", fontFamily: "system-ui" }}>
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Header */}
      <div style={{ padding: "14px 24px", borderBottom: "1px solid rgba(16,185,129,0.08)", display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: 13 }}><ArrowLeft size={14} /> Dashboard</a>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>›</span>
        <span style={{ fontSize: 15, fontWeight: 600 }}>Inventory</span>
        <button onClick={() => setShowForm(true)} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, background: "#10b981", color: "black", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}>
          <Plus size={14} /> Tambah Produk
        </button>
      </div>

      <div style={{ padding: "20px 24px", maxWidth: 1200, margin: "0 auto" }}>

        {/* KPI */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
          {[
            { label: "Total Produk", value: products.length + " produk", icon: Package, color: "#10b981" },
            { label: "Stok Menipis", value: lowStock.length + " produk", icon: AlertCircle, color: lowStock.length > 0 ? "#f97316" : "#10b981" },
            { label: "Nilai Stok", value: formatRp(totalValue), icon: TrendingDown, color: "#3b82f6" },
          ].map(kpi => (
            <div key={kpi.label} style={{ padding: 20, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{kpi.label}</p>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: kpi.color + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <kpi.icon size={16} color={kpi.color} />
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: kpi.color }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Low Stock Alert */}
        {lowStock.length > 0 && (
          <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <AlertCircle size={16} color="#f97316" />
            <p style={{ margin: 0, fontSize: 13, color: "#f97316" }}>
              <strong>{lowStock.length} produk</strong> stok menipis: {lowStock.map(p => p.name).join(", ")}
            </p>
          </div>
        )}

        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "8px 12px", marginBottom: 14 }}>
          <Search size={14} color="rgba(255,255,255,0.2)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari produk..." style={{ background: "transparent", border: "none", outline: "none", color: "white", fontSize: 13, flex: 1 }} />
        </div>

        {/* Table */}
        <div style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                {["Produk", "Kategori", "Stok", "Min Stok", "HPP", "Harga Jual", "Nilai Stok", "Aksi"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)" }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)" }}>Belum ada produk. Klik "Tambah Produk" untuk mulai.</td></tr>
              ) : filtered.map((p, i) => (
                <tr key={p.id} style={{ background: i%2===0?"transparent":"rgba(255,255,255,0.008)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background="rgba(16,185,129,0.04)"}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background=i%2===0?"transparent":"rgba(255,255,255,0.008)"}>
                  <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, color: "white", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>{p.name}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 5, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}>{p.category}</span>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 13, borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <span style={{ fontWeight: 700, color: p.stock <= p.min_stock ? "#f97316" : "#10b981", fontSize: 15 }}>{p.stock}</span>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}> {p.unit}</span>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: "rgba(255,255,255,0.4)", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>{p.min_stock} {p.unit}</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, color: "rgba(255,255,255,0.6)", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>{formatRp(p.hpp)}</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, color: "#10b981", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.03)" }}>{formatRp(p.price)}</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, color: "#3b82f6", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>{formatRp(p.stock * p.hpp)}</td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { setShowSell(p); setSellQty("1"); }} style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#10b981", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Jual</button>
                      <button onClick={() => deleteProduct(p.id)} style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 11, cursor: "pointer" }}>Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(8px)" }}>
          <div style={{ width: "100%", maxWidth: 480, background: "#0d1a10", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 20, padding: 28, position: "relative", animation: "slideUp 0.2s ease" }}>
            <button onClick={() => setShowForm(false)} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white" }}><X size={14} /></button>
            <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700 }}>Tambah Produk Baru</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "Nama Produk", key: "name", placeholder: "Black Opium", full: true },
                { label: "Kategori", key: "category", placeholder: "Parfum" },
                { label: "Stok Awal", key: "stock", placeholder: "50", type: "number" },
                { label: "Min Stok Alert", key: "min_stock", placeholder: "10", type: "number" },
                { label: "HPP (Rp)", key: "hpp", placeholder: "50000", type: "number" },
                { label: "Harga Jual (Rp)", key: "price", placeholder: "150000", type: "number" },
                { label: "Satuan", key: "unit", placeholder: "botol" },
              ].map(f => (
                <div key={f.key} style={{ gridColumn: f.full ? "1 / -1" : "auto" }}>
                  <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>{f.label}</label>
                  <input type={f.type || "text"} value={form[f.key as keyof typeof form]} onChange={e => setForm({...form, [f.key]: e.target.value})} placeholder={f.placeholder}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
            <button onClick={addProduct} style={{ width: "100%", marginTop: 20, padding: "13px", borderRadius: 12, background: "#10b981", color: "black", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" }}>Simpan Produk</button>
          </div>
        </div>
      )}

      {/* Sell Modal */}
      {showSell && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(8px)" }}>
          <div style={{ width: "100%", maxWidth: 380, background: "#0d1a10", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 20, padding: 28, position: "relative", animation: "slideUp 0.2s ease" }}>
            <button onClick={() => setShowSell(null)} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white" }}><X size={14} /></button>
            <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700 }}>Jual Produk</h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{showSell.name}</p>
            <div style={{ padding: 16, borderRadius: 12, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Stok tersedia</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#10b981" }}>{showSell.stock} {showSell.unit}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Harga jual</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#10b981" }}>{formatRp(showSell.price)}</span>
              </div>
            </div>
            <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>Jumlah yang dijual</label>
            <input type="number" value={sellQty} onChange={e => setSellQty(e.target.value)} min="1" max={showSell.stock}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 18, fontWeight: 700, outline: "none", boxSizing: "border-box", textAlign: "center", marginBottom: 12 }} />
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(16,185,129,0.06)", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Total pemasukan</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#10b981" }}>{formatRp(showSell.price * parseInt(sellQty || "0"))}</span>
            </div>
            <button onClick={sellProduct} style={{ width: "100%", padding: "13px", borderRadius: 12, background: "#10b981", color: "black", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" }}>
              Konfirmasi Penjualan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}