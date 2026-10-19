import { requireAdmin } from "@/lib/auth";
import { loadAttempts } from "@/lib/analytics/data";
import { aggregate } from "@/lib/analytics/aggregate";
import { parseFilters } from "@/lib/analytics/model";
import { failure, json } from "@/lib/http";
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const filters = parseFilters(new URL(request.url).searchParams);
    return json(aggregate(await loadAttempts(), filters));
  } catch (e) {
    return failure(e);
  }
}
