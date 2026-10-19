import { test, expect } from "@playwright/test";
test("full student text interview and secure reset", async ({ page }) => {
  let registered = false;
  await page.route("**/auth/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("logout")) return route.fulfill({ status: 204 });
    const user = {
      id: "11111111-1111-4111-8111-111111111111",
      aud: "authenticated",
      role: "authenticated",
      is_anonymous: true,
      created_at: new Date().toISOString(),
      app_metadata: {},
      user_metadata: {},
    };
    await route.fulfill({
      json: url.includes("signup")
        ? {
            access_token: "test-access-token",
            token_type: "bearer",
            expires_in: 3600,
            refresh_token: "test-refresh",
            user,
          }
        : user,
    });
  });
  await page.route("**/api/profile", (route) => {
    if (route.request().method() === "POST") {
      registered = true;
      return route.fulfill({ json: route.request().postDataJSON() });
    }
    return route.fulfill({
      json: registered
        ? { name: "Test Student", strand: "education", ignite_year: 1 }
        : null,
    });
  });
  await page.route("**/api/interview/evaluate", (route) => {
    const data = route.request().postDataJSON();
    const post = data.stage === "post";
    return route.fulfill({
      json: {
        evaluation: {
          scores: {
            situationTask: post ? 3 : 2,
            personalActions: 3,
            resultImpact: post ? 3 : 1,
            professionalCommunication: 3,
          },
          total: post ? 12 : 9,
          strongestPart: "You described your personal actions.",
          improvementArea: "State the final outcome.",
        },
        ...(post
          ? {
              comparison: {
                improvements: [
                  "Your task was clearer.",
                  "You included the outcome.",
                ],
                nextStep: "Include specific feedback.",
              },
            }
          : {}),
      },
    });
  });
  await page.route("**/api/interview/transfer-question", (route) =>
    route.fulfill({
      json: {
        question:
          "Tell me about a time you helped someone learn something difficult.",
      },
    }),
  );
  await page.route("**/api/interview/transfer-evaluate", (route) =>
    route.fulfill({
      json: {
        situation: true,
        task: true,
        action: true,
        result: true,
        observation: "You used all four components independently.",
      },
    }),
  );
  await page.goto("/interview");
  await page.getByLabel("What should we call you?").fill("Test Student");
  await page.getByRole("button", { name: "Education Innovation", exact: true }).click();
  await page.getByRole("button", { name: /Year 1 My first/ }).click();
  await page.getByRole("button", { name: "Begin Interview" }).click();
  await expect(
    page.getByRole("heading", { name: "Ready, Test Student?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  const exact =
    "Tell me about a time when a lesson, activity, project, or plan did not go as expected. What did you do?";
  await expect(page.getByRole("heading", { name: `“${exact}”` })).toBeVisible();
  await page.getByRole("button", { name: "Type my answer" }).click();
  await page
    .getByLabel("Your answer", { exact: true })
    .fill(
      "Our classroom project was behind schedule. I reorganized tasks and we finished on time.",
    );
  await page.getByRole("button", { name: "I'm Finished", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your starting point." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Discover the STAR method" }).click();
  await expect(
    page.getByRole("heading", { name: "Situation", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /I understand STAR/ }).click();
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  await expect(page.getByRole("heading", { name: `“${exact}”` })).toBeVisible();
  await page.getByRole("button", { name: "Type my answer" }).click();
  await page
    .getByLabel("Your answer", { exact: true })
    .fill(
      "Our project fell behind. I was responsible for the plan. I assigned tasks and checked progress. We finished on time and learned to plan earlier.",
    );
  await page.getByRole("button", { name: "I'm Finished", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Look how far you’ve come." }),
  ).toBeVisible();
  await expect(page.getByText("+3", { exact: false })).toBeVisible();
  await page
    .getByRole("button", { name: "Try a New Interview Question" })
    .click();
  await expect(
    page.getByRole("heading", { name: /Tell me about a time you helped/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Type my answer" }).click();
  await page
    .getByLabel("Your answer", { exact: true })
    .fill(
      "A classmate struggled with fractions. I helped them practice using a diagram. They solved the next problem on their own.",
    );
  await page.getByRole("button", { name: "I'm Finished", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Interview Practice Complete" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue to completion" }).click();
  await expect(
    page.getByRole("link", { name: "Complete Results Form" }),
  ).toHaveAttribute("href", "https://forms.gle/oXsPai5qjkUb5okw9");
  await page.getByRole("button", { name: "Next Student" }).click();
  await expect(page.getByLabel("What should we call you?")).toHaveValue("");
  await expect(page.getByText("Test Student", { exact: false })).toHaveCount(0);
  await expect(page.getByText("You included the outcome.")).toHaveCount(0);
});
test("landing fits the viewport and links work", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Start Student Interview" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Start Student Interview" }).click();
  await expect(page.getByLabel("What should we call you?")).toBeVisible();
});

test("landing has no critical accessibility violations", async ({ page }) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await page.goto("/");
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
});

test("voice recording waits for explicit finish and transcribes securely", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  await page.route("**/api/profile", (r) =>
    r.fulfill({
      json: { name: "Voice Student", strand: "education", ignite_year: 2 },
    }),
  );
  let transcribed = false;
  await page.route("**/api/transcribe", (r) => {
    transcribed = true;
    return r.fulfill({
      json: {
        transcript:
          "I helped organize our team project and we finished on time.",
      },
    });
  });
  await page.route("**/api/interview/evaluate", (r) =>
    r.fulfill({
      json: {
        evaluation: {
          scores: {
            situationTask: 2,
            personalActions: 2,
            resultImpact: 2,
            professionalCommunication: 2,
          },
          total: 8,
          strongestPart: "You identified your contribution.",
          improvementArea: "Add specific actions.",
        },
      },
    }),
  );
  await page.goto("/interview");
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  await page
    .getByRole("button", { name: "Begin Answer", exact: true })
    .first()
    .click();
  await expect(page.getByRole("status")).toContainText("Recording");
  expect(transcribed).toBe(false);
  await page
    .getByRole("button", { name: "I'm Finished", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Your starting point." }),
  ).toBeVisible();
  expect(transcribed).toBe(true);
});
test("microphone denial offers text fallback without skipping assessment", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Permission denied", "NotAllowedError");
    };
  });
  await page.route("**/api/profile", (r) =>
    r.fulfill({
      json: { name: "Student", strand: "education", ignite_year: 1 },
    }),
  );
  await page.goto("/interview");
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  await page
    .getByRole("button", { name: "Begin Answer", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Your answer", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Tell me about a time when a lesson/ }),
  ).toBeVisible();
});

test("onboarding and staff login pass accessibility and reduced-motion layout checks", async ({
  page,
}) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/profile", (r) => r.fulfill({ json: null }));
  for (const path of ["/interview", "/staff"]) {
    await page.goto(path);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
