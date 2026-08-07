import { createClient } from "@/lib/supabase/server";
import { guardPage } from "../lib/page-guard";
import TradingAiClient from "./trading-ai-client";

export default async function TradingAiPage() {
  return guardPage("Trading AI Brain", async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return (
        <div className="px-8 py-12 text-center text-sm text-[#8B8AA0]">
          Sesi tidak terbaca. Login ulang.
        </div>
      );
    }

    const displayName =
      user.email?.split("@")[0] || user.id.slice(0, 8);

    return <TradingAiClient userLabel={displayName} />;
  });
}
