"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowRight, Mail, Lock, User } from "lucide-react";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    if (mode === "register") {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (error) setMessage(error.message);
      else setMessage("Cek email kamu untuk verifikasi!");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else window.location.href = "/dashboard";
    }
    setLoading(false);
  };

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0a1a0f 0%, #061009 40%, #040d07 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <span style={{ color: "black", fontWeight: 800, fontSize: 20 }}>N</span>
          </div>
          <h1 style={{ color: "white", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            {mode === "login" ? "Masuk ke NALA AI" : "Buat Akun NALA AI"}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
            {mode === "login" ? "Selamat datang kembali!" : "Mulai kelola bisnis dengan AI"}
          </p>
        </div>

        <div style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 20, padding: 28 }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {mode === "register" && (
              <div>
                <label style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 8, display: "block" }}>Nama Lengkap</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 12, padding: "12px 16px" }}>
                  <User size={16} color="rgba(255,255,255,0.3)" />
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mahendra" required style={{ flex: 1, background: "transparent", border: "none", color: "white", fontSize: 14, outline: "none" }} />
                </div>
              </div>
            )}
            <div>
              <label style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 8, display: "block" }}>Email</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 12, padding: "12px 16px" }}>
                <Mail size={16} color="rgba(255,255,255,0.3)" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kamu@email.com" required style={{ flex: 1, background: "transparent", border: "none", color: "white", fontSize: 14, outline: "none" }} />
              </div>
            </div>
            <div>
              <label style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 8, display: "block" }}>Password</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 12, padding: "12px 16px" }}>
                <Lock size={16} color="rgba(255,255,255,0.3)" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required style={{ flex: 1, background: "transparent", border: "none", color: "white", fontSize: 14, outline: "none" }} />
              </div>
            </div>
            {message && (
              <div style={{ padding: "10px 14px", borderRadius: 10, background: message.includes("Cek") ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${message.includes("Cek") ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`, color: message.includes("Cek") ? "#10b981" : "#ef4444", fontSize: 13 }}>
                {message}
              </div>
            )}
            <button type="submit" disabled={loading} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", borderRadius: 12, background: "#10b981", color: "black", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Loading..." : mode === "login" ? "Masuk" : "Daftar"} <ArrowRight size={16} />
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button onClick={() => setMode(mode === "login" ? "register" : "login")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 13, cursor: "pointer" }}>
              {mode === "login" ? "Belum punya akun? " : "Sudah punya akun? "}
              <span style={{ color: "#10b981", fontWeight: 600 }}>{mode === "login" ? "Daftar gratis" : "Masuk"}</span>
            </button>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <a href="/" style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, textDecoration: "none" }}>← Kembali ke beranda</a>
        </div>
      </div>
    </main>
  );
}