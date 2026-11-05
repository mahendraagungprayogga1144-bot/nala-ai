import { Info } from "lucide-react";

export default function PhaseBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3">
      <Info size={16} className="mt-0.5 shrink-0 text-[#6B7280]" strokeWidth={1.75} />
      <p className="text-sm leading-relaxed text-[#4B5563]">{message}</p>
    </div>
  );
}
