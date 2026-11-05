export default function SectionCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-[#F3F4F6] px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[#111827]">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-[#6B7280]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}
