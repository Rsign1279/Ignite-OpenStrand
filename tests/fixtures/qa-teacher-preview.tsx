import React from "react";
import { createRoot } from "react-dom/client";
import { AdminDashboard } from "@/components/admin-dashboard";
import { strandIds } from "@/config/strands";
import { dataScopeSchema, matchesScope } from "@/lib/analytics/model";
import type { RegisteredProfile } from "@/lib/analytics/registrations";
const scope = dataScopeSchema.parse(
  new URLSearchParams(location.search).get("scope") ?? "students",
);
const cohort = "44444444-4444-4444-8444-444444444444";
// Synthetic UI-only fixtures: these are not persisted interview-session evidence.
const profiles: RegisteredProfile[] = [
  {
    user_id: "11111111-1111-4111-8111-111111111111",
    name: "Real cohort learner",
    strand: "aviation",
    ignite_year: 2,
    qa_cohort_id: null,
  },
  {
    user_id: "22222222-2222-4222-8222-222222222222",
    name: "[QA] Is just this student's nickname",
    strand: "technology",
    ignite_year: 1,
    qa_cohort_id: null,
  },
  ...Array.from({ length: 24 }, (_, index) => ({
    user_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    name: `Pilot QA ${String(index + 1).padStart(2, "0")}`,
    strand: strandIds[index % 10],
    ignite_year: ((index % 2) + 1) as 1 | 2,
    qa_cohort_id: cohort,
  })),
];
createRoot(document.getElementById("root")!).render(
  <AdminDashboard
    profiles={profiles.filter((profile) => matchesScope(profile, scope))}
    scope={scope}
  />,
);
