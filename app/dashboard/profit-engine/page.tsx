import { guardPage } from "../lib/page-guard";
import { buildDemoDashboard } from "@/lib/gercep-profit/demo";
import ProfitDashboardClient from "./dashboard-client";

export default function ProfitEnginePage() {
  return guardPage("Profit Engine", async () => {
    const data = buildDemoDashboard();
    return <ProfitDashboardClient data={data} />;
  });
}
