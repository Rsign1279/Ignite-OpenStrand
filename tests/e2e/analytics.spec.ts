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
    if (url.pathname.endsWith(".js"))
      return route.fulfill({
        path: resolve(".local-setup/analytics-preview", basename(url.pathname)),
        contentType: "application/javascript",
      });
    if (url.pathname.endsWith(".css"))
      return route.fulfill({
        body: readFileSync("src/app/globals.css", "utf8"),
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
      page.getByRole("heading", { name: "See practice turn into progress." }),
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
    else
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
  expect(errors).toEqual([]);
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
test("analytics has no serious accessibility violations and keyboard chart data is available", async ({
  page,
}) => {
  await preview(page, "count=1");
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
    page.getByRole("columnheader", { name: "Students", exact: true }),
  ).toBeVisible();
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
