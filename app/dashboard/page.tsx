"use client";
import { useState } from "react";
import { BarChart3, Package, Users, MessageSquare, ShoppingBag, Megaphone, Brain, CreditCard, FlaskConical, TrendingUp, AlertCircle, Home, Settings, LogOut, Search, Bell, ChevronDown, ArrowUp, Zap } from "lucide-react";

const navItems = [
  { icon: Home, name: "Dashboard", path: "/dashboard", active: true },
  { icon: MessageSquare, name: "NALA Chat", path: "/dashboard/chat", color: "#10b981" },
  { icon: BarChart3, name: "Finance", path: "/dashboard/finance", color: "#3b82f6" },
  { icon: Package, name: "Inventory", path: "/dashboard/inventory", color: "#f97316" },
  { icon: Users, name: "CRM", path: "/dashboard/crm", color: "#a855f7" },
  { icon: ShoppingBag, name: "Marketplace", path: "/dashboard/marketplace", color: "#ec4899" },
  { icon: Megaphone, name: "Marketing", path: "/dashboard/marketing", color: "#eab308" },
  { icon: Brain, name: "Research", path: "/dashboard/research", color: "#06b6d4" },
  { icon: CreditCard, name: "Tax Center", path: "/dashboard/tax", color: "#22c55e" },
];

const kpis = [
  { label: "Total Revenue", value: "Rp 128.500.000", change: "+18.2%", icon: TrendingUp, color: "#10b981" },
  { label: "Net Profit", value: "Rp 34.750.000", change: "+12.4%", icon: BarChart3, color: "#3b82f6" },
  { label: "Cashflow", value: "Rp 21.300.000", change: "+8.1%", icon: Zap, color: "#a855f7" },
  { label: "Active Customers", value: "1.245", change: "+24 baru", icon: Users, color: "#ec4899" },
];

const inventoryAlerts = [
  { name: "Black Opium", stock: 12, min: 20, color: "#f97316" },
  { name: "Baccarat Rouge", stock: 8, min: 20, color: "#ef4444" },
  { name: "Dior Sauvage", stock: 5, min: 20, color: "#ef4444" },
];

const topProducts = [
  { name: "Baccarat Rouge 540", revenue: "Rp 24.5jt", growth: "+32%", rank: 1 },
  { name: "Dior Sauvage", revenue: "Rp 18.2jt", growth: "+18%", rank: 2 },
  { name: "Black Opium", revenue: "Rp 15.7jt", growth: "+12%", rank: 3 },
];

const marketplaces = [
  { name: "Shopee", revenue: "Rp 52.3jt", orders: 312, color: "#f97316", pct: 72 },
  { name: "TikTok Shop", revenue: "Rp 31.8jt", orders: 198, color: "#000000", pct: 45 },
  { name: "Tokopedia", revenue: "Rp 24.4jt", orders: 156, color: "#22c55e", pct: 35 },
];

const chartBars = [42, 68, 55, 78, 62, 88, 74, 91, 83, 95, 87, 100];
const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

const chatMessages = [
  { role: "user", text: "Saya jual 10 parfum harga 150 ribu" },
  { role: "nala", text: "✅ Transaksi berhasil dicatat.\nOmzet bertambah Rp 1.500.000. Stok dikurangi 10.", highlight: "Rp 1.500.000" },
  { role: "user", text: "Profit bulan ini berapa?" },
  { role: "nala", text: "Profit bersih bulan ini Rp 14.180.000 dari 312 transaksi. Margin 30% — naik 2.1%.", highlight: "Rp 14.180.000" },
];

