import { expect, test } from "@playwright/test";

test("signup network failure preserves John Doe's choices and allows a clean retry", async ({
  page,
}) => {
  let unreachable = true;
  let profileWrites = 0;
  let signups = 0;
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    aud: "authenticated",
    role: "authenticated",
    is_anonymous: true,
    created_at: "2026-01-01T00:00:00Z",
    app_metadata: {},
    user_metadata: {},
  };
  await page.route("**/auth/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/logout")) return route.fulfill({ status: 204 });
    if (path.endsWith("/signup")) {
      signups++;
      if (unreachable) return route.abort("failed");
      return route.fulfill({
        json: {
          user,
          access_token: "synthetic-access-token",
          refresh_token: "synthetic-refresh-token",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      });
    }
    return route.fulfill({ json: user });
  });
  await page.route("**/api/profile", (route) => {
    const writing = route.request().method() === "POST";
    if (writing) profileWrites++;
    return route.fulfill({
      headers: { "X-Student-Session": user.id },
      json: writing ? route.request().postDataJSON() : null,
    });
  });

  await page.goto("/interview");
  await page.getByLabel("What should we call you?").fill("John Doe");
  await page.getByRole("button", { name: "Technology", exact: true }).click();
  await page.getByRole("button", { name: /Year 1 My first/ }).click();
  const begin = page.getByRole("button", {
    name: "Begin Interview",
    exact: true,
  });
  await begin.click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "We couldn't reach student sign-in. Your details are still here.",
  );
  await expect(page.getByLabel("What should we call you?")).toHaveValue(
    "John Doe",
  );
  await expect(
    page.getByRole("button", { name: "Technology", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: /Year 1 My first/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(begin).toBeEnabled();
  expect(profileWrites).toBe(0);

  unreachable = false;
  await begin.click();
  await expect(
    page.getByRole("heading", { name: "Ready, John Doe?" }),
  ).toBeVisible();
  expect(profileWrites).toBe(1);
  expect(signups).toBe(2);
});
