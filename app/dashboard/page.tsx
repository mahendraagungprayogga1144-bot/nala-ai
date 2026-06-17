"use client";
import { BarChart3, Package, Users, MessageSquare, ShoppingBag, Megaphone, Brain, CreditCard, FlaskConical, TrendingUp, AlertCircle, Home, Settings, LogOut } from "lucide-react";

const stats = [
  { label: "Omzet Hari Ini", value: "Rp 4.280.000", change: "+12.4%", up: true },
  { label: "Profit Bersih", value: "Rp 1.284.000", change: "+8.1%", up: true },
  { label: "Total Transaksi", value: "312", change: "+5.2%", up: true },
  { label: "Stok Hampir Habis", value: "3 produk", change: "Perlu restock", up: false },
];

const modules = [
  { icon: MessageSquare, name: "NALA Chat", desc: "Chat dengan AI", color: "#10b981", path: "/dashboard/chat" },
  { icon: BarChart3, name: "Business Finance", desc: "Laporan keuangan", color: "#3b82f6", path: "/dashboard/finance" },
  { icon: Package, name: "Inventory", desc: "Kelola stok", color: "#f97316", path: "/dashboard/inventory" },
  { icon: Users, name: "CRM", desc: "Data pelanggan", color: "#a855f7", path: "/dashboard/crm" },
  { icon: ShoppingBag, name: "Marketplace", desc: "Shopee, TikTok, Tokped", color: "#ec4899", path: "/dashboard/marketplace" },
  { icon: Megaphone, name: "AI Marketing", desc: "Buat konten", color: "#eab308", path: "/dashboard/marketing" },
  { icon: Brain, name: "AI Research", desc: "Riset pasar", color: "#06b6d4", path: "/dashboard/research" },
  { icon: CreditCard, name: "AI Kasir", desc: "Point of Sale", color: "#22c55e", path: "/dashboard/pos" },
  { icon: FlaskConical, name: "NALA R&D", desc: "Formulasi produk", color: "#8b5cf6", path: "/dashboard/rnd" },
];

export default function Dashboard() {
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0a1a0f 0%, #061009 40%, #040d07 100%)", fontFamily: "system-ui, sans-serif", display: "flex" }}>
      
      {/* Sidebar */}
      <div style={{ width: 240, borderRight: "1px solid rgba(16,185,129,0.1)", background: "rgba(4,13,7,0.8)", display: "flex", flexDirection: "column", padding: "24px 16px", position: "fixed", height: "100vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32, padding: "0 8px" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "black", fontWeight: 800, fontSize: 16 }}>N</span>
          </div>
          <div>
            <p style={{ color: "white", fontWeight: 700, fontSize: 14, margin: 0 }}>NALA AI</p>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, margin: 0 }}>Business OS</p>
          </div>
        </div>

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <a href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981", textDecoration: "none", fontSize: 14, fontWeight: 500 }}>
            <Home size={16} /> Dashboard
          </a>
          {modules.map((mod) => (
            <a key={mod.name} href={mod.path} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: 14 }}>
              <mod.icon size={16} color={mod.color} /> {mod.name}
            </a>
          ))}
        </nav>

        <div style={{ borderTop: "1px solid rgba(16,185,129,0.1)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 4 }}>
          <a href="/dashboard/settings" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 14 }}>
            <Settings size={16} /> Pengaturan
          </a>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 14 }}>
            <LogOut size={16} /> Keluar
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ marginLeft: 240, flex: 1, padding: 32 }}>
        
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ color: "white", fontSize: 24, fontWeight: 700, margin: 0 }}>Selamat datang! 👋</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginTop: 4 }}>Berikut ringkasan bisnis kamu hari ini.</p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ padding: 20, borderRadius: 16, background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.1)" }}>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 8 }}>{s.label}</p>
              <p style={{ color: "white", fontWeight: 700, fontSize: 22, marginBottom: 6 }}>{s.value}</p>
              <p style={{ color: s.up ? "#10b981" : "#f97316", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                {s.up ? <TrendingUp size={12} /> : <AlertCircle size={12} />} {s.change}
              </p>
            </div>
          ))}
        </div>

        {/* Modules Grid */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ color: "white", fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Modul NALA AI</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {modules.map((mod) => (
              <a key={mod.name} href={mod.path} style={{ padding: 20, borderRadius: 16, background: "rgba(6,20,10,0.8)", border: "1px solid rgba(16,185,129,0.08)", textDecoration: "none", display: "block" }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: mod.color + "20", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <mod.icon size={20} color={mod.color} />
                </div>
                <p style={{ color: "white", fontWeight: 600, fontSize: 14, margin: "0 0 4px" }}>{mod.name}</p>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, margin: 0 }}>{mod.desc}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}