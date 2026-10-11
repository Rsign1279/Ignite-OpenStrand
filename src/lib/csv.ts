import { getStrand } from "@/config/strands";
import type { Profile } from "@/lib/validation";
export function profilesCsv(profiles: Profile[]) {
  const escape = (value: string) =>
    `"${value.replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""')}"`;
  return [
    "name,strand,IGNITE year",
    ...profiles.map((p) =>
      [p.name, getStrand(p.strand).name, `Year ${p.ignite_year}`]
        .map(escape)
        .join(","),
    ),
  ].join("\r\n");
}
