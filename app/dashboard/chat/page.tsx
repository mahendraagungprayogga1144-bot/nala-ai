"use client";
import { useState, useRef, useEffect } from "react";
import { ArrowRight, Bot } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const suggestions = [
  "Saya jual 10 parfum harga 150 ribu",
  "Profit bulan ini berapa?",
  "Produk mana yang paling laku?",
  "Buat caption Instagram untuk parfum saya",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Halo! Saya NALA, AI assistant bisnis kamu. Mau tanya apa hari ini? 😊" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Maaf, terjadi kesalahan. Coba lagi ya!" }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#060d08", color: "white", display: "flex", flexDirection: "column", fontFamily: "system-ui" }}>
      <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(16,185,129,0.08)", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Bot size={20} color="black" />
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>NALA Chat</p>
          <p style={{ margin: 0, fontSize: 12, color: "#10b981" }}>● Online · siap membantu</p>
        </div>
        <a href="/dashboard" style={{ marginLeft: "auto", fontSize: 13, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>← Dashboard</a>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 800, margin: "0 auto", width: "100%" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 10 }}>
            {msg.role === "assistant" && (
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 4 }}>
                <span style={{ color: "black", fontWeight: 700, fontSize: 12 }}>N</span>
              </div>
            )}
            <div style={{ maxWidth: "75%", padding: "12px 16px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: msg.role === "user" ? "#10b981" : "rgba(255,255,255,0.05)", border: msg.role === "assistant" ? "1px solid rgba(255,255,255,0.08)" : "none", color: msg.role === "user" ? "black" : "rgba(255,255,255,0.9)", fontSize: 14, lineHeight: 1.6, fontWeight: msg.role === "user" ? 500 : 400, whiteSpace: "pre-wrap" }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "black", fontWeight: 700, fontSize: 12 }}>N</span>
            </div>
            <div style={{ padding: "12px 16px", borderRadius: "18px 18px 18px 4px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 6, alignItems: "center" }}>
              {[0,1,2].map(i => <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block", animation: `bounce 1s ${i * 0.2}s infinite` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: "12px 24px", borderTop: "1px solid rgba(255,255,255,0.05)", maxWidth: 800, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          {suggestions.map((s) => (
            <button key={s} onClick={() => sendMessage(s)} style={{ padding: "6px 12px", borderRadius: 20, border: "1px solid rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.05)", color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer" }}>{s}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "12px 16px" }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage(input)} placeholder="Ketik pesan ke NALA..." style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "white", fontSize: 14 }} />
          <button onClick={() => sendMessage(input)} style={{ width: 36, height: 36, borderRadius: 10, background: "#10b981", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowRight size={16} color="black" />
          </button>
        </div>
      </div>
      <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }`}</style>
    </div>
  );
}