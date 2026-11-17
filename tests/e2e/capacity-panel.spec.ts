import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";

const checkedAt = "2026-11-17T12:00:00.000Z";
const snapshot = {
  configured: true,
  available: true,
  checkedAt,
  lanes: [
    {
      lane: "text",
      maxConcurrent: 4,
      requestsPerMinute: 20,
      active: 2,
      requestsInMinute: 6,
      cooldownSeconds: 0,
      latest: {
        observedAt: checkedAt,
        status: 200,
        latencyMs: 810,
        requestsPerDayLimit: 1000,
        requestsPerDayRemaining: 999,
        tokensPerMinuteLimit: 8000,
        tokensPerMinuteRemaining: 7000,
      },
    },
    {
      lane: "audio",
      maxConcurrent: 2,
      requestsPerMinute: 12,
      active: 0,
      requestsInMinute: 0,
      cooldownSeconds: 0,
      latest: null,
    },
  ],
};
test.beforeAll(() =>
  execFileSync(
    process.execPath,
    ["tests/fixtures/build-capacity-preview.mjs"],
    { stdio: "pipe" },
  ),
);
async function open(page: Page, response: () => object) {
  let reads = 0;
  await page.route("https://capacity-preview.example/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/staff/capacity") {
      reads++;
      return route.fulfill({ json: response() });
    }
    if (path.endsWith(".js") || path.endsWith(".css")) {
      return route.fulfill({
        path: resolve(
          `.local-setup/capacity-preview/capacity-preview.${path.endsWith(".js") ? "js" : "css"}`,
        ),
        contentType: path.endsWith(".js")
          ? "application/javascript"
          : "text/css",
      });
    }
    return route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic capacity check</title><link rel="stylesheet" href="/capacity-preview.css"></head><body><div id="root"></div><script type="module" src="/capacity-preview.js"></script></body></html>',
    });
  });
  await page.goto("https://capacity-preview.example/");
  return () => reads;
}
test("capacity panel fetches once, refreshes on request, and labels observed quotas accurately", async ({
  page,
}) => {
  const reads = await open(page, () => snapshot);
  await expect(
    page.getByRole("button", { name: "Refresh capacity" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "Answer reviews" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Voice transcription" }),
  ).toBeVisible();
  await expect(page.locator("body")).toContainText("999 / 1,000");
  await expect(page.locator("body")).toContainText("7,000 / 8,000");
  await expect(page.locator("body")).toContainText(
    "No provider response observed yet.",
  );
  await page.clock.install();
  await page.clock.fastForward(120000);
  expect(reads()).toBe(1);
  await page.getByRole("button", { name: "Refresh capacity" }).click();
  await expect(
    page.getByRole("button", { name: "Refresh capacity" }),
  ).toBeEnabled();
  expect(reads()).toBe(2);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});
test("capacity panel marks an unavailable store without presenting quotas as zero", async ({
  page,
}) => {
  await open(page, () => ({
    configured: false,
    available: false,
    checkedAt,
    lanes: [],
  }));
  await expect(page.getByRole("status")).toContainText(
    "Provider limits remain unverified",
  );
  await expect(
    page.getByRole("button", { name: "Refresh capacity" }),
  ).toBeEnabled();
  await expect(page.locator("body")).not.toContainText("0 / 0");
  await expect(
    page.getByRole("heading", { name: "Answer reviews" }),
  ).toHaveCount(0);
});

test("leaving the capacity view aborts a pending manual refresh", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await open(page, () => snapshot);
  await expect(
    page.getByRole("button", { name: "Refresh capacity" }),
  ).toBeEnabled();
  await page.evaluate(() => {
    const fetch = window.fetch;
    window.fetch = (input, init) => {
      if (String(input) !== "/api/staff/capacity") return fetch(input, init);
      document.documentElement.dataset.capacityRefreshPending = "true";
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            document.documentElement.dataset.capacityRefreshAborted = "true";
            reject(new DOMException("Request canceled.", "AbortError"));
          },
          { once: true },
        );
      });
    };
  });
  await page.getByRole("button", { name: "Refresh capacity" }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-capacity-refresh-pending",
    "true",
  );
  await page.getByRole("button", { name: "Leave capacity view" }).click();
  await expect(
    page.getByRole("heading", { name: "Know the current limits." }),
  ).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute(
    "data-capacity-refresh-aborted",
    "true",
  );
  expect(pageErrors).toEqual([]);
});
