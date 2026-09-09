import { asNumber, roundMoney } from "../money";
import type { CostResult, ProductCostInput, ProfitCalcInput } from "../types";

export function cogsPerUnit(costs: ProductCostInput): number {
  return roundMoney(
    asNumber(costs.material_cost) +
      asNumber(costs.bottle_cost) +
      asNumber(costs.packaging_cost) +
      asNumber(costs.box_cost) +
      asNumber(costs.label_cost) +
      asNumber(costs.labor_cost) +
      asNumber(costs.other_cost),
  );
}

export function computeCost(input: ProfitCalcInput): CostResult {
  const per = cogsPerUnit(input.costs);
  const qty = asNumber(input.quantity);
  return {
    cogs_per_unit: per,
    cogs: roundMoney(per * qty),
    breakdown: {
      material_cost: asNumber(input.costs.material_cost),
      bottle_cost: asNumber(input.costs.bottle_cost),
      packaging_cost: asNumber(input.costs.packaging_cost),
      box_cost: asNumber(input.costs.box_cost),
      label_cost: asNumber(input.costs.label_cost),
      labor_cost: asNumber(input.costs.labor_cost),
      other_cost: asNumber(input.costs.other_cost),
    },
  };
}

export function computeVariableCost(input: ProfitCalcInput) {
  const qty = asNumber(input.quantity);
  const unit =
    asNumber(input.variable.processing_fee) +
    asNumber(input.variable.shipping_cost) +
    asNumber(input.variable.insurance) +
    asNumber(input.variable.additional_packaging);
  const other = asNumber(input.variable.other_variable_cost);
  return {
    order_variable_cost: roundMoney(unit * qty),
    other_variable_cost: roundMoney(other * qty),
  };
}
