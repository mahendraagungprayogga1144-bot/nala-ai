import { Target } from "lucide-react";
import ModuleHeader from "../../components/module-header";
import { guardPage } from "../../lib/page-guard";
import SalesNav from "../sales-nav";
import { loadSalesContext } from "@/lib/henima-sales/page-context";
import { achievementFor, listTargets } from "@/lib/henima-sales/target-service";
import { listStaff } from "@/lib/henima-sales/staff-service";
import TargetsClient from "./targets-client";

export default function TargetsPage() {
  return guardPage("Targets", async () => {
    const { actor, db } = await loadSalesContext();
    const [targets, staff, daily, weekly, monthly] = await Promise.all([
      listTargets(db, actor),
      listStaff(db, actor),
      achievementFor(db, actor, "daily"),
      achievementFor(db, actor, "weekly"),
      achievementFor(db, actor, "monthly"),
    ]);
    return (
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
        <ModuleHeader icon={Target} title="Targets" subtitle={`${actor.businessName} — target & pencapaian modul ini`} />
        <SalesNav />
        <TargetsClient
          targets={targets}
          staff={staff.map((s) => ({ id: s.id, nama: s.nama }))}
          canEdit={actor.role !== "SALES"}
          daily={daily}
          weekly={weekly}
          monthly={monthly}
        />
      </div>
    );
  });
}
