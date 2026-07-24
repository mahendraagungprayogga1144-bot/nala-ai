import Link from "next/link";
import type { ReactNode } from "react";

const LEGAL_NAV = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/kebijakan-data", label: "Kebijakan Data" },
];

export default function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-[100dvh]" style={{ background: "#050508", color: "#F2F1F8" }}>
      <header
        className="sticky top-0 z-40 border-b border-white/[0.06]"
        style={{ background: "rgba(5,5,8,0.85)", backdropFilter: "blur(16px)", paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-gercep.png" alt="" className="h-7 w-7 rounded-lg object-cover" />
            Gercep AI
          </Link>
          <Link href="/" className="text-xs text-[#8B8AA0] hover:text-[#2DD4BF]">
            Beranda
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-5 py-10 pb-20">
        <p className="mb-2 text-[10px] font-bold tracking-[0.15em] text-[#2DD4BF] uppercase">Legal</p>
        <h1 className="mb-2 text-3xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {title}
        </h1>
        <p className="mb-8 text-xs text-[#5A5B7A]">Terakhir diperbarui: {updated}</p>

        <nav className="mb-10 flex flex-wrap gap-2">
          {LEGAL_NAV.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-[#8B8AA0] hover:border-[#2DD4BF]/40 hover:text-[#2DD4BF]"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="legal-prose space-y-6 text-sm leading-relaxed text-[#C4C3D4]">{children}</div>

        <div className="mt-12 rounded-2xl border border-white/[0.08] p-5 text-xs text-[#8B8AA0]" style={{ background: "#0D0D1A" }}>
          <p className="mb-1 font-semibold text-[#F0EFF8]">PT Henima Collection Indonesia</p>
          <p>Produk: Gercep AI · Domain: gercepos.id</p>
          <p className="mt-2">
            Pertanyaan legal:{" "}
            <a href="mailto:mahendraagungprayogga1144@gmail.com" className="text-[#2DD4BF] hover:underline">
              mahendraagungprayogga1144@gmail.com
            </a>
          </p>
        </div>
      </article>
    </main>
  );
}

export function H({ children }: { children: ReactNode }) {
  return <h2 className="pt-2 text-base font-semibold text-[#F0EFF8]">{children}</h2>;
}

export function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

export function Ul({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-[#A8A7B8]">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
