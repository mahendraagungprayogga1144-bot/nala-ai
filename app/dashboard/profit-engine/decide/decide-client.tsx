"use client";

import { useMemo, useState } from "react";
import { formatRp, formatX } from "@/lib/gercep-profit/format";
import type { DemoCampaign } from "@/lib/gercep-profit/demo";
import StatusBadge from "../components/status-badge";
import BreakdownModal from "../components/breakdown-modal";

export default function DecideClient({ campaigns }: { campaigns: DemoCampaign[] }) {
  const [id, setId] = useState(campaigns[1]?.id || campaigns[0]?.id || "");
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => campaigns.find((c) => c.id === id) || campaigns[0], [campaigns, id]);
  if (!selected) return null;
  const r = selected.result;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <label className="block text-xs text-[#8B8AA0]">
        Campaign
        <select
          className="mt-1 w-full rounded-xl border border-white/10 bg-[#0A0A12] px-3 py-2.5 text-sm text-[#F2F1F8]"
          value={selected.id}
          onChange={(e) => setId(e.target.value)}
        >
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <div className="rounded-2xl border border-white/[0.08] bg-[#101018] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7A7998]">Recommendation</p>
            <h2 className="mt-1 text-lg font-semibold text-[#F4F3FB]">{selected.name}</h2>
          </div>
          <StatusBadge status={r.decision.status} large />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat k="ROAS" v={formatX(r.advertising.roas)} />
          <Stat k="BE ROAS" v={formatX(r.be_roas)} />
          <Stat k="Target ROAS" v={formatX(r.target_roas)} />
          <Stat k="Net Profit" v={formatRp(r.net_profit)} gold />
        </div>

        <div className="mt-5 rounded-xl border border-white/[0.06] bg-[#0A0A12] p-4">
          <p className="text-sm font-medium text-[#F4F3FB]">{r.decision.message}</p>
          <p className="mt-2 text-sm leading-relaxed text-[#B8B7C8]">{r.decision.recommendation}</p>
        </div>

        <button type="button" onClick={() => setOpen(true)} className="mt-4 text-xs text-[#F5D76E] underline">
          View Calculation
        </button>
      </div>
      {open ? <BreakdownModal result={r} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

function Stat({ k, v, gold }: { k: string; v: string; gold?: boolean }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-3">
      <p className="text-[10px] uppercase tracking-wider text-[#6B6A85]">{k}</p>
      <p className={`mt-1 font-mono text-sm font-semibold ${gold ? "text-[#F5D76E]" : "text-[#F4F3FB]"}`}>{v}</p>
    </div>
  );
}
