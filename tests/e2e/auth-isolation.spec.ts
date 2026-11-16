import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { SESSION_CHANGED_MESSAGE } from "../../src/lib/student-session";

const firstId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
function sessionCookieOrigin() {
  return String(test.info().project.use.baseURL ?? "http://localhost:3100");
}
const answer =
  "For a private student project I planned every task, checked our progress, and helped our team finish.";
const user = (id: string) => ({
  id,
  aud: "authenticated",
  role: "authenticated",
  is_anonymous: true,
  created_at: "2026-01-01T00:00:00Z",
  app_metadata: {},
  user_metadata: {},
});
async function configure(context: BrowserContext) {
  const session = {
    access_token: "test-access-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "test-refresh",
    user: user(firstId),
  };
  await context.addCookies([
    {
      name: "sb-test-auth-token",
      value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
      url: sessionCookieOrigin(),
      secure: new URL(sessionCookieOrigin()).protocol === "https:",
      sameSite: "Lax",
    },
  ]);
  await context.route("**/auth/v1/**", (route) => {
    if (route.request().url().includes("logout"))
      return route.fulfill({ status: 204 });
    return route.fulfill({ json: user(firstId) });
  });
  await context.route("**/api/profile", (route) =>
    route.fulfill({
      headers: { "X-Student-Session": firstId },
      json: { name: "First Student", strand: "education", ignite_year: 1 },
    }),
  );
}
async function enter(page: Page) {
  await page.goto("/interview");
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  await page
    .getByRole("button", { name: "I’m ready — ask the question" })
    .click();
  await page.getByRole("button", { name: "Type my answer" }).click();
  await page.getByLabel("Your answer", { exact: true }).fill(answer);
}

test("signout in another tab clears the old student's answer and profile", async ({
  page,
  context,
}) => {
  await configure(context);
  let evaluations = 0;
  await context.route("**/api/interview/evaluate", (route) => {
    evaluations++;
    return route.abort();
  });
  await enter(page);
  const other = await context.newPage();
  await other.goto("/interview");
  await expect(
    other.getByRole("heading", { name: "Ready, First Student?" }),
  ).toBeVisible();
  await other.getByRole("button", { name: "End session" }).click();
  await expect(page.getByLabel("What should we call you?")).toHaveValue("");
  await expect(
    page.getByRole("alert").filter({ hasText: SESSION_CHANGED_MESSAGE }),
  ).toContainText(SESSION_CHANGED_MESSAGE);
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveCount(0);
  await expect(page.getByText(answer, { exact: true })).toHaveCount(0);
  expect(evaluations).toBe(0);
});

test("a cookie change before its auth broadcast cannot submit an old draft as another student", async ({
  page,
  context,
}) => {
  await configure(context);
  await enter(page);
  // Model the narrow window before the SDK delivers its cross-tab auth event.
  const secondSession = {
    access_token: "second-test-access",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "second-refresh",
    user: user(secondId),
  };
  await context.addCookies([
    {
      name: "sb-test-auth-token",
      value: `base64-${Buffer.from(JSON.stringify(secondSession)).toString("base64url")}`,
      url: sessionCookieOrigin(),
      secure: new URL(sessionCookieOrigin()).protocol === "https:",
      sameSite: "Lax",
    },
  ]);
  let pinnedId: string | undefined;
  await page.route("**/api/interview/evaluate", (route) => {
    pinnedId = route.request().headers()["x-student-session"];
    return route.fulfill({
      status: 409,
      json: { error: SESSION_CHANGED_MESSAGE },
    });
  });
  await page.getByRole("button", { name: "I'm Finished", exact: true }).click();
  await expect(page.getByLabel("What should we call you?")).toHaveValue("");
  expect(pinnedId).toBe(firstId);
  await expect(
    page.getByRole("alert").filter({ hasText: SESSION_CHANGED_MESSAGE }),
  ).toContainText(SESSION_CHANGED_MESSAGE);
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveCount(0);
});

test("cross-tab logout aborts in-flight feedback and its late result cannot restore a student", async ({
  page,
  context,
}) => {
  await configure(context);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/interview/evaluate", async (route) => {
    await pending;
    await route
      .fulfill({
        json: {
          evaluation: {
            scores: {
              situationTask: 2,
              personalActions: 2,
              resultImpact: 2,
              professionalCommunication: 2,
            },
            total: 8,
            strongestPart: "Private feedback for First Student",
            improvementArea: "State the outcome.",
          },
        },
      })
      .catch(() => {});
  });
  await enter(page);
  await page.getByRole("button", { name: "I'm Finished", exact: true }).click();
  const other = await context.newPage();
  await other.goto("/interview");
  await other.getByRole("button", { name: "End session" }).click();
  await expect(page.getByLabel("What should we call you?")).toBeVisible();
  release();
  await expect(
    page.getByText("Private feedback for First Student"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Your starting point." }),
  ).toHaveCount(0);
});

test("staff login in another tab clears student work even when server cookies bypass SDK events", async ({
  page,
  context,
}) => {
  await configure(context);
  await enter(page);
  const staff = await context.newPage();
  await staff.route("**/api/staff/login", (route) =>
    route.fulfill({ json: { success: true } }),
  );
  await staff.goto("/staff/login");
  await staff.getByLabel("Staff email").fill("staff@example.org");
  await staff
    .getByLabel("Password", { exact: true })
    .fill("synthetic-test-password");
  await staff.getByRole("button", { name: "Staff Login", exact: true }).click();
  await expect(page.getByLabel("What should we call you?")).toHaveValue("");
  await expect(
    page.getByRole("alert").filter({ hasText: SESSION_CHANGED_MESSAGE }),
  ).toBeVisible();
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveCount(0);
});
