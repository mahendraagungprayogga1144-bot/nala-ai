import { calculateProfit, applySimulatorKnobs, simulateAdCostCurve } from "@/lib/gercep-profit";
import { henimaAfternoonInput } from "@/lib/gercep-profit/demo";
import { calculateFromBody } from "@/lib/gercep-profit/service";
import { withProfitActor, readJson } from "@/lib/gercep-profit/http";

export async function POST(request: Request) {
  return withProfitActor(async () => {
    const body = await readJson(request);
    if (body.mode === "simulate") {
      const base = henimaAfternoonInput(body.base || {});
      const input = body.knobs ? applySimulatorKnobs(base, body.knobs) : base;
      const result = calculateProfit(input);
      return { result, curve: simulateAdCostCurve(input) };
    }
    const result = await calculateFromBody(body);
    return { result };
  });
}

export async function GET() {
  return withProfitActor(async () => {
    const result = await calculateFromBody({});
    return { result };
  });
}
