import { requireAdmin } from "@/lib/auth";
import { getProviderCapacitySnapshot } from "@/lib/ai/capacity";
import { capacityStatusSchema } from "@/lib/ai/capacity-status";
import { failure, HttpError, json } from "@/lib/http";

export async function GET() {
  try {
    await requireAdmin();
    const snapshot = capacityStatusSchema.safeParse(
      await getProviderCapacitySnapshot(),
    );
    if (!snapshot.success)
      throw new HttpError(
        503,
        "Capacity monitoring is temporarily unavailable.",
      );
    return json(snapshot.data);
  } catch (error) {
    return failure(error);
  }
}
