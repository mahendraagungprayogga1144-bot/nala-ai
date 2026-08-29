"use client";

import { MODULE_BTN } from "../components/module-form-styles";

export default function NotaDownload({ orderId }: { orderId: string }) {
  return (
    <button
      type="button"
      className={MODULE_BTN + " !px-3 !py-1.5 text-xs"}
      onClick={async () => {
        const res = await fetch(`/api/sales/orders/${orderId}/nota`);
        if (!res.ok) {
          alert("Gagal unduh nota.");
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `nota-${orderId.slice(0, 8)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      NOTA
    </button>
  );
}
