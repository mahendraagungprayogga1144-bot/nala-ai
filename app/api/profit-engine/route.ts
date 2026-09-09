import { NextResponse } from "next/server";

/** Gercep OS integration map for Profit Engine. */
export async function GET() {
  return NextResponse.json({
    module: "gercep-profit-engine",
    version: "1.0.0",
    endpoints: {
      "GET /api/profit-engine/products": "List products",
      "POST /api/profit-engine/products": "Create / update product",
      "GET /api/profit-engine/orders": "List orders",
      "POST /api/profit-engine/orders": "Create order",
      "GET /api/profit-engine/campaigns": "List campaigns + engine results",
      "POST /api/profit-engine/campaigns": "Create / update campaign",
      "GET /api/profit-engine/ad-spend": "List ad spend",
      "POST /api/profit-engine/ad-spend": "Record ad spend",
      "GET /api/profit-engine/fee-rules": "List versioned fee rules",
      "POST /api/profit-engine/fee-rules": "Create new fee version (does not overwrite history)",
      "GET /api/profit-engine/affiliate-rules": "List affiliate rules",
      "POST /api/profit-engine/affiliate-rules": "Create affiliate rule",
      "GET /api/profit-engine/profitability": "Portfolio profitability from engine",
      "GET /api/profit-engine/roas": "ROAS / BE ROAS / Target ROAS",
      "GET /api/profit-engine/roi": "Business ROI and Ad ROI",
      "GET /api/profit-engine/recommendations": "SCALE / OPTIMIZE / STOP",
      "POST /api/profit-engine/calculate": "Run Profit Engine on an input payload",
    },
  });
}
