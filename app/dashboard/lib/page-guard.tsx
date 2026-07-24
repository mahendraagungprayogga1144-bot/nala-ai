import { unstable_rethrow } from "next/navigation";
import Link from "next/link";

/** Inline error so users still see a real page (not blank error.tsx). */
export function PageCrash({ title, error }: { title: string; error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
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

/** Wrap async page bodies so throws become inline UI (except Next redirects/notFound). */
export async function guardPage(
  title: string,
  render: () => Promise<React.ReactNode>,
): Promise<React.ReactNode> {
  try {
    return await render();
  } catch (err) {
    unstable_rethrow(err);
    console.error(`[${title}]`, err);
    return <PageCrash title={title} error={err} />;
  }
}
