import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Attempt } from "@/lib/analytics/model";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.auth }));
vi.mock("@/lib/analytics/data", () => ({ loadAttempts: mocks.load }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
import RawData from "@/app/staff/page";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const attempts: Attempt[] = Array.from({ length: 101 }, (_, i) => ({
  id: id(i + 1),
  student_id: id(1000 + i),
  student_name: `Learner ${i + 1}`,
  strand: i % 2 ? "education" : "technology",
  question_id: "pagination-fixture",
  question_text: "Tell me how you adapted a plan.",
  attempt_number: 1,
  total_score: 6,
  scores: {
    situationTask: 1,
    personalActions: 2,
    resultImpact: 1,
    professionalCommunication: 2,
  },
  created_at: new Date(Date.UTC(2026, 9, 1) + i * 3600000).toISOString(),
  stage: "pre",
  is_legacy: false,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({});
  mocks.load.mockResolvedValue(attempts);
});

const render = async (params: Record<string, string | string[]>) =>
  renderToStaticMarkup(
    await RawData({ searchParams: Promise.resolve(params) }),
  );

it("clamps an oversized page to the final matching page and retains filters", async () => {
  const html = await render({
    page: "999999",
    strand: ["technology", "education"],
    student: "Learner",
    from: "2026-10-01",
    to: "2026-10-31",
  });
  expect(html).toContain("Page 3 of 3");
  expect(html).toContain("Learner 101");
  expect(html).not.toContain("Learner 100");
  expect(html).toContain(
    "/staff?strand=technology&amp;strand=education&amp;student=Learner&amp;from=2026-10-01&amp;to=2026-10-31&amp;page=2",
  );
  expect(html).not.toContain("Next →");
});

it("keeps an existing middle page and both neighboring page links", async () => {
  const html = await render({ page: "2" });
  expect(html).toContain("Page 2 of 3");
  expect(html).toContain("Learner 51");
  expect(html).toContain("Learner 100");
  expect(html).not.toContain("Learner 101");
  expect(html).toContain("page=1");
  expect(html).toContain("page=3");
});

it("shows the empty first page when no attempts match", async () => {
  mocks.load.mockResolvedValue([]);
  const html = await render({ page: "999999" });
  expect(html).toContain("Page 1 of 1");
  expect(html).toContain("No attempts match these filters.");
  expect(html).not.toContain("← Previous");
  expect(html).not.toContain("Next →");
});

it("normalizes invalid page values to the first page", async () => {
  for (const page of ["-4", "1.5", "not-a-page", "Infinity"]) {
    const html = await render({ page });
    expect(html).toContain("Page 1 of 3");
    expect(html).toContain("Learner 1");
    expect(html).not.toContain("Learner 51");
  }
});
