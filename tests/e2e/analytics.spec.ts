import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
test.beforeAll(() => {
  execFileSync(process.execPath, ["tests/fixtures/build-analytics.mjs"], {
    stdio: "pipe",
  });
});
async function preview(
  page: import("@playwright/test").Page,
  query = "count=300",
) {
  await page.route("**/__analytics_preview__/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(".woff2")) {
      const family = basename(url.pathname, ".woff2");
      if (family !== "figtree" && family !== "eb-garamond")
        return route.abort();
      return route.fulfill({
        path: resolve(
          `node_modules/@fontsource-variable/${family}/files/${family}-latin-wght-normal.woff2`,
        ),
        contentType: "font/woff2",
      });
    }
    if (url.pathname.endsWith(".js"))
      return route.fulfill({
        path: resolve(".local-setup/analytics-preview", basename(url.pathname)),
        contentType: "application/javascript",
      });
    if (url.pathname.endsWith(".css"))
      return route.fulfill({
        body:
          `@font-face{font-family:TestFigtree;src:url('/__analytics_preview__/figtree.woff2')}@font-face{font-family:TestGaramond;src:url('/__analytics_preview__/eb-garamond.woff2')} :root{--font-studio-sans:TestFigtree;--font-studio-serif:TestGaramond}\n` +
          ["globals", "studio", "editorial", "staff-studio"]
            .map((file) => readFileSync(`src/app/${file}.css`, "utf8"))
            .join("\n"),
        contentType: "text/css",
      });
    return route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>IGNITE Analytics Test</title><link rel="stylesheet" href="/__analytics_preview__/style.css"></head><body><div id="root"></div><script type="module" src="/__analytics_preview__/analytics-preview.js"></script></body></html>',
    });
  });
  await page.goto("/__analytics_preview__/?" + query);
}
test("analytics handles 0, 1 and 300 attempts without clipping the mobile viewport", async ({
  page,
}, testInfo) => {
  for (const count of [0, 1, 300]) {
    await preview(page, "count=" + count);
    await expect(
      page.getByRole("heading", { name: "Student practice at a glance." }),
    ).toBeVisible();
    await expect(page.locator("[data-pdf-chart]")).toHaveCount(5);
    if (count === 300)
      await page.screenshot({
        path: ".local-setup/analytics-" + testInfo.project.name + ".png",
      });
    if (count === 0)
      await expect(
        page.getByText("No practice data yet", { exact: true }),
      ).toHaveCount(5);
    else if (count === 1) {
      await expect(
        page.getByText("No repeated questions yet", { exact: true }),
      ).toBeVisible();
      await expect(
        page.locator(".recharts-wrapper > svg.recharts-surface"),
      ).toHaveCount(4);
    } else
      await expect(
        page.locator(".recharts-wrapper > svg.recharts-surface"),
      ).toHaveCount(5);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  }
});
test("dashboard PDF contains vector chart content and the full leaderboard", async ({
  page,
}, testInfo) => {
  await preview(page);
  await expect(
    page.locator(".recharts-wrapper > svg.recharts-surface"),
  ).toHaveCount(5);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export dashboard PDF" }).click();
  const download = await downloadPromise;
  const path = testInfo.outputPath("program.pdf");
  await download.saveAs(path);
  const bytes = readFileSync(path);
  expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  expect(bytes.length).toBeGreaterThan(5000);
  expect(bytes.toString("latin1")).not.toContain("/Subtype /Image");
  expect(bytes.toString("latin1")).toContain("repeated student-question pairs");
  expect(errors).toEqual([]);
});
test("paired evidence preserves regression, no change and missing repeats", async ({
  page,
}) => {
  await preview(page, "count=10&outcomes=mixed");
  const evidence = page.locator(".pilot-evidence");
  await expect(evidence).toContainText(
    "3 comparable repeated student–question pairs from 3 students",
  );
  await expect(evidence).toContainText("1 student has no same-question repeat");
  for (const label of [
    "Latest score higher",
    "Latest score unchanged",
    "Latest score lower",
  ]) {
    await expect(
      evidence.getByText(label, { exact: true }).locator(".."),
    ).toContainText("1");
  }
  const row = (student: string) =>
    page
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: student, exact: true }) });
  await expect(row("Practice Student 1")).toContainText("-3.0 pts");
  await expect(row("Practice Student 2")).toContainText("+0.0 pts");
  await expect(row("Practice Student 3")).toContainText("+6.0 pts");
  await expect(row("Practice Student 4")).toContainText("— pts");
  await expect(row("Practice Student 4")).toContainText("Practiced once");
});
test("student charts and PDF render for a single student", async ({
  page,
}, testInfo) => {
  await preview(page, "count=300&drilldown=1");
  await expect(
    page.locator(".recharts-wrapper > svg.recharts-surface"),
  ).toHaveCount(2);
  await expect(page.getByText("Your student and their strand")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export dashboard PDF" }).click();
  const file = await downloadPromise;
  await file.saveAs(testInfo.outputPath("student.pdf"));
});
test("a changed scoring method is explained and excluded from growth", async ({
  page,
}) => {
  await preview(page, "count=3&versions=mixed");
  await expect(
    page.getByText("No comparable repeats yet", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".pilot-evidence")).toContainText(
    "0 comparable repeated student–question pairs from 0 students",
  );
  await expect(page.locator(".pilot-evidence")).toContainText(
    "1 repeated question pair is excluded",
  );
  const row = page.getByRole("row").filter({
    has: page.getByRole("link", { name: "Practice Student 1", exact: true }),
  });
  await expect(row).toContainText("Scoring method changed");
  await expect(row).toContainText("— pts");
  await expect(row).not.toContainText("Latest score higher");
});
test("analytics has no serious accessibility violations and keyboard chart data is available", async ({
  page,
}) => {
  await preview(page, "count=300");
  await expect(
    page.locator(".recharts-wrapper > svg.recharts-surface"),
  ).toHaveCount(5);
  const violations = (
    await new AxeBuilder({ page }).analyze()
  ).violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
  expect(violations).toEqual([]);
  await page.getByText("View chart data", { exact: true }).first().focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("columnheader", {
      name: "Students with repeats",
      exact: true,
    }),
  ).toBeVisible();
});
test("empty and expanded analytics tables remain keyboard accessible at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  for (const count of [0, 300]) {
    await preview(page, `count=${count}`);
    await expect(
      page.getByRole("heading", { name: "Student practice at a glance." }),
    ).toBeVisible();
    for (const summary of await page
      .locator(
        "details.analytics-method > summary, .pilot-evidence > details > summary",
      )
      .all()) {
      await summary.focus();
      await page.keyboard.press("Enter");
    }
    if (count === 300) {
      await expect(page.locator(".chart-data summary")).toHaveCount(5);
      for (const summary of await page.locator(".chart-data summary").all())
        await summary.click();
      await expect(
        page.getByRole("region", { name: "Chart data table" }).first(),
      ).toHaveAttribute("tabindex", "0");
    }
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.map((node) => node.target),
      })),
      `count=${count}`,
    ).toEqual([]);
  }
});
test("staff routes and JSON analytics reject unauthenticated access", async ({
  page,
  request,
}) => {
  for (const path of [
    "/staff",
    "/staff/dashboard",
    "/staff/student/11111111-1111-4111-8111-111111111111",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/staff\/login/);
  }
  const response = await request.get("/api/staff/analytics");
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
});
