import Link from "next/link";

/** Inline error so users still see a real page (not blank error.tsx). */
export function PageCrash({ title, error }: { title: string; error: unknown }) {
  const message = error instanceof Error ? errMsg(error) : String(error);
  return (
    <div className="px-4 py-10 text-center sm:px-8">
      <h1 className="mb-2 text-lg font-semibold text-[#F0EFF8]">{title}</h1>
      <p className="mb-3 text-sm text-[#8B8AA0]">
        Halaman ini gagal di server. Detail di bawah — coba ganti bisnis aktif atau muat ulang.
      </p>
      <p className="mx-auto mb-6 max-w-xl break-words font-mono text-[11px] text-[#EC4899]">{message}</p>
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
        <Link href="/dashboard/owner" className="text-[#2DD4BF] underline">
          Dashboard Owner
        </Link>
        <Link href="/dashboard/inventory" className="text-[#8B8AA0] underline">
          Inventory
        </Link>
      </div>
    </div>
  );
}

function errMsg(error: Error) {
  const digest =
    "digest" in error && (error as Error & { digest?: string }).digest
      ? ` [digest ${(error as Error & { digest?: string }).digest}]`
      : "";
  return `${error.message || "Unknown error"}${digest}`;
}

/** Next.js navigation control-flow only — never rethrow cookie/RSC digests to error.tsx. */
function isNextNavigationError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const digest = "digest" in err ? String((err as { digest?: unknown }).digest ?? "") : "";
  if (digest.startsWith("NEXT_")) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK/.test(msg);
}

/** Wrap async page bodies so throws become inline UI (except Next redirects/notFound). */
export async function guardPage(
  title: string,
  render: () => Promise<React.ReactNode>,
): Promise<React.ReactNode> {
  try {
    return await render();
  } catch (err) {
    // Do NOT use unstable_rethrow here — it can bubble cookie/dynamic digests
    // (e.g. ERROR 1621801304) into dashboard/error.tsx and blank the page.
    if (isNextNavigationError(err)) throw err;
    console.error(`[${title}]`, err);
    return <PageCrash title={title} error={err} />;
  }
}
