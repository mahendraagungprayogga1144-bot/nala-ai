import { Smartphone } from "lucide-react";
import ModuleHeader from "../../components/module-header";
import { guardPage } from "../../lib/page-guard";
import SalesNav from "../sales-nav";
import { loadSalesContext } from "@/lib/henima-sales/page-context";
import { listStaff, listProducts } from "@/lib/henima-sales/staff-service";
import TeamClient from "./team-client";

export default function TeamPage() {
  return guardPage("Sales Settings", async () => {
    const { actor, db } = await loadSalesContext();
    const [staff, products] = await Promise.all([listStaff(db, actor), listProducts(db, actor.businessId)]);
    return (
      <div className="mx-auto max-w-3xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
        <ModuleHeader icon={Smartphone} title="Settings" subtitle={`${actor.businessName} — atur sendiri identitas, produk, tim, Telegram`} />
        <SalesNav />
        <TeamClient
          actor={{
            role: actor.role,
            nama: actor.nama,
            businessName: actor.businessName,
            tagline: actor.tagline,
            staffId: actor.staffId,
          }}
          botUsername={process.env.TELEGRAM_BOT_USERNAME || "henimaofficial_bot"}
          staff={staff}
          products={products.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            stock: p.stock,
            unit: p.unit,
          }))}
        />
      </div>
    );
  });
}
