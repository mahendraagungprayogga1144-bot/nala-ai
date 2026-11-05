import type { LucideIcon } from "lucide-react";

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E5E7EB] bg-[#FAFAFA] px-6 py-12 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#6B7280]">
        <Icon size={18} strokeWidth={1.75} />
      </div>
      <h3 className="text-sm font-semibold text-[#111827]">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[#6B7280]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