export default function Dashboard() {
  const [chatInput, setChatInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        
        {/* TOP NAVBAR */}
        <header style={{ height: 60, borderBottom: "1px solid rgba(16,185,129,0.06)", background: "rgba(6,13,8,0.9)", backdropFilter: "blur(20px)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, position: "sticky", top: 0, zIndex: 30 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "8px 14px", maxWidth: 320 }}>
            <Search size={14} color="rgba(255,255,255,0.25)" />
            <input placeholder="Cari fitur, transaksi..." style={{ background: "transparent", border: "none", outline: "none", color: "white", fontSize: 13, flex: 1 }} />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <button style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Bell size={15} color="rgba(255,255,255,0.5)" />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "black", fontWeight: 700, fontSize: 11 }}>M</span>
              </div>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Mahendra</span>
              <ChevronDown size={13} color="rgba(255,255,255,0.3)" />
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main style={{ flex: 1, padding: 24, overflowY: "auto" }}>
          
          {/* Page Header */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "white" }}>Dashboard</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Selamat datang, Mahendra 👋 — Berikut ringkasan bisnis kamu hari ini.</p>
          </div>

          {/* KPI CARDS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>
            {kpis.map((kpi) => (
              <div key={kpi.label} style={{ padding: 20, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, borderRadius: "50%", background: kpi.color + "08", transform: "translate(20px, -20px)" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{kpi.label}</p>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: kpi.color + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <kpi.icon size={15} color={kpi.color} />
                  </div>
                </div>
                <p style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "white" }}>{kpi.value}</p>
                <span style={{ fontSize: 12, color: "#10b981", display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(16,185,129,0.1)", padding: "3px 8px", borderRadius: 6 }}>
                  <ArrowUp size={10} /> {kpi.change}
                </span>
              </div>
            ))}
          </div>

          {/* CHARTS ROW */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 20 }}>
            
            {/* Revenue Chart */}
            <div style={{ padding: 22, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "white" }}>Revenue Overview</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>12 bulan terakhir</p>
                </div>
                <span style={{ fontSize: 11, color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "4px 10px", borderRadius: 6 }}>+18.2% YoY</span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100, marginBottom: 8 }}>
                {chartBars.map((h, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ width: "100%", height: `${h}%`, borderRadius: 4, background: i === 11 ? "#10b981" : i >= 9 ? "rgba(16,185,129,0.4)" : "rgba(16,185,129,0.15)", transition: "all 0.3s" }} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {months.map((m, i) => (
                  <span key={i} style={{ flex: 1, textAlign: "center", fontSize: 9, color: "rgba(255,255,255,0.2)" }}>{m}</span>
                ))}
              </div>
            </div>

            {/* Profit Chart */}
            <div style={{ padding: 22, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ marginBottom: 20 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "white" }}>Profit Margin</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Bulan ini</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                <div style={{ position: "relative", width: 110, height: 110 }}>
                  <svg viewBox="0 0 110 110" style={{ transform: "rotate(-90deg)", width: "100%", height: "100%" }}>
                    <circle cx="55" cy="55" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                    <circle cx="55" cy="55" r="45" fill="none" stroke="#10b981" strokeWidth="10" strokeDasharray={`${2 * Math.PI * 45 * 0.27} ${2 * Math.PI * 45 * 0.73}`} strokeLinecap="round" />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "white" }}>27%</p>
                    <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>margin</p>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[{ label: "Revenue", pct: 100, color: "rgba(255,255,255,0.15)" }, { label: "HPP", pct: 58, color: "#ef4444" }, { label: "Profit", pct: 27, color: "#10b981" }].map((item) => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", width: 48 }}>{item.label}</span>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.05)" }}>
                      <div style={{ width: `${item.pct}%`, height: "100%", borderRadius: 2, background: item.color }} />
                    </div>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", width: 30, textAlign: "right" }}>{item.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* BOTTOM ROW */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            
            {/* Inventory Alerts */}
            <div style={{ padding: 22, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <AlertCircle size={15} color="#f97316" />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "white" }}>Stok Hampir Habis</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {inventoryAlerts.map((item) => (
                  <div key={item.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "white" }}>{item.name}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Min: {item.min} unit</p>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: item.color, background: item.color + "15", padding: "4px 10px", borderRadius: 8 }}>{item.stock}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Products */}
            <div style={{ padding: 22, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "white" }}>Top Products</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {topProducts.map((p) => (
                  <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#10b981" }}>#{p.rank}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "white" }}>{p.name}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{p.revenue}</p>
                    </div>
                    <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>{p.growth}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Marketplace Performance */}
            <div style={{ padding: 22, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "white" }}>Marketplace</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {marketplaces.map((m) => (
                  <div key={m.name}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>{m.name}</span>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{m.revenue}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.05)" }}>
                      <div style={{ width: `${m.pct}%`, height: "100%", borderRadius: 3, background: m.name === "Shopee" ? "#f97316" : m.name === "TikTok Shop" ? "#a855f7" : "#22c55e" }} />
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{m.orders} pesanan</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AI CHAT WIDGET */}
          <div style={{ marginTop: 14, padding: 22, borderRadius: 16, background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.12)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "black", fontWeight: 700, fontSize: 13 }}>N</span>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "white" }}>NALA Chat</p>
                <p style={{ margin: 0, fontSize: 11, color: "#10b981" }}>● Online · siap membantu</p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "60%", padding: "10px 14px", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: msg.role === "user" ? "#10b981" : "rgba(255,255,255,0.05)", border: msg.role === "nala" ? "1px solid rgba(255,255,255,0.08)" : "none", color: msg.role === "user" ? "black" : "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: msg.role === "user" ? 500 : 400, lineHeight: 1.5 }}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 14px" }}>
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ketik pesan ke NALA..." style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "white", fontSize: 13 }} />
              <button onClick={() => setChatInput("")} style={{ padding: "6px 14px", borderRadius: 8, background: "#10b981", color: "black", fontWeight: 600, fontSize: 12, border: "none", cursor: "pointer" }}>Kirim</button>
            </div>
          </div>
        </main>
      </div>
      );
}