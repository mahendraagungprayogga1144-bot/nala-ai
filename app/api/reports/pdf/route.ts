import { NextResponse } from "next/server";
import { withSalesActor, readJson, queryParam } from "@/lib/henima-sales/http";
import { buildSalesReport, type ReportKind } from "@/lib/henima-sales/report-service";
import { buildSalesReportPdf, reportToCsv } from "@/lib/henima-sales/pdf";
import { todayWib } from "@/lib/date";
import { fmtDateTimeWib } from "@/lib/henima-sales/money";

export const maxDuration = 30;

export async function POST(request: Request) {
  return withSalesActor(async ({ actor, db }) => {
    const body = await readJson(request).catch(() => ({}));
    const kind = (body.kind || queryParam(request, "kind") || "this_month") as ReportKind;
    const format = body.format || "pdf";
    const report = await buildSalesReport(db, actor, {
      kind,
      from: body.from,
      to: body.to,
      salesId: body.salesId,
      rankBy: body.rankBy,
    });
    if (format === "csv") {
      const csv = reportToCsv(report);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="henima-laporan.csv"`,
        },
      });
    }
    const bytes = await buildSalesReportPdf({
      businessName: actor.businessName,
      generatedAt: fmtDateTimeWib(new Date()),
      report,
    });
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="henima-${todayWib()}.pdf"`,
      },
    });
  });
}
