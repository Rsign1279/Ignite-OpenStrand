import type { Filters } from "@/lib/analytics/model";
import { getStrand, type StrandId } from "@/config/strands";
export const number = (value: number | null) =>
  value === null ? "—" : value.toFixed(1);
export const signed = (value: number | null) =>
  value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
export const filterLabel = (f: Filters) =>
  `Strands: ${f.strand.length ? f.strand.map((id) => getStrand(id as StrandId).name).join(", ") : "All"} · Dates (UTC): ${f.from || "Beginning"} to ${f.to || "Today"} · Minimum attempts: ${f.minAttempts} · Student search: ${f.student || "All"}`;
