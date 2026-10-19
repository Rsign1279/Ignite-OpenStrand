"use client";
import dynamic from "next/dynamic";
const ChartSkeleton = () => (
  <div className="chart-skeleton" role="status" aria-label="Loading charts" />
);
// Chart rendering stays isolated from the student interview bundle.
export const ProgramCharts = dynamic(
  () => import("./charts").then((m) => m.ProgramCharts),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
export const StudentCharts = dynamic(
  () => import("./charts").then((m) => m.StudentCharts),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
