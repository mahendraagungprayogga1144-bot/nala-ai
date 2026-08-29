import { Users } from "lucide-react";
import Link from "next/link";
import ModuleHeader from "../../../components/module-header";
import { MODULE_CARD } from "../../../components/module-form-styles";
import { guardPage } from "../../../lib/page-guard";
import SalesNav from "../../sales-nav";
import { loadSalesContext } from "@/lib/henima-sales/page-context";
import { getCustomer } from "@/lib/henima-sales/customer-service";
import { listOrders } from "@/lib/henima-sales/order-service";
import { listFollowUps } from "@/lib/henima-sales/followup-service";
import { listTestimonials, signedTestimonialUrl } from "@/lib/henima-sales/testimonial-service";
import { listStaff } from "@/lib/henima-sales/staff-service";
import { displayPhone } from "@/lib/henima-sales/phone";
import { fmtDateLongId, fmtRp } from "@/lib/henima-sales/money";
import FollowUpActions from "../../follow-ups/followup-actions";

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return guardPage("Customer", async () => {
    const { id } = await params;
    const { actor, db } = await loadSalesContext();
    const customer = await getCustomer(db, actor, id);
    const [orders, follows, testimonials, staff] = await Promise.all([
      listOrders(db, actor, { customerId: id, pageSize: 50 }),
      listFollowUps(db, actor, { pageSize: 30 }),
      listTestimonials(db, actor, { customerId: id }),
      listStaff(db, actor),
    ]);
    const salesName = staff.find((s) => s.id === customer.assigned_sales_id)?.nama || "—";
    const photos = await Promise.all(
      testimonials.rows.map(async (t: { id: string; storage_path: string; caption: string | null }) => ({
        ...t,
        url: await signedTestimonialUrl(db, t.storage_path),
      })),
    );
    const myFollows = follows.rows.filter((f) => f.customer_id === id);

    return (
      <div className="mx-auto max-w-3xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
        <ModuleHeader icon={Users} title="CUSTOMER" subtitle={customer.nama} />
        <SalesNav />
        <div className={MODULE_CARD + " mb-6 whitespace-pre-wrap font-mono text-sm leading-relaxed"}>
{`Nama:
${customer.nama}

WhatsApp:
${displayPhone(customer.whatsapp_phone || customer.telepon)}

Sales:
${salesName}

Status:
${customer.status}

First Purchase:
${fmtDateLongId(customer.first_purchase_at)}

Last Purchase:
${fmtDateLongId(customer.last_purchase_at)}

Total Orders:
${customer.total_orders || 0}

Total Items:
${customer.total_items || 0}

Total Spending:
${fmtRp(customer.total_spent)}`}
        </div>

        <h2 className="mb-2 text-sm font-semibold">PURCHASE HISTORY</h2>
        <div className="mb-6 space-y-2">
          {orders.rows.map((o) => {
            const items = (o.order_items || [])
              .map((i) => `${i.product_name_snapshot || "Produk"} × ${i.qty}`)
              .join(" + ") || "—";
            return (
              <div key={o.id} className={MODULE_CARD + " text-sm"}>
                {fmtDateLongId(o.order_date)} · {items} · {fmtRp(o.total)}
              </div>
            );
          })}
        </div>

        <h2 className="mb-2 text-sm font-semibold">FOLLOW UP</h2>
        <div className="mb-6 space-y-2">
          {myFollows.length === 0 && <p className="text-sm text-[#8B8AA0]">Belum ada follow-up.</p>}
          {myFollows.map((f) => (
            <div key={f.id} className={MODULE_CARD}>
              <p className="text-sm">Next: {fmtDateLongId(f.scheduled_at)} · {f.status}</p>
              {f.notes && <p className="text-xs text-[#8B8AA0]">{f.notes}</p>}
              <FollowUpActions id={f.id} />
            </div>
          ))}
        </div>

        <h2 className="mb-2 text-sm font-semibold">TESTIMONIALS</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p) =>
            p.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.url} alt={p.caption || "testimoni"} className="h-40 w-full rounded-xl object-cover" />
            ) : null,
          )}
        </div>
        <Link href="/dashboard/sales/customers" className="mt-6 inline-block text-sm text-[#2DD4BF]">← Daftar customer</Link>
      </div>
    );
  });
}
