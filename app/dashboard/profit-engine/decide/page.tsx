import { guardPage } from "../../lib/page-guard";
import { demoCampaigns } from "@/lib/gercep-profit/demo";
import DecideClient from "./decide-client";

export default function DecidePage() {
  return guardPage("What Should I Do?", async () => {
    return <DecideClient campaigns={demoCampaigns()} />;
  });
}
