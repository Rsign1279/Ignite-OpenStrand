import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
import { AdminDashboard } from "@/components/admin-dashboard";
it("shows every registration and directs growth analysis to matched question attempts", () => {
  const html = renderToStaticMarkup(
    <AdminDashboard
      profiles={[
        {
          user_id: "11111111-1111-4111-8111-111111111111",
          name: "Student One",
          strand: "education",
          ignite_year: 1,
        },
        { name: "Student Two", strand: "technology", ignite_year: 2 },
      ]}
    />,
  );
  expect(html).toContain("Student One");
  expect(html).toContain("Student Two");
  expect(html).toContain("Registered Students");
  expect(html).toContain("No linked session");
  expect(html).toContain("/staff/student/11111111-1111-4111-8111-111111111111");
  expect(html).toContain("compares repeated answers to the same question");
  expect(html).toContain('href="/staff/dashboard"');
  expect(html).not.toContain("Average score change");
  expect(html).not.toContain("Completed interviews");
  expect(html).not.toContain("Pre / 12");
});
