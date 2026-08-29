"use client";
import { useRouter } from "next/navigation";

export default function FollowUpActions({ id }: { id: string }) {
  const router = useRouter();
  const set = async (status: string) => {
    await fetch("/api/sales/follow-ups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    router.refresh();
  };
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {["CONTACTED", "INTERESTED", "NO_RESPONSE", "REPEAT_ORDER"].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => set(s)}
          className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-[#8B8AA0] hover:border-[#2DD4BF]/40 hover:text-[#2DD4BF]"
        >
          {s.replace("_", " ")}
        </button>
      ))}
    </div>
  );
}
