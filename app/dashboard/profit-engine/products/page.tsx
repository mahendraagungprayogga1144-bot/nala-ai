import { guardPage } from "../../lib/page-guard";
import { demoCampaigns } from "@/lib/gercep-profit/demo";
import ProductsClient from "./products-client";

export default function ProductsPage() {
  return guardPage("Product Profitability", async () => {
    const rows = demoCampaigns().map((c) => c.result);
    return <ProductsClient rows={rows} />;
  });
}
