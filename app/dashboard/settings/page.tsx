export default function Page() {
  return (
    <div style={{ minHeight: "100vh", background: "#060d08", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <span style={{ fontSize: 28 }}>🚧</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Pengaturan</h1>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginBottom: 24 }}>Modul ini sedang dalam pengembangan.</p>
        <a href="/dashboard" style={{ padding: "10px 24px", borderRadius: 10, background: "#10b981", color: "black", fontWeight: 600, textDecoration: "none", fontSize: 14 }}>← Kembali ke Dashboard</a>
      </div>
    </div>
  );
}