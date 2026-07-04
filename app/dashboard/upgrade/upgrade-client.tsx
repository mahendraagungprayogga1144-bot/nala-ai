"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Check, Copy, MessageCircle, Clock, Crown, ShieldCheck } from "lucide-react";
import { UPGRADE_PLANS, BANK_ACCOUNTS, fmtRupiah, buildWaMessage, type PlanKey } from "@/lib/payment/config";
import type { CurrentSub, PendingPayment } from "./page";

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—";
}

export default function UpgradeClient({ userId, userEmail, userName, currentSub, pendingPayment, initialPlan }: {
  userId: string;
  userEmail: string;
  userName: string;
  currentSub: CurrentSub;
  pendingPayment: PendingPayment;
  initialPlan?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const validInitial = initialPlan && initialPlan in UPGRADE_PLANS ? initialPlan as PlanKey : "pro";
  const [selected, setSelected] = useState<PlanKey>(validInitial);
  const [step, setStep] = useState<"pilih" | "bayar">("pilih");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState("");
  const [invoice, setInvoice] = useState("");

  const plan = UPGRADE_PLANS[selected];
  const currentPlan = currentSub?.plan || "free";
  const isActive = currentSub?.status === "active" && currentPlan !== "free";

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1500);
  };

  const startPayment = () => {
    const inv = "GRC-" + Date.now().toString(36).toUpperCase();
    setInvoice(inv);
    setStep("bayar");
  };

  const confirmTransfer = async () => {
    setLoading(true);
    await supabase.from("payments").insert({
      user_id: userId,
      plan: selected,
      amount: plan.price,
      method: "transfer_manual",
      status: "pending",
      invoice_id: invoice,
    });
    setLoading(false);
    window.open(buildWaMessage({ name: userName, email: userEmail, plan: selected, amount: plan.price, invoice }), "_blank");
    router.refresh();
  };

  /* ── Sudah ada konfirmasi pending: tampilkan status menunggu ── */
  if (pendingPayment) {
    return (
      <div className="px-4 py-8 sm:px-8 max-w-[560px] mx-auto">
        <div className="rounded-2xl border border-[#F59E0B]/25 bg-[#F59E0B]/[0.05] p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/30">
            <Clock size={24} className="text-[#F59E0B]" />
          </div>
          <h1 className="text-lg font-bold mb-2">Menunggu Konfirmasi Admin</h1>
          <p className="text-xs text-[#8B8AA0] leading-relaxed mb-4">
            Pembayaran paket <span className="font-bold text-[#F59E0B]">{pendingPayment.plan.toUpperCase()}</span> ({fmtRupiah(Number(pendingPayment.amount))}) sedang diverifikasi.
            Biasanya di-ACC dalam beberapa jam di jam kerja.
          </p>
          <p className="text-[10px] font-mono text-[#5A5B7A] mb-6">Invoice: {pendingPayment.invoice_id} · {fmtDate(pendingPayment.created_at)}</p>
          <a href={buildWaMessage({ name: userName, email: userEmail, plan: pendingPayment.plan, amount: Number(pendingPayment.amount), invoice: pendingPayment.invoice_id || "-" })}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[#4ADE80]/10 border border-[#4ADE80]/30 px-5 py-2.5 text-xs font-bold text-[#4ADE80] hover:bg-[#4ADE80]/20 transition-all">
            <MessageCircle size={14} /> Kirim Bukti Transfer via WA
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 sm:px-8 max-w-[860px] mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-bold sm:text-2xl mb-1">Upgrade Paket</h1>
        <p className="text-xs text-[#5A5B7A]">
          Paket kamu sekarang: <span className="font-bold" style={{ color: isActive ? "#2DD4BF" : "#8B8AA0" }}>{currentPlan.toUpperCase()}</span>
          {isActive && currentSub?.expired_at && <> · aktif sampai {fmtDate(currentSub.expired_at)}</>}
        </p>
      </div>

      {step === "pilih" && (
        <>
          {/* Plan cards */}
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            {(Object.entries(UPGRADE_PLANS) as [PlanKey, typeof UPGRADE_PLANS[PlanKey]][]).map(([key, p]) => (
              <button key={key} type="button" onClick={() => setSelected(key)}
                className="relative rounded-2xl p-5 text-left transition-all"
                style={{
                  background: selected === key ? `linear-gradient(180deg, ${p.color}12, rgba(10,10,18,0.9))` : "rgba(10,10,18,0.9)",
                  border: `1px solid ${selected === key ? p.color + "60" : "rgba(255,255,255,0.07)"}`,
                  boxShadow: selected === key ? `0 0 30px ${p.color}20` : "none",
                }}>
                {p.popular && (
                  <span className="absolute -top-2.5 right-4 rounded-full px-2.5 py-0.5 text-[8px] font-bold"
                    style={{ background: "linear-gradient(90deg, #EC4899, #8B5CF6)", color: "#fff" }}>Populer</span>
                )}
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold" style={{ color: p.color }}>{p.name}</p>
                  {selected === key && <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: p.color }}><Check size={12} color="#050508" /></span>}
                </div>
                <p className="mb-3">
                  <span className="text-xl font-black font-mono" style={{ color: p.color }}>{fmtRupiah(p.price)}</span>
                  <span className="text-[10px] text-[#5A5B7A]">/bulan</span>
                </p>
                <div className="space-y-1.5">
                  {p.features.map(f => (
                    <p key={f} className="flex items-center gap-1.5 text-[10px] text-[#8B8AA0]">
                      <Check size={10} style={{ color: p.color }} />{f}
                    </p>
                  ))}
                </div>
              </button>
            ))}
          </div>

          <button type="button" onClick={startPayment}
            className="w-full sm:w-auto rounded-xl px-8 py-3.5 text-sm font-bold transition-all"
            style={{ background: `linear-gradient(135deg, ${plan.color}, #8B5CF6)`, color: "#050508", boxShadow: `0 0 30px ${plan.color}30` }}>
            Lanjut Bayar — {plan.name} {fmtRupiah(plan.price)}/bulan
          </button>
        </>
      )}

      {step === "bayar" && (
        <div className="max-w-[560px]">
          {/* Ringkasan */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#0A0A12] p-5 mb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-[#5A5B7A]">Paket dipilih</p>
              <button type="button" onClick={() => setStep("pilih")} className="text-[10px] text-[#2DD4BF] hover:underline">Ganti paket</button>
            </div>
            <div className="flex items-center gap-2">
              <Crown size={16} style={{ color: plan.color }} />
              <p className="text-sm font-bold" style={{ color: plan.color }}>{plan.name}</p>
              <p className="ml-auto text-lg font-black font-mono" style={{ color: plan.color }}>{fmtRupiah(plan.price)}</p>
            </div>
            <p className="mt-2 text-[10px] font-mono text-[#5A5B7A]">Invoice: {invoice}</p>
          </div>

          {/* Rekening tujuan */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#0A0A12] p-5 mb-4">
            <p className="text-xs font-bold mb-3 flex items-center gap-1.5"><ShieldCheck size={13} className="text-[#2DD4BF]" /> Transfer ke salah satu rekening:</p>
            <div className="space-y-2.5">
              {BANK_ACCOUNTS.map(acc => (
                <div key={acc.bank} className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-[#5A5B7A]">{acc.bank} · a.n. {acc.holder}</p>
                    <p className="text-sm font-bold font-mono text-[#F0EFF8]">{acc.number}</p>
                  </div>
                  <button type="button" onClick={() => copy(acc.number, acc.bank)}
                    className="flex items-center gap-1 rounded-lg border border-[#2DD4BF]/25 bg-[#2DD4BF]/[0.06] px-2.5 py-1.5 text-[10px] font-medium text-[#2DD4BF]">
                    {copied === acc.bank ? <><Check size={11} /> Tersalin</> : <><Copy size={11} /> Salin</>}
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-[#5A5B7A] leading-relaxed">
              Transfer tepat sebesar <span className="font-bold text-[#F0EFF8]">{fmtRupiah(plan.price)}</span>, lalu klik tombol di bawah untuk kirim bukti transfer via WhatsApp.
            </p>
          </div>

          {/* Konfirmasi */}
          <button type="button" onClick={confirmTransfer} disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-4 text-sm font-bold transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #4ADE80, #2DD4BF)", color: "#050508", boxShadow: "0 0 30px rgba(74,222,128,0.25)" }}>
            <MessageCircle size={16} />
            {loading ? "Menyimpan..." : "Saya Sudah Transfer — Konfirmasi via WA"}
          </button>
          <p className="mt-3 text-center text-[10px] text-[#5A5B7A]">
            Setelah admin verifikasi, paket kamu langsung aktif otomatis. Biasanya kurang dari 1 jam di jam kerja.
          </p>
        </div>
      )}
    </div>
  );
}
