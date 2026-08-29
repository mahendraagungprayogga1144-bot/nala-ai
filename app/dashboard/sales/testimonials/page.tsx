import { Camera } from "lucide-react";
import ModuleHeader from "../../components/module-header";
import { guardPage } from "../../lib/page-guard";
import SalesNav from "../sales-nav";
import { loadSalesContext } from "@/lib/henima-sales/page-context";
import { listTestimonials, signedTestimonialUrl } from "@/lib/henima-sales/testimonial-service";
import { fmtDateTimeWib } from "@/lib/henima-sales/money";

export default function TestimonialsPage() {
  return guardPage("Testimonials", async () => {
    const { actor, db } = await loadSalesContext();
    const { rows } = await listTestimonials(db, actor, { pageSize: 48 });
    const photos = await Promise.all(
      rows.map(async (t: { id: string; storage_path: string; caption: string | null; created_at: string; order_id: string | null }) => ({
        ...t,
        url: await signedTestimonialUrl(db, t.storage_path),
      })),
    );
    return (
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
        <ModuleHeader icon={Camera} title="Testimonials" subtitle="Foto testimoni customer" />
        <SalesNav />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <figure key={p.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D0D1A]">
              {p.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt={p.caption || "testimoni"} className="h-44 w-full object-cover" />
              ) : (
                <div className="flex h-44 items-center justify-center text-xs text-[#5A5B7A]">Tidak dapat dimuat</div>
              )}
              <figcaption className="p-2 text-[10px] text-[#8B8AA0]">
                {fmtDateTimeWib(p.created_at)}
                {p.caption ? ` · ${p.caption}` : ""}
              </figcaption>
            </figure>
          ))}
        </div>
        {photos.length === 0 && <p className="text-sm text-[#8B8AA0]">Belum ada testimoni.</p>}
      </div>
    );
  });
}
