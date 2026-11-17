import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";

test.beforeAll(() =>
  execFileSync(process.execPath, ["tests/fixtures/build-qa-teacher.mjs"], {
    stdio: "pipe",
  }),
);
async function preview(page: Page, scope: string) {
  await page.route("https://qa-preview.example/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith(".js"))
      return route.fulfill({
        path: resolve(".local-setup/qa-teacher-preview", basename(path)),
        contentType: "application/javascript",
      });
    if (path.endsWith(".woff2")) {
      const family = basename(path, ".woff2");
      if (family !== "figtree" && family !== "eb-garamond")
        return route.abort();
      return route.fulfill({
        path: resolve(
          `node_modules/@fontsource-variable/${family}/files/${family}-latin-wght-normal.woff2`,
        ),
        contentType: "font/woff2",
      });
    }
    if (path.endsWith(".css"))
      return route.fulfill({
        body:
          `@font-face{font-family:TestFigtree;src:url('/__qa_teacher_preview__/figtree.woff2')}@font-face{font-family:TestGaramond;src:url('/__qa_teacher_preview__/eb-garamond.woff2')} :root{--font-studio-sans:TestFigtree;--font-studio-serif:TestGaramond}\n` +
          ["globals", "studio", "editorial", "staff-studio"]
            .map((file) => readFileSync(`src/app/${file}.css`, "utf8"))
            .join("\n"),
        contentType: "text/css",
      });
    if (path === "/ignite-logo.png")
      return route.fulfill({
        path: resolve("public/ignite-logo.png"),
        contentType: "image/png",
      });
    if (path.endsWith(".svg"))
      return route.fulfill({
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="36"><text x="2" y="24">IGNITE</text></svg>',
        contentType: "image/svg+xml",
      });
    if (path.startsWith("/api/")) return route.abort();
    return route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic teacher QA UI check</title><link rel="stylesheet" href="/__qa_teacher_preview__/style.css"></head><body><div id="root"></div><script type="module" src="/__qa_teacher_preview__/qa-teacher-preview.js"></script></body></html>',
    });
  });
  await page.goto(
    `https://qa-preview.example/__qa_teacher_preview__/?scope=${scope}`,
  );
}

test("QA lab shows only marked test identities with QA-filtered history and exports", async ({
  page,
}) => {
  await preview(page, "qa");
  await expect(
    page.getByRole("heading", { name: "Pilot QA, ready to review." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "QA lab", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page
      .getByRole("region", { name: "Student registrations table" })
      .locator("tbody tr"),
  ).toHaveCount(24);
  await expect(page.locator("body")).not.toContainText("Real cohort learner");
  await expect(
    page.getByRole("link", {
      name: "View scored attempts for Pilot QA 01",
      exact: true,
    }),
  ).toHaveAttribute(
    "href",
    "/staff/student/00000000-0000-4000-8000-000000000001?scope=qa",
  );
  await page
    .getByRole("textbox", { name: "Search by name" })
    .fill("Pilot QA 01");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("ignite-qa-registrations.csv");
  const csv = readFileSync((await download.path())!, "utf8");
  expect(csv).toContain("session_kind,qa_cohort_id");
  expect(csv).toContain("Synthetic QA");
  expect(csv).toContain("Pilot QA 01");
  expect(csv).not.toContain("Pilot QA 02");
});

test("QA lab stays accessible and within a 320px viewport", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await preview(page, "qa");
  await expect(
    page.getByRole("heading", { name: "Pilot QA, ready to review." }),
  ).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    regions: [
      ...document.querySelectorAll(
        ".table-scroll,.table-panel,.admin-main,.staff-workspace",
      ),
    ].map((element) => ({
      name: element.className,
      width: element.getBoundingClientRect().width,
      overflowX: getComputedStyle(element).overflowX,
      scrollWidth: element.scrollWidth,
    })),
    overflow: [...document.querySelectorAll("body *")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.left < -1 || box.right > window.innerWidth + 1;
      })
      .slice(0, 16)
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
        width: element.getBoundingClientRect().width,
      })),
  }));
  expect(
    dimensions.scrollWidth,
    JSON.stringify(dimensions),
  ).toBeLessThanOrEqual(dimensions.width + 1);
  const table = page.getByRole("region", {
    name: "Student registrations table",
  });
  expect(
    await table.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBe(true);
  expect(
    (await table.locator("tbody tr").first().boundingBox())!.height,
  ).toBeLessThan(160);
  await table.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => table.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("qa-lab-320.png"),
    fullPage: true,
  });
});
