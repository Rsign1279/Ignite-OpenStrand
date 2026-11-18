import { requireAdmin } from "@/lib/auth";
import { loadAttempts } from "@/lib/analytics/data";
import { parseFilters } from "@/lib/analytics/model";
import { attemptsCsv } from "@/lib/analytics/csv";
import { failure } from "@/lib/http";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams;
    const student = params.get("id");
    if (student) z.uuid().parse(student);
    const filters = parseFilters(params);
    const filename =
      filters.scope === "qa"
        ? "ignite-qa-scored-attempts.csv"
        : filters.scope === "all"
          ? "ignite-all-scored-attempts.csv"
          : "ignite-student-scored-attempts.csv";
    return new Response(
      "\uFEFF" +
        attemptsCsv(await loadAttempts(student ?? undefined, true), filters),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
