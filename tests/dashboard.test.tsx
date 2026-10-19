import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
import { AdminDashboard } from "@/components/admin-dashboard";
it("shows paired growth and category details without treating missing scores as zero", () => {
  const html = renderToStaticMarkup(
    <AdminDashboard
      profiles={[
        {
          user_id: "one",
          name: "Student One",
          strand: "education",
          ignite_year: 1,
        },
        {
          user_id: "two",
          name: "Student Two",
          strand: "technology",
          ignite_year: 2,
        },
      ]}
      results={[
        {
          user_id: "one",
          pre_scores: {
            situationTask: 1,
            personalActions: 2,
            resultImpact: 1,
            professionalCommunication: 2,
          },
          post_scores: {
            situationTask: 2,
            personalActions: 3,
            resultImpact: 2,
            professionalCommunication: 3,
          },
          transfer_star: {
            situation: true,
            task: false,
            action: true,
            result: false,
          },
          updated_at: "2026-10-19T12:00:00Z",
          completed_at: "2026-10-19T12:00:00Z",
        },
      ]}
    />,
  );
  expect(html).toContain("+4.0");
  expect(html).toContain("+4");
  expect(html).toContain("No saved assessment");
  expect(html).toContain("task: Missing");
  expect(html).toContain("Situation &amp; Task");
});
