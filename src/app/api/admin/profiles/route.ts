import { requireAdmin } from "@/lib/auth";
import { failure, json } from "@/lib/http";
import { dataScopeSchema } from "@/lib/analytics/model";
import { registeredProfiles } from "@/lib/analytics/registrations";
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const scope = dataScopeSchema.parse(
      new URL(request.url).searchParams.get("scope") ?? "students",
    );
    const profiles = await registeredProfiles(scope);
    // Preserve the compact ordinary-registration API while explicit QA/all
    // requests include the teacher's session link and trusted cohort marker.
    return json(
      scope === "students"
        ? profiles.map(({ name, strand, ignite_year }) => ({
            name,
            strand,
            ignite_year,
          }))
        : profiles,
    );
  } catch (e) {
    return failure(e);
  }
}
