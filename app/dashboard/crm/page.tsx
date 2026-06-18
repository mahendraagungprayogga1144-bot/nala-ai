"use client";
import { useState, useEffect } from "react";
import { Users, Plus, ArrowLeft, Search, Phone, Mail, MapPin, X, ShoppingBag } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  total_purchases: number;
  last_purchase: string;
  created_at: string;
}

export default function CRMPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });

  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = async () => {
    setLoading(true);
    const { data } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
    if (data) setCustomers(data);
    setLoading(false);
  };

  const addCustomer = async () => {
    if (!form.name) return;
    const { data, error } = await supabase.from("customers").insert([form]).select().single();
    if (!error && data) {
      setCustomers([data, ...customers]);
      setForm({ name: "", phone: "", email: "", address: "" });
      setShowForm(false);
    }
  };

  const deleteCustomer = async (id: number) => {
    if (!confirm("Hapus pelanggan ini?")) return;
    await supabase.from("customers").delete().eq("id", id);
    setCustomers(customers.filter(c => c.id !== id));
    setSelected(null);
  };

  const formatRp = (n: number) => "Rp " + n.toLocaleString("id-ID");
  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0a1a0f 0%, #061009 40%, #040d07 100%)", color: "white", fontFamily: "system-ui" }}>
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Header */}
      <div style={{ padding: "14px 24px", borderBottom: "1px solid rgba(16,185,129,0.08)", display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: 13 }}><ArrowLeft size={14} /> Dashboard</a>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>›</span>
        <span style={{ fontSize: 15, fontWeight: 600 }}>CRM Pelanggan</span>
        <button onClick={() => setShowForm(true)} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, background: "#10b981", color: "black", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}>
          <Plus size={14} /> Tambah Pelanggan
        </button>
      </div>

      <div style={{ padding: "20px 24px", maxWidth: 1200, margin: "0 auto" }}>

        {/* KPI */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
          {[
            { label: "Total Pelanggan", value: customers.length, color: "#10b981" },
            { label: "Pelanggan Baru (Bulan ini)", value: customers.filter(c => c.created_at?.startsWith(new Date().toISOString().slice(0,7))).length, color: "#3b82f6" },
            { label: "Total Nilai Pembelian", value: formatRp(customers.reduce((a,b) => a + (b.total_purchases||0), 0)), color: "#a855f7" },
          ].map(kpi => (
            <div key={kpi.label} style={{ padding: 20, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{kpi.label}</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: kpi.color }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "8px 12px", marginBottom: 14 }}>
          <Search size={14} color="rgba(255,255,255,0.2)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama, nomor HP, email..." style={{ background: "transparent", border: "none", outline: "none", color: "white", fontSize: 13, flex: 1 }} />
        </div>

        {/* Grid pelanggan */}
        {loading ? (
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 40 }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <Users size={40} color="rgba(255,255,255,0.1)" style={{ margin: "0 auto 16px", display: "block" }} />
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Belum ada pelanggan. Klik "Tambah Pelanggan" untuk mulai.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {filtered.map(c => (
              <div key={c.id} onClick={() => setSelected(c)} style={{ padding: 20, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: `1px solid ${selected?.id === c.id ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.06)"}`, cursor: "pointer", transition: "all 0.2s" }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.border="1px solid rgba(16,185,129,0.2)"}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.border=selected?.id===c.id?"1px solid rgba(16,185,129,0.3)":"1px solid rgba(255,255,255,0.06)"}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ color: "black", fontWeight: 700, fontSize: 16 }}>{c.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "white" }}>{c.name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Sejak {new Date(c.created_at).toLocaleDateString("id-ID")}</p>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {c.phone && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Phone size={12} color="rgba(255,255,255,0.3)" /><span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{c.phone}</span></div>}
                  {c.email && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Mail size={12} color="rgba(255,255,255,0.3)" /><span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{c.email}</span></div>}
                  {c.address && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><MapPin size={12} color="rgba(255,255,255,0.3)" /><span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{c.address}</span></div>}
                </div>
                {c.total_purchases > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Total pembelian</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#10b981" }}>{formatRp(c.total_purchases)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Customer Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(8px)" }}>
          <div style={{ width: "100%", maxWidth: 440, background: "#0d1a10", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 20, padding: 28, position: "relative", animation: "slideUp 0.2s ease" }}>
            <button onClick={() => setShowForm(false)} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white" }}><X size={14} /></button>
            <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700 }}>Tambah Pelanggan</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Nama *", key: "name", placeholder: "Nama pelanggan" },
                { label: "No. HP / WhatsApp", key: "phone", placeholder: "08xxxxxxxxxx" },
                { label: "Email", key: "email", placeholder: "email@contoh.com" },
                { label: "Alamat", key: "address", placeholder: "Kota, Provinsi" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>{f.label}</label>
                  <input type="text" value={form[f.key as keyof typeof form]} onChange={e => setForm({...form, [f.key]: e.target.value})} placeholder={f.placeholder}
                    style={{ width: "100%", padding: "11px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
            <button onClick={addCustomer} style={{ width: "100%", marginTop: 20, padding: "13px", borderRadius: 12, background: "#10b981", color: "black", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" }}>Simpan Pelanggan</button>
          </div>
        </div>
      )}

      {/* Customer Detail Modal */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(8px)" }}>
          <div style={{ width: "100%", maxWidth: 440, background: "#0d1a10", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 20, padding: 28, position: "relative", animation: "slideUp 0.2s ease" }}>
            <button onClick={() => setSelected(null)} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white" }}><X size={14} /></button>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "black", fontWeight: 800, fontSize: 22 }}>{selected.name.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{selected.name}</h3>
                <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Pelanggan sejak {new Date(selected.created_at).toLocaleDateString("id-ID")}</p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {selected.phone && <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>
                <Phone size={16} color="#10b981" /><span style={{ fontSize: 14 }}>{selected.phone}</span>
                <a href={`https://wa.me/${selected.phone.replace(/^0/, "62")}`} target="_blank" style={{ marginLeft: "auto", padding: "4px 10px", borderRadius: 6, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981", fontSize: 11, textDecoration: "none", fontWeight: 600 }}>WA</a>
              </div>}
              {selected.email && <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>
                <Mail size={16} color="#3b82f6" /><span style={{ fontSize: 14 }}>{selected.email}</span>
              </div>}
              {selected.address && <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>
                <MapPin size={16} color="#f97316" /><span style={{ fontSize: 14 }}>{selected.address}</span>
              </div>}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => deleteCustomer(selected.id)} style={{ flex: 1, padding: "11px", borderRadius: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Hapus</button>
              <button onClick={() => setSelected(null)} style={{ flex: 1, padding: "11px", borderRadius: 12, background: "#10b981", color: "black", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}