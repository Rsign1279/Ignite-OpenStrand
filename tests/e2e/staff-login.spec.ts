import { test, expect } from "@playwright/test";
test("staff login preserves failed password and allows checking it without another reset", async ({
  page,
}) => {
  await page.route("**/api/staff/login", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error:
          "Email or password wasn’t accepted. Use the new password from your private password file.",
      }),
    }),
  );
  await page.goto("/staff/login");
  await page.getByLabel("Staff email").fill("staff@example.org");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page.getByRole("button", { name: "Staff Login", exact: true }).click();
  await expect(page.locator("p.error")).toContainText("wasn’t accepted");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
    "test-password-only",
  );
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
});
test("staff connection failure does not blame the password or clear it", async ({
  page,
}) => {
  await page.route("**/api/staff/login", (route) => route.abort("failed"));
  await page.goto("/staff/login");
  await page.getByLabel("Staff email").fill("staff@example.org");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page.getByRole("button", { name: "Staff Login", exact: true }).click();
  await expect(page.locator("p.error")).toContainText("connection");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
    "test-password-only",
  );
  await expect(
    page.getByRole("button", { name: "Staff Login", exact: true }),
  ).toBeEnabled();
});
test("staff login normalizes email and blocks duplicate requests", async ({
  page,
}) => {
  let calls = 0;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/staff/login", async (route) => {
    calls++;
    expect(route.request().postDataJSON()).toEqual({
      email: "staff@example.org",
      password: "test-password-only",
    });
    await waiting;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Staff sign-in is temporarily unavailable.",
      }),
    });
  });
  await page.goto("/staff/login");
  await page.getByLabel("Staff email").fill("STAFF@EXAMPLE.ORG");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page.getByRole("button", { name: "Staff Login", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Signing in…" }),
  ).toBeDisabled();
  expect(calls).toBe(1);
  release();
  await expect(page.locator("p.error")).toContainText(
    "temporarily unavailable",
  );
});
