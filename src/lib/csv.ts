import { getStrand } from "@/config/strands";
import type { Profile } from "@/lib/validation";
export function profilesCsv(
  profiles: (Profile & { qa_cohort_id?: string | null })[],
  includeQaMetadata = profiles.some((p) => !!p.qa_cohort_id),
) {
  const escape = (value: string) =>
    `"${value.replace(/^\s*[=+@\-\t\r]/, "'$&").replaceAll('"', '""')}"`;
  return [
    "name,strand,IGNITE year" +
      (includeQaMetadata ? ",session_kind,qa_cohort_id" : ""),
    ...profiles.map((p) =>
      [
        p.name,
        getStrand(p.strand).name,
        `Year ${p.ignite_year}`,
        ...(includeQaMetadata
          ? [p.qa_cohort_id ? "Synthetic QA" : "Student", p.qa_cohort_id ?? ""]
          : []),
      ]
        .map(escape)
        .join(","),
    ),
  ].join("\r\n");
}
