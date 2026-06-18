"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { TrendingUp, TrendingDown, Plus, ArrowLeft, BarChart3, Download, Search, ChevronUp, ChevronDown, ArrowUpDown, X, FileText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

interface Transaction {
  id: number;
  type: "income" | "expense";
  amount: number;
  description: string;
  category: string;
  date: string;
}

const initialTransactions: Transaction[] = [
  { id: 1, type: "income", amount: 1500000, description: "Jual 10 parfum Black Opium", category: "Penjualan", date: "2025-06-17" },
  { id: 2, type: "income", amount: 2400000, description: "Jual 16 parfum Baccarat Rouge", category: "Penjualan", date: "2025-06-16" },
  { id: 3, type: "expense", amount: 500000, description: "Beli bahan baku bibit", category: "HPP", date: "2025-06-15" },
  { id: 4, type: "income", amount: 900000, description: "Jual 6 parfum Dior Sauvage", category: "Penjualan", date: "2025-06-15" },
  { id: 5, type: "expense", amount: 150000, description: "Ongkos kirim", category: "Operasional", date: "2025-06-14" },
  { id: 6, type: "income", amount: 3600000, description: "Jual 24 parfum Afternoon", category: "Penjualan", date: "2025-06-13" },
  { id: 7, type: "expense", amount: 300000, description: "Biaya iklan Instagram", category: "Marketing", date: "2025-06-12" },
  { id: 8, type: "income", amount: 750000, description: "Jual 5 parfum The Distance", category: "Penjualan", date: "2025-06-11" },
];

type SortKey = "date" | "amount" | "category" | "type";
type SortDir = "asc" | "desc";

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    prevRef.current = value;
    if (start === end) return;
    const duration = 600;
    const steps = 30;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (step >= steps) { setDisplay(end); clearInterval(timer); }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);
  return <>{"Rp " + display.toLocaleString("id-ID")}</>;
}

