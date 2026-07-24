"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Check, Copy, MessageCircle, Clock, Crown, ShieldCheck } from "lucide-react";
import {
  UPGRADE_PLANS,
  BANK_ACCOUNTS,
  fmtRupiah,
  buildWaMessage,
  buildInvoiceShareWaMessage,
  PAYMENT_WA,
  isPlaceholderPaymentConfig,
  isPlaceholderWa,
  type PlanKey,
} from "@/lib/payment/config";
import { plansWithPrices } from "@/lib/payment/plans";
import { publicInvoiceUrl } from "@/lib/auth/app-url";
import { trackClientEvent } from "@/lib/admin/track-event";
import type { CurrentSub, PendingPayment, PaidPayment } from "./page";

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—";
}

export default function UpgradeClient({ userId, userEmail, userName, currentSub, pendingPayment, lastPaidPayment, initialPlan }: {
  userId: string;
  userEmail: string;
  userName: string;
  currentSub: CurrentSub;
  pendingPayment: PendingPayment;
  lastPaidPayment?: PaidPayment;
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
  const [paymentWa, setPaymentWa] = useState(PAYMENT_WA);
  const [bankAccounts, setBankAccounts] = useState(BANK_ACCOUNTS);
  const [qrisImageUrl, setQrisImageUrl] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [plans, setPlans] = useState(() => plansWithPrices());
  const [billingReady, setBillingReady] = useState(false);

  useEffect(() => {
    trackClientEvent({ event: "upgrade_view", module: "billing", path: "/dashboard/upgrade" });
    fetch("/api/public/platform")
      .then((r) => r.json())
      .then((d) => {
        let wa = paymentWa;
        let banks = bankAccounts;
        if (d.payment_wa) {
          wa = String(d.payment_wa);
          setPaymentWa(wa);
        }
        if (Array.isArray(d.bank_accounts) && d.bank_accounts.length > 0) {
          banks = d.bank_accounts.map((a: { bank?: string; number?: string; holder?: string }) => ({
            bank: String(a.bank || ""),
            number: String(a.number || ""),
            holder: String(a.holder || ""),
          }));
          setBankAccounts(banks);
        }
        if (typeof d.qris_image_url === "string" && d.qris_image_url.trim()) {
          setQrisImageUrl(d.qris_image_url.trim());
        }
        if (typeof d.app_url === "string" && d.app_url.trim()) {
          setAppUrl(d.app_url.trim());
        }
        if (d.plan_prices) setPlans(plansWithPrices(d.plan_prices));
        setBillingReady(!isPlaceholderPaymentConfig(wa, banks) || !!String(d.qris_image_url || "").trim());
      })
      .catch(() => {
        setBillingReady(!isPlaceholderPaymentConfig(paymentWa, bankAccounts));
      });
  }, []);

  const plan = plans[selected];
  const currentPlan = currentSub?.plan || "free";
  const isActive = currentSub?.status === "active" && currentPlan !== "free";
  const paymentBlocked = isPlaceholderPaymentConfig(paymentWa, bankAccounts) && !qrisImageUrl;

  const shareOrigin =
    appUrl || (typeof window !== "undefined" ? window.location.origin : undefined);

  const waLink = (opts: {
    plan: string;
    amount: number;
    invoice: string;
    paymentId?: string;
  }) =>
    buildWaMessage({
      name: userName,
      email: userEmail,
      plan: opts.plan,
      amount: opts.amount,
      invoice: opts.invoice,
      invoiceUrl: opts.paymentId
        ? publicInvoiceUrl(opts.paymentId, shareOrigin)
        : undefined,
      wa: paymentWa,
    });

  const invoiceShareLink = (opts: {
    plan: string;
    amount: number;
    invoice: string;
    paymentId: string;
    status: string;
  }) => {
    return buildInvoiceShareWaMessage({
      name: userName,
      email: userEmail,
      plan: opts.plan,
      amount: opts.amount,
      invoice: opts.invoice,
      status: opts.status,
      // Public /invoice/{uuid} — no login redirect (WA rejects auth-gated /api/invoice links)
      invoiceUrl: publicInvoiceUrl(opts.paymentId, shareOrigin),
      wa: paymentWa,
    });
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1500);
  };

  const startPayment = () => {
    if (paymentBlocked) {
      alert("Pembayaran belum dikonfigurasi admin (WA/rekening masih placeholder). Hubungi support.");
      return;
    }
    const inv = "GRC-" + Date.now().toString(36).toUpperCase();
    setInvoice(inv);
    setStep("bayar");
  };

  const confirmTransfer = async () => {
    if (paymentBlocked) {
      alert("Pembayaran belum dikonfigurasi. Hubungi admin.");
      return;
    }
    setLoading(true);
    // Open blank tab in the same user gesture — window.open after await is popup-blocked,
    // which made "kirim ke WA" fail even though payment was already saved.
    const waWin = typeof window !== "undefined" ? window.open("about:blank", "_blank") : null;

    const { data: created, error } = await supabase
      .from("payments")
      .insert({
        user_id: userId,
        plan: selected,
        amount: plan.price,
        method: "transfer_manual",
        status: "pending",
        invoice_id: invoice,
      })
      .select("id")
      .single();
    if (error || !created?.id) {
      setLoading(false);
      try {
        waWin?.close();
      } catch {
        /* ignore */
      }
      alert("Gagal buat invoice: " + (error?.message || "tidak ada id pembayaran"));
      return;
    }
    trackClientEvent({
      event: "payment_submit",
      module: "billing",
      meta: { plan: selected, amount: plan.price, invoice, paymentId: created.id },
    });
    setLoading(false);
    const waUrl = waLink({
      plan: selected,
      amount: plan.price,
      invoice,
      paymentId: created.id,
    });
    if (waWin) {
      waWin.location.href = waUrl;
    } else if (isPlaceholderWa(paymentWa)) {
      alert(
        "Popup diblokir browser, dan nomor WA admin belum di-set. Minta admin isi WA di Admin → Settings, lalu klik 'Kirim Bukti Transfer via WA' di halaman berikutnya.",
      );
    } else {
      alert("Popup diblokir browser. Klik 'Kirim Bukti Transfer via WA' di halaman berikutnya.");
    }
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
          <div className="flex flex-col items-center gap-2">
            <a href={waLink({
              plan: pendingPayment.plan,
              amount: Number(pendingPayment.amount),
              invoice: pendingPayment.invoice_id || "-",
              paymentId: pendingPayment.id,
            })}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#4ADE80]/10 border border-[#4ADE80]/30 px-5 py-2.5 text-xs font-bold text-[#4ADE80] hover:bg-[#4ADE80]/20 transition-all">
              <MessageCircle size={14} /> Kirim Bukti Transfer via WA
            </a>
            <a
              href={invoiceShareLink({
                plan: pendingPayment.plan,
                amount: Number(pendingPayment.amount),
                invoice: pendingPayment.invoice_id || "-",
                paymentId: pendingPayment.id,
                status: "pending",
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-medium text-[#4ADE80] hover:underline"
            >
              <MessageCircle size={12} /> Kirim link invoice ke WA
            </a>
            <a
              href={`/invoice/${pendingPayment.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#38BDF8] hover:underline"
            >
              Lihat / unduh invoice
            </a>
            {isPlaceholderWa(paymentWa) && (
              <p className="mt-2 max-w-xs text-[10px] leading-relaxed text-[#F59E0B]">
                Nomor WA admin belum dikonfigurasi — WhatsApp akan membuka pemilih kontak. Minta admin isi di Admin → Settings.
              </p>
            )}
          </div>
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
        {lastPaidPayment && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <a
              href={`/invoice/${lastPaidPayment.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-xs font-medium text-[#38BDF8] hover:underline"
            >
              Unduh invoice terakhir ({lastPaidPayment.invoice_id || lastPaidPayment.id.slice(0, 8)})
            </a>
            <a
              href={invoiceShareLink({
                plan: lastPaidPayment.plan,
                amount: Number(lastPaidPayment.amount),
                invoice: lastPaidPayment.invoice_id || lastPaidPayment.id.slice(0, 8),
                paymentId: lastPaidPayment.id,
                status: "paid",
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#4ADE80] hover:underline"
            >
              <MessageCircle size={12} /> Kirim invoice ke WA
            </a>
          </div>
        )}
      </div>

      {step === "pilih" && (
        <>
          {paymentBlocked && (
            <div className="mb-6 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-4 py-3 text-xs text-[#F59E0B]">
              Transfer manual belum siap: nomor WA/rekening admin masih placeholder.
              Hubungi support atau minta admin isi di Admin → Settings sebelum upgrade.
              {!billingReady ? "" : ""}
            </div>
          )}
          {/* Plan cards */}
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            {(Object.entries(plans) as [PlanKey, typeof plans[PlanKey]][]).map(([key, p]) => (
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

          {/* QRIS + rekening */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#0A0A12] p-5 mb-4">
            {qrisImageUrl ? (
              <div className="mb-5">
                <p className="text-xs font-bold mb-3 flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-[#2DD4BF]" /> Scan QRIS
                </p>
                <div className="mx-auto flex max-w-[240px] flex-col items-center">
                  <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-white p-3 shadow-[0_0_0_1px_rgba(45,212,191,0.12)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrisImageUrl}
                      alt="QRIS Gercep AI"
                      className="aspect-square w-full object-contain"
                    />
                  </div>
                  <p className="mt-3 text-center text-[11px] leading-relaxed text-[#8B8AA0]">
                    Scan dengan aplikasi bank / e-wallet. Bayar tepat{" "}
                    <span className="font-bold text-[#F0EFF8]">{fmtRupiah(plan.price)}</span>
                  </p>
                </div>
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/[0.06]" />
                  <span className="text-[10px] uppercase tracking-wider text-[#5A5B7A]">atau transfer</span>
                  <div className="h-px flex-1 bg-white/[0.06]" />
                </div>
              </div>
            ) : null}

            <p className="text-xs font-bold mb-3 flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-[#2DD4BF]" />
              {qrisImageUrl ? "Transfer ke rekening:" : "Transfer ke salah satu rekening:"}
            </p>
            <div className="space-y-2.5">
              {bankAccounts.map(acc => (
                <div key={`${acc.bank}-${acc.number}-${acc.holder}`} className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-[#5A5B7A]">{acc.bank}{acc.holder ? ` · a.n. ${acc.holder}` : ""}</p>
                    {acc.number ? (
                      <p className="text-sm font-bold font-mono text-[#F0EFF8]">{acc.number}</p>
                    ) : (
                      <p className="text-[11px] text-[#5A5B7A]">Scan QRIS di atas</p>
                    )}
                  </div>
                  {acc.number ? (
                    <button type="button" onClick={() => copy(acc.number, acc.bank)}
                      className="flex items-center gap-1 rounded-lg border border-[#2DD4BF]/25 bg-[#2DD4BF]/[0.06] px-2.5 py-1.5 text-[10px] font-medium text-[#2DD4BF]">
                      {copied === acc.bank ? <><Check size={11} /> Tersalin</> : <><Copy size={11} /> Salin</>}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-[#5A5B7A] leading-relaxed">
              Bayar tepat <span className="font-bold text-[#F0EFF8]">{fmtRupiah(plan.price)}</span>, lalu klik tombol di bawah untuk kirim bukti via WhatsApp.
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
