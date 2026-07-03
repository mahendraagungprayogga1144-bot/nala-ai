/** Cetak struk via iframe tersembunyi — tanpa pop-up blocker */
export function printReceiptSilently(html: string): boolean {
  try {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "Cetak struk");
    Object.assign(iframe.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "0",
      height: "0",
      border: "0",
      opacity: "0",
      pointerEvents: "none",
    });
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = win?.document;
    if (!doc || !win) {
      iframe.remove();
      return false;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const cleanup = () => setTimeout(() => iframe.remove(), 3000);
    const doPrint = () => {
      try {
        win.focus();
        win.print();
      } finally {
        cleanup();
      }
    };

    setTimeout(doPrint, 350);
    return true;
  } catch {
    return false;
  }
}