export default function FinancePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    setLoadingData(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false });
    if (!error && data) {
      setTransactions(data.map(t => ({ ...t, amount: Number(t.amount) })));
    } else {
      setTransactions(initialTransactions);
    }
    setLoadingData(false);
  };
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "income", amount: "", description: "", category: "Penjualan" });
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [activeChart, setActiveChart] = useState<"bar"|"pie">("bar");

  const formatRp = (n: number) => "Rp " + n.toLocaleString("id-ID");

  const filtered = useMemo(() => {
    let data = [...transactions];
    if (search) data = data.filter(t => t.description.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase()));
    if (filterType !== "all") data = data.filter(t => t.type === filterType);
    data.sort((a, b) => {
      const va = sortKey === "amount" ? a.amount : a[sortKey];
      const vb = sortKey === "amount" ? b.amount : b[sortKey];
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return data;
  }, [transactions, search, filterType, sortKey, sortDir]);

  const totalIncome = filtered.filter(t => t.type === "income").reduce((a, b) => a + b.amount, 0);
  const totalExpense = filtered.filter(t => t.type === "expense").reduce((a, b) => a + b.amount, 0);
  const profit = totalIncome - totalExpense;
  const margin = totalIncome > 0 ? ((profit/totalIncome)*100).toFixed(1) : "0";

  const categoryData = useMemo(() => {
    const cats: Record<string, {income:number, expense:number}> = {};
    filtered.forEach(t => {
      if (!cats[t.category]) cats[t.category] = { income: 0, expense: 0 };
      if (t.type === "income") cats[t.category].income += t.amount;
      else cats[t.category].expense += t.amount;
    });
    return Object.entries(cats).map(([name, v]) => ({ name, pemasukan: v.income, pengeluaran: v.expense, net: v.income - v.expense }));
  }, [filtered]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const addTransaction = async () => {
    if (!form.amount || !form.description) return;
    const newT = { type: form.type, amount: parseInt(form.amount), description: form.description, category: form.category, date: new Date().toISOString().split("T")[0] };
    const { data, error } = await supabase.from("transactions").insert([newT]).select().single();
    if (!error && data) {
      setTransactions([{ ...data, amount: Number(data.amount) }, ...transactions]);
    } else {
      setTransactions([{ id: Date.now(), ...newT, type: newT.type as "income"|"expense" }, ...transactions]);
    }
    setForm({ type: "income", amount: "", description: "", category: "Penjualan" });
    setShowForm(false);
  };

  const exportExcel = async () => {
    const date = new Date().toISOString().split("T")[0];
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();

    const darkBg = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF080F0A" } };
    const greenBg = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF0A2E1A" } };
    const redBg = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF2E0A0A" } };
    const titleBg = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF041008" } };
    const headerBg = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF0D1A10" } };

    // SHEET 1: REKAP
    const ws1 = wb.addWorksheet("📊 Rekap Utama");
    ws1.columns = [{ width: 30 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 16 }];

    ws1.mergeCells("A1:E1");
    Object.assign(ws1.getCell("A1"), {
      value: "LAPORAN KEUANGAN NALA AI",
      font: { bold: true, size: 16, color: { argb: "FF10B981" } },
      fill: titleBg,
      alignment: { horizontal: "center", vertical: "middle" }
    });
    ws1.getRow(1).height = 35;

    ws1.mergeCells("A2:E2");
    Object.assign(ws1.getCell("A2"), {
      value: `Export: ${date} | Total ${filtered.length} Transaksi`,
      font: { size: 10, color: { argb: "FF888888" } },
      fill: titleBg,
      alignment: { horizontal: "center" }
    });

    ws1.addRow([]);

    // Summary
    [
      ["RINGKASAN", "", "", "", ""],
      ["Total Pemasukan", totalIncome, "", `${filtered.filter(t=>t.type==="income").length} transaksi masuk`, ""],
      ["Total Pengeluaran", totalExpense, "", `${filtered.filter(t=>t.type==="expense").length} transaksi keluar`, ""],
      ["Profit Bersih", profit, "", "", ""],
      ["Margin Profit", `${margin}%`, "", "", ""],
    ].forEach((row, i) => {
      const r = ws1.addRow(row);
      r.height = 22;
      if (i === 0) {
        r.getCell(1).font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
        r.getCell(1).fill = headerBg;
        ws1.mergeCells(`A${r.number}:E${r.number}`);
      } else {
        r.getCell(1).font = { bold: true, color: { argb: "FFCCCCCC" } };
        r.getCell(1).fill = darkBg;
        if (typeof row[1] === "number") {
          r.getCell(2).numFmt = '"Rp "#,##0';
          const isExp = row[0] === "Total Pengeluaran";
          const isProfit = row[0] === "Profit Bersih";
          r.getCell(2).font = { bold: true, size: 12, color: { argb: isExp ? "FFEF4444" : "FF10B981" } };
          r.getCell(2).fill = isExp ? redBg : greenBg;
        } else {
          r.getCell(2).font = { bold: true, color: { argb: "FF10B981" } };
          r.getCell(2).fill = greenBg;
        }
        r.getCell(3).fill = darkBg;
        r.getCell(4).font = { color: { argb: "FF888888" }, size: 10 };
        r.getCell(4).fill = darkBg;
        r.getCell(5).fill = darkBg;
      }
    });

    ws1.addRow([]);

    // Per Kategori
    const catHeaderRow = ws1.addRow(["REKAP PER KATEGORI", "", "", "", ""]);
    catHeaderRow.getCell(1).font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    catHeaderRow.getCell(1).fill = headerBg;
    ws1.mergeCells(`A${catHeaderRow.number}:E${catHeaderRow.number}`);
    catHeaderRow.height = 24;

    const colH = ws1.addRow(["Kategori", "Pemasukan (Rp)", "Pengeluaran (Rp)", "Net (Rp)", "Jml"]);
    colH.eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FF10B981" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF041008" } };
      cell.alignment = { horizontal: "center" };
      cell.border = { bottom: { style: "thin", color: { argb: "FF10B981" } } };
    });
    colH.height = 20;

    categoryData.forEach(c => {
      const cnt = filtered.filter(t=>t.category===c.name).length;
      const r = ws1.addRow([c.name, c.pemasukan, c.pengeluaran, c.net, cnt]);
      r.getCell(1).font = { bold: true, color: { argb: "FFEEEEEE" } };
      r.getCell(1).fill = darkBg;
      r.getCell(2).numFmt = '"Rp "#,##0'; r.getCell(2).font = { bold: true, color: { argb: "FF10B981" } }; r.getCell(2).fill = greenBg;
      r.getCell(3).numFmt = '"Rp "#,##0'; r.getCell(3).font = { bold: true, color: { argb: "FFEF4444" } }; r.getCell(3).fill = redBg;
      r.getCell(4).numFmt = '"Rp "#,##0'; r.getCell(4).font = { bold: true, color: { argb: c.net>=0?"FF10B981":"FFEF4444" } }; r.getCell(4).fill = c.net>=0?greenBg:redBg;
      r.getCell(5).font = { color: { argb: "FF888888" } }; r.getCell(5).fill = darkBg; r.getCell(5).alignment = { horizontal: "center" };
      r.height = 20;
    });

    // SHEET 2: SEMUA TRANSAKSI
    const ws2 = wb.addWorksheet("📋 Semua Transaksi");
    ws2.columns = [{ width: 5 }, { width: 13 }, { width: 15 }, { width: 15 }, { width: 38 }, { width: 18 }];

    ws2.mergeCells("A1:F1");
    Object.assign(ws2.getCell("A1"), { value: "DETAIL TRANSAKSI - NALA AI", font: { bold: true, size: 14, color: { argb: "FF10B981" } }, fill: titleBg, alignment: { horizontal: "center", vertical: "middle" } });
    ws2.getRow(1).height = 30;
    ws2.addRow([]);

    const ws2h = ws2.addRow(["No", "Tanggal", "Tipe", "Kategori", "Deskripsi", "Jumlah (Rp)"]);
    ws2h.eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FF10B981" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF041008" } };
      cell.border = { bottom: { style: "medium", color: { argb: "FF10B981" } } };
      cell.alignment = { horizontal: "center" };
    });

    filtered.forEach((t, i) => {
      const isInc = t.type === "income";
      const r = ws2.addRow([i+1, t.date, isInc?"PEMASUKAN":"PENGELUARAN", t.category, t.description, isInc?t.amount:-t.amount]);
      const rowBg = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: i%2===0?"FF080F0A":"FF0A1208" } };
      r.getCell(1).font = { color: { argb: "FF666666" } }; r.getCell(1).fill = rowBg; r.getCell(1).alignment = { horizontal: "center" };
      r.getCell(2).font = { color: { argb: "FF999999" } }; r.getCell(2).fill = rowBg;
      r.getCell(3).font = { bold: true, color: { argb: isInc?"FF10B981":"FFEF4444" } }; r.getCell(3).fill = isInc?greenBg:redBg; r.getCell(3).alignment = { horizontal: "center" };
      r.getCell(4).font = { color: { argb: "FFAAAAAA" } }; r.getCell(4).fill = rowBg;
      r.getCell(5).font = { color: { argb: "FFDDDDDD" } }; r.getCell(5).fill = rowBg;
      r.getCell(6).numFmt = '"Rp "#,##0'; r.getCell(6).font = { bold: true, color: { argb: isInc?"FF10B981":"FFEF4444" } }; r.getCell(6).fill = isInc?greenBg:redBg; r.getCell(6).alignment = { horizontal: "right" };
      r.height = 20;
    });

    const totRow = ws2.addRow(["","","","","TOTAL PROFIT BERSIH", profit]);
    totRow.getCell(5).font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } }; totRow.getCell(5).fill = headerBg;
    totRow.getCell(6).numFmt = '"Rp "#,##0'; totRow.getCell(6).font = { bold: true, size: 13, color: { argb: profit>=0?"FF10B981":"FFEF4444" } }; totRow.getCell(6).fill = profit>=0?greenBg:redBg; totRow.getCell(6).alignment = { horizontal: "right" };
    totRow.height = 26;

    // SHEET PER KATEGORI
    const catGroups: Record<string, Transaction[]> = {};
    filtered.forEach(t => { if (!catGroups[t.category]) catGroups[t.category] = []; catGroups[t.category].push(t); });

    Object.entries(catGroups).forEach(([cat, txs]) => {
      const cInc = txs.filter(t=>t.type==="income").reduce((a,b)=>a+b.amount,0);
      const cExp = txs.filter(t=>t.type==="expense").reduce((a,b)=>a+b.amount,0);
      const ws = wb.addWorksheet(`📁 ${cat.substring(0,25)}`);
      ws.columns = [{ width: 5 }, { width: 13 }, { width: 15 }, { width: 38 }, { width: 18 }];

      ws.mergeCells("A1:E1");
      Object.assign(ws.getCell("A1"), { value: `KATEGORI: ${cat.toUpperCase()}`, font: { bold: true, size: 13, color: { argb: "FF10B981" } }, fill: titleBg, alignment: { horizontal: "center", vertical: "middle" } });
      ws.getRow(1).height = 28;
      ws.addRow([]);

      [["Total Pemasukan", cInc], ["Total Pengeluaran", cExp], ["Net Profit", cInc-cExp]].forEach(([lbl, val]) => {
        const isExp = lbl === "Total Pengeluaran";
        const isNet = lbl === "Net Profit";
        const r = ws.addRow([lbl as string, val as number]);
        r.getCell(1).font = { bold: true, color: { argb: "FFCCCCCC" } }; r.getCell(1).fill = darkBg;
        r.getCell(2).numFmt = '"Rp "#,##0'; r.getCell(2).font = { bold: true, size: 12, color: { argb: isExp?"FFEF4444":(isNet&&(val as number)<0?"FFEF4444":"FF10B981") } }; r.getCell(2).fill = isExp?redBg:greenBg;
        r.height = 22;
      });

      ws.addRow([]);
      const h = ws.addRow(["No", "Tanggal", "Tipe", "Deskripsi", "Jumlah (Rp)"]);
      h.eachCell(cell => { cell.font = { bold: true, color: { argb: "FF10B981" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF041008" } }; cell.border = { bottom: { style: "medium", color: { argb: "FF10B981" } } }; cell.alignment = { horizontal: "center" }; });

      txs.forEach((t, i) => {
        const isInc = t.type==="income";
        const bg = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: i%2===0?"FF080F0A":"FF0A1208" } };
        const r = ws.addRow([i+1, t.date, isInc?"PEMASUKAN":"PENGELUARAN", t.description, isInc?t.amount:-t.amount]);
        r.getCell(1).font = { color: { argb: "FF666666" } }; r.getCell(1).fill = bg; r.getCell(1).alignment = { horizontal: "center" };
        r.getCell(2).font = { color: { argb: "FF999999" } }; r.getCell(2).fill = bg;
        r.getCell(3).font = { bold: true, color: { argb: isInc?"FF10B981":"FFEF4444" } }; r.getCell(3).fill = isInc?greenBg:redBg; r.getCell(3).alignment = { horizontal: "center" };
        r.getCell(4).font = { color: { argb: "FFDDDDDD" } }; r.getCell(4).fill = bg;
        r.getCell(5).numFmt = '"Rp "#,##0'; r.getCell(5).font = { bold: true, color: { argb: isInc?"FF10B981":"FFEF4444" } }; r.getCell(5).fill = isInc?greenBg:redBg; r.getCell(5).alignment = { horizontal: "right" };
        r.height = 20;
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `NALA_Finance_${date}.xlsx`; a.click();
  };

  const th: React.CSSProperties = { padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", background: "rgba(255,255,255,0.02)" };
  const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13, borderBottom: "1px solid rgba(255,255,255,0.03)", whiteSpace: "nowrap" };

  const COLORS = ["#10b981", "#ef4444", "#3b82f6", "#f97316", "#a855f7", "#eab308"];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0a1a0f 0%, #061009 40%, #040d07 100%)", color: "white", fontFamily: "system-ui" }}>
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Header */}
      <div style={{ padding: "14px 24px", borderBottom: "1px solid rgba(16,185,129,0.08)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <a href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: 13 }}><ArrowLeft size={14} /> Dashboard</a>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>›</span>
        <span style={{ fontSize: 15, fontWeight: 600 }}>Business Finance</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={exportExcel} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <Download size={14} /> Export Excel
          </button>
          <button onClick={() => setShowForm(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, background: "#10b981", color: "black", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}>
            <Plus size={14} /> Catat Transaksi
          </button>
        </div>
      </div>

      <div style={{ padding: "20px 24px", maxWidth: 1200, margin: "0 auto" }}>

        {/* KPI */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
          {[
            { label: "Total Pemasukan", value: totalIncome, icon: TrendingUp, color: "#10b981", sub: `${filtered.filter(t=>t.type==="income").length} transaksi` },
            { label: "Total Pengeluaran", value: totalExpense, icon: TrendingDown, color: "#ef4444", sub: `${filtered.filter(t=>t.type==="expense").length} transaksi` },
            { label: "Profit Bersih", value: profit, icon: BarChart3, color: profit >= 0 ? "#10b981" : "#ef4444", sub: `Margin ${margin}%` },
          ].map((kpi) => (
            <div key={kpi.label} style={{ padding: 20, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{kpi.label}</p>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: kpi.color + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <kpi.icon size={18} color={kpi.color} />
                </div>
              </div>
              <p style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: kpi.color }}><AnimatedNumber value={kpi.value} /></p>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div style={{ borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Analisis Per Kategori</p>
            <div style={{ display: "flex", gap: 6 }}>
              {(["bar","pie"] as const).map(c => (
                <button key={c} onClick={() => setActiveChart(c)} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${activeChart===c?"rgba(16,185,129,0.4)":"rgba(255,255,255,0.08)"}`, background: activeChart===c?"rgba(16,185,129,0.1)":"transparent", color: activeChart===c?"#10b981":"rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer" }}>
                  {c === "bar" ? "Bar" : "Pie"}
                </button>
              ))}
            </div>
          </div>
          {activeChart === "bar" ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoryData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000000).toFixed(0)}jt`} />
                <Tooltip contentStyle={{ background: "#0d1a10", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, fontSize: 12 }} formatter={(v: number | string) => [formatRp(Number(v)), ""]} />
                <Bar dataKey="pemasukan" fill="#10b981" radius={[4,4,0,0]} maxBarSize={40} />
                <Bar dataKey="pengeluaran" fill="#ef4444" radius={[4,4,0,0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={[{name:"Pemasukan",value:totalIncome},{name:"Pengeluaran",value:totalExpense}]} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" animationDuration={600}>
                    <Cell fill="#10b981" /><Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip formatter={(v:number) => formatRp(v)} contentStyle={{ background: "#0d1a10", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, fontSize: 12 }} />
                  <Legend formatter={v => <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                {categoryData.map((c, i) => (
                  <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS[i%COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", flex: 1 }}>{c.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: c.net>=0?"#10b981":"#ef4444" }}>{formatRp(c.net)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Form Modal */}
        {showForm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(8px)" }}>
            <div style={{ width: "100%", maxWidth: 440, background: "#0d1a10", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 20, padding: 28, position: "relative", animation: "slideUp 0.2s ease" }}>
              <button onClick={() => setShowForm(false)} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white" }}><X size={14} /></button>
              <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700 }}>Catat Transaksi</h3>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {[{val:"income",label:"💰 Pemasukan"},{val:"expense",label:"💸 Pengeluaran"}].map(opt => (
                  <button key={opt.val} onClick={() => setForm({...form, type: opt.val})} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${form.type===opt.val?(opt.val==="income"?"rgba(16,185,129,0.5)":"rgba(239,68,68,0.5)"):"rgba(255,255,255,0.08)"}`, background: form.type===opt.val?(opt.val==="income"?"rgba(16,185,129,0.12)":"rgba(239,68,68,0.12)"):"transparent", color: form.type===opt.val?(opt.val==="income"?"#10b981":"#ef4444"):"rgba(255,255,255,0.4)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{opt.label}</button>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>Jumlah (Rp)</label>
                  <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="150000" style={{ width: "100%", padding: "11px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 15, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>Deskripsi</label>
                  <input type="text" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Jual 10 parfum..." style={{ width: "100%", padding: "11px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>Kategori</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {["Penjualan","HPP","Operasional","Marketing","Lainnya"].map(c => (
                      <button key={c} onClick={() => setForm({...form, category: c})} style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${form.category===c?"rgba(16,185,129,0.5)":"rgba(255,255,255,0.08)"}`, background: form.category===c?"rgba(16,185,129,0.12)":"transparent", color: form.category===c?"#10b981":"rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>{c}</button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={addTransaction} style={{ width: "100%", marginTop: 20, padding: "13px", borderRadius: 12, background: "#10b981", color: "black", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" }}>Simpan Transaksi</button>
            </div>
          </div>
        )}

        {/* Filter */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "8px 12px", flex: 1, minWidth: 180 }}>
            <Search size={14} color="rgba(255,255,255,0.2)" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari transaksi..." style={{ background: "transparent", border: "none", outline: "none", color: "white", fontSize: 13, flex: 1 }} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[{val:"all",label:"Semua"},{val:"income",label:"💰 Masuk"},{val:"expense",label:"💸 Keluar"}].map(f => (
              <button key={f.val} onClick={() => setFilterType(f.val)} style={{ padding: "8px 14px", borderRadius: 9, border: `1px solid ${filterType===f.val?"rgba(16,185,129,0.4)":"rgba(255,255,255,0.07)"}`, background: filterType===f.val?"rgba(16,185,129,0.1)":"transparent", color: filterType===f.val?"#10b981":"rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>{f.label}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>#</th>
                  <th style={th} onClick={() => handleSort("date")}><div style={{ display: "flex", alignItems: "center", gap: 4 }}>Tanggal {sortKey==="date"?(sortDir==="asc"?<ChevronUp size={12} color="#10b981"/>:<ChevronDown size={12} color="#10b981"/>):<ArrowUpDown size={12} color="rgba(255,255,255,0.2)"/>}</div></th>
                  <th style={th} onClick={() => handleSort("type")}><div style={{ display: "flex", alignItems: "center", gap: 4 }}>Tipe {sortKey==="type"?(sortDir==="asc"?<ChevronUp size={12} color="#10b981"/>:<ChevronDown size={12} color="#10b981"/>):<ArrowUpDown size={12} color="rgba(255,255,255,0.2)"/>}</div></th>
                  <th style={th} onClick={() => handleSort("category")}><div style={{ display: "flex", alignItems: "center", gap: 4 }}>Kategori {sortKey==="category"?(sortDir==="asc"?<ChevronUp size={12} color="#10b981"/>:<ChevronDown size={12} color="#10b981"/>):<ArrowUpDown size={12} color="rgba(255,255,255,0.2)"/>}</div></th>
                  <th style={th}>Deskripsi</th>
                  <th style={{ ...th, textAlign: "right" }} onClick={() => handleSort("amount")}><div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>Jumlah {sortKey==="amount"?(sortDir==="asc"?<ChevronUp size={12} color="#10b981"/>:<ChevronDown size={12} color="#10b981"/>):<ArrowUpDown size={12} color="rgba(255,255,255,0.2)"/>}</div></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => (
                  <tr key={t.id} style={{ background: i%2===0?"transparent":"rgba(255,255,255,0.008)" }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background="rgba(16,185,129,0.04)"}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background=i%2===0?"transparent":"rgba(255,255,255,0.008)"}>
                    <td style={{ ...td, color: "rgba(255,255,255,0.2)", fontSize: 11 }}>{i+1}</td>
                    <td style={{ ...td, color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{t.date}</td>
                    <td style={td}><span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, background: t.type==="income"?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)", color: t.type==="income"?"#10b981":"#ef4444", fontSize: 11, fontWeight: 600 }}>{t.type==="income"?"↑ Pemasukan":"↓ Pengeluaran"}</span></td>
                    <td style={td}><span style={{ padding: "2px 8px", borderRadius: 5, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{t.category}</span></td>
                    <td style={{ ...td, color: "rgba(255,255,255,0.8)" }}>{t.description}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, color: t.type==="income"?"#10b981":"#ef4444", fontSize: 14 }}>{t.type==="income"?"+":"-"}{formatRp(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "rgba(16,185,129,0.05)", borderTop: "2px solid rgba(16,185,129,0.15)" }}>
                  <td colSpan={5} style={{ ...td, fontWeight: 700, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>TOTAL PROFIT ({filtered.length} transaksi)</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 800, color: profit>=0?"#10b981":"#ef4444", fontSize: 16 }}>{formatRp(profit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}