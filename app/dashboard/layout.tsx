"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Home, MessageSquare, BarChart3, Package, Users, ShoppingBag, Megaphone, Brain, CreditCard, Settings, LogOut, ChevronDown } from "lucide-react";

const navItems = [
  { icon: Home, name: "Dashboard", path: "/dashboard" },
  { icon: MessageSquare, name: "NALA Chat", path: "/dashboard/chat", color: "#10b981" },
  { icon: BarChart3, name: "Finance", path: "/dashboard/finance", color: "#3b82f6" },
  { icon: Package, name: "Inventory", path: "/dashboard/inventory", color: "#f97316" },
  { icon: Users, name: "CRM", path: "/dashboard/crm", color: "#a855f7" },
  { icon: ShoppingBag, name: "Marketplace", path: "/dashboard/marketplace", color: "#ec4899" },
  { icon: Megaphone, name: "Marketing", path: "/dashboard/marketing", color: "#eab308" },
  { icon: Brain, name: "Research", path: "/dashboard/research", color: "#06b6d4" },
  { icon: CreditCard, name: "Tax Center", path: "/dashboard/tax", color: "#22c55e" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div style={{ minHeight: "100vh", background: "#060d08", display: "flex", fontFamily: "system-ui" }}>
      <aside style={{ width: 220, background: "rgba(4,10,6,0.95)", borderRight: "1px solid rgba(16,185,129,0.08)", display: "flex", flexDirection: "column", padding: "20px 12px", position: "fixed", height: "100vh", zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px", marginBottom: 20 }}>
          <img src="/logo.png" alt="NALA AI" style={{ width: 34, height: 34, borderRadius: 10, objectFit: "contain" }} />
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "white" }}>NALA AI</p>
            <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Business OS</p>
          </div>
        </div>
        <div style={{ padding: "8px 10px", borderRadius: 10, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.1)", marginBottom: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "white" }}>Henima Parfum</p>
            <p style={{ margin: 0, fontSize: 10, color: "#10b981" }}>● Aktif</p>
          </div>
          <ChevronDown size={14} color="rgba(255,255,255,0.3)" />
        </div>
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {navItems.map((item) => {
            const active = pathname === item.path;
            return (
              <a key={item.name} href={item.path} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9, background: active ? "rgba(16,185,129,0.12)" : "transparent", border: active ? "1px solid rgba(16,185,129,0.2)" : "1px solid transparent", color: active ? "#10b981" : "rgba(255,255,255,0.45)", textDecoration: "none", fontSize: 13, fontWeight: active ? 600 : 400 }}>
                <item.icon size={15} color={active ? "#10b981" : (item.color || "rgba(255,255,255,0.4)")} />
                {item.name}
              </a>
            );
          })}
        </nav>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 2 }}>
          <a href="/dashboard/settings" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9, color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: 13 }}><Settings size={15} /> Pengaturan</a>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9, color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: 13 }}><LogOut size={15} /> Keluar</a>
        </div>
      </aside>
      <div style={{ marginLeft: 220, flex: 1 }}>
        {children}
      </div>
    </div>
  );
}