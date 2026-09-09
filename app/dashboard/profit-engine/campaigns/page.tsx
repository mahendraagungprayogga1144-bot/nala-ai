import { guardPage } from "../../lib/page-guard";
import { demoCampaigns } from "@/lib/gercep-profit/demo";
import CampaignsClient from "./campaigns-client";

export default function CampaignsPage() {
  return guardPage("Campaign Profitability", async () => {
    return <CampaignsClient campaigns={demoCampaigns()} />;
  });
}
