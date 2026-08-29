"use client";
import { useState } from "react";

export default function ConfirmDelete({
  label,
  onConfirm,
}: {
  label: string;
  onConfirm: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-[#EC4899] hover:underline">
        {label}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span className="text-[#8B8AA0]">Yakin ingin menghapus transaksi?</span>
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          await onConfirm();
          setLoading(false);
          setOpen(false);
        }}
        className="rounded-lg bg-[#EC4899]/20 px-2 py-1 font-semibold text-[#EC4899]"
      >
        YES DELETE
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-[#8B8AA0]">
        CANCEL
      </button>
    </span>
  );
}
