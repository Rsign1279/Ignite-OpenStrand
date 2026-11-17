import "server-only";
import { cache } from "react";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validation";
import { HttpError } from "@/lib/http";
import { matchesScope, type DataScope } from "./model";

export const registeredProfileSchema = profileSchema.extend({
  user_id: z.string().min(1).optional(),
  qa_cohort_id: z
    .uuid()
    .nullish()
    .transform((value) => value ?? null),
});
export type RegisteredProfile = z.infer<typeof registeredProfileSchema>;

/** Includes registrations with no scored attempts, after the teacher check. */
export const registeredProfiles = cache(
  async (scope: DataScope = "students") => {
    await requireAdmin();
    const client = adminClient();
    const profiles: RegisteredProfile[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client
        .from("student_profiles")
        .select("user_id,name,strand,ignite_year,qa_cohort_id")
        .order("user_id")
        .range(offset, offset + 999);
      if (error)
        throw new HttpError(
          503,
          "Unable to load registrations. Please refresh.",
        );
      for (const row of data) {
        const profile = registeredProfileSchema.parse(row);
        if (matchesScope(profile, scope)) profiles.push(profile);
      }
      if (data.length < 1000) return profiles;
    }
  },
);
