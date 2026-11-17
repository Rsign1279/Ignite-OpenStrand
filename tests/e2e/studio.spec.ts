import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { getStrand, type StrandId } from "../../src/config/strands";

const evaluation = {
  scores: {
    situation: 2,
    action: 2,
    result: 1,
    task: 2,
  },
  total: 7,
  strongestPart: "Your actions were specific.",
  improvementArea: "Explain the result of your actions.",
};
const answer =
  "Our class project was behind schedule. I organized the tasks and checked progress. We completed it together.";

const syntheticUser = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  is_anonymous: true,
  created_at: "2026-01-01T00:00:00Z",
  app_metadata: {},
  user_metadata: {},
};

async function mockStudentAuth(page: Page) {
  await page.route("**/auth/v1/**", (route) => {
    const url = route.request().url();
    if (url.includes("logout")) return route.fulfill({ status: 204 });
    return route.fulfill({
      json: url.includes("signup")
        ? {
            access_token: "test-access-token",
            token_type: "bearer",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            refresh_token: "test-refresh",
            user: syntheticUser,
          }
        : syntheticUser,
    });
  });
}

async function registerStudent(page: Page) {
  await page.getByLabel("What should we call you?").fill("New Student");
  await page
    .getByRole("button", { name: "Education Innovation", exact: true })
    .click();
  await page.getByRole("button", { name: /Year 1 My first/ }).click();
  await page.getByRole("button", { name: "Begin Interview" }).click();
}

test("onboarding waits for hydration before accepting a student's details", async ({
  page,
}) => {
  await mockStudentAuth(page);
  await page.route("**/api/profile", (route) =>
    route.fulfill({
      headers: { "X-Student-Session": syntheticUser.id },
      json:
        route.request().method() === "POST"
          ? route.request().postDataJSON()
          : null,
    }),
  );
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/_next/static/**/*.js", async (route) => {
    await pending;
    await route.continue();
  });
  await page.goto("/interview", { waitUntil: "commit" });
  try {
    await expect(page.getByLabel("What should we call you?")).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Education Innovation", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Preparing your studio…" }),
    ).toBeDisabled();
  } finally {
    release();
  }
  await expect(page.getByLabel("What should we call you?")).toBeEnabled();
  await registerStudent(page);
  await expect(
    page.getByRole("heading", { name: "Ready, New Student?" }),
  ).toBeVisible();
});

async function prepare(
  page: Page,
  strand = "education",
  assessment = evaluation,
) {
  const submissions: Record<string, unknown>[] = [];
  await page.route("**/api/profile", (route) =>
    route.fulfill({
      headers: { "X-Student-Session": "11111111-1111-4111-8111-111111111111" },
      json: { name: "Studio Student", strand, ignite_year: 1 },
    }),
  );
  await page.route("**/api/interview/evaluate", (route) => {
    const body = route.request().postDataJSON();
    submissions.push(body);
    return route.fulfill({
      json: {
        evaluation: assessment,
        ...(body.stage === "post"
          ? {
              comparison: {
                improvements: ["Your task was clear.", "You named an action."],
                nextStep: "Describe a specific outcome.",
              },
            }
          : {}),
      },
    });
  });
  await page.goto("/interview");
  await expect(
    page.getByRole("button", { name: "Meet your interviewer" }),
  ).toBeVisible();
  return submissions;
}

async function enterScene(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  const enter = page.getByRole("button", {
    name: "I’m ready — ask the question",
  });
  await expect(enter).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Type my answer" }),
  ).toHaveCount(0);
  await enter.click();
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
}

async function submitAnswer(page: Page, text = answer) {
  await page.getByRole("button", { name: "Type my answer" }).click();
  await page.getByLabel("Your answer", { exact: true }).fill(text);
  await page.getByRole("button", { name: "I'm Finished", exact: true }).click();
}

async function selectedQuestion(page: Page, strand: StrandId = "education") {
  const id = await page
    .getByLabel("Choose a practice question · 10 in your strand")
    .inputValue();
  const question = getStrand(strand).questions.find(
    (question) => question.id === id,
  );
  expect(question).toBeDefined();
  return question!.text;
}

async function reachLesson(page: Page, question?: string) {
  if (question) await expect(page.locator("main")).not.toContainText(question);
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  if (question) await expect(page.locator("main")).not.toContainText(question);
  await enterScene(page);
  if (question)
    await expect(page.locator(".question")).toHaveText(`“${question}”`);
  await submitAnswer(page);
  await page.getByRole("button", { name: /Discover the STAR method/ }).click();
}

test("every assessment, new question, and retry begins with an explicit scene", async ({
  page,
}) => {
  const submissions = await prepare(page);
  const originalQuestion = await selectedQuestion(page);
  await reachLesson(page, originalQuestion);
  await page.getByRole("button", { name: /Try again with STAR/ }).click();
  await expect(page.locator("main")).not.toContainText(originalQuestion);
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  await expect(page.locator("main")).not.toContainText(originalQuestion);
  await enterScene(page);
  await expect(page.locator(".question")).toHaveText(`“${originalQuestion}”`);
  await submitAnswer(page);
  await page
    .getByRole("button", { name: "Try a New Interview Question" })
    .click();
  await enterScene(page);
  await submitAnswer(page);
  await page.getByRole("button", { name: "Retry this question" }).click();
  await enterScene(page);
  await submitAnswer(page);
  await expect(
    page.getByRole("heading", { name: "Your practice results." }),
  ).toBeVisible();
  expect(submissions).toHaveLength(4);
  expect(submissions[1].questionId).toBe(submissions[0].questionId);
  expect(submissions[2].questionId).not.toBe(submissions[0].questionId);
  expect(submissions[3].questionId).toBe(submissions[2].questionId);
  expect(submissions[3].requestId).not.toBe(submissions[2].requestId);
});

test("scene navigation is keyboard usable and never requests the microphone", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "studioMicrophoneRequests", {
      value: 0,
      writable: true,
    });
    navigator.mediaDevices.getUserMedia = async () => {
      const counter = window as unknown as { studioMicrophoneRequests: number };
      counter.studioMicrophoneRequests++;
      throw new DOMException(
        "Unexpected microphone request",
        "NotAllowedError",
      );
    };
  });
  await prepare(page);
  const meet = page.getByRole("button", { name: "Meet your interviewer" });
  await meet.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  const ready = page.getByRole("button", {
    name: "I’m ready — ask the question",
  });
  await page.keyboard.press("Tab");
  await expect(ready).toBeFocused();
  const sceneDetail = page.getByText("More scene detail", { exact: true });
  await sceneDetail.focus();
  await page.keyboard.press("Enter");
  const detailParagraph = page.locator(".scene-details > p");
  await expect(detailParagraph).toBeVisible();
  await expect(detailParagraph).toHaveText(/\S/);
  await page.keyboard.press("Enter");
  await expect(detailParagraph).not.toBeVisible();
  await ready.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Type my answer" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { studioMicrophoneRequests: number })
          .studioMicrophoneRequests,
    ),
  ).toBe(0);
});

test("post-comparison retry keeps the canonical question and includes all same-question attempts", async ({
  page,
}) => {
  const submissions = await prepare(page);
  const originalQuestion = await selectedQuestion(page);
  await reachLesson(page);
  await page.getByRole("button", { name: /Try again with STAR/ }).click();
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  await enterScene(page);
  await submitAnswer(page);
  await page
    .getByRole("button", { name: "Retry this question", exact: true })
    .click();
  await expect(
    page.getByText("ANOTHER TAKE · THE SAME QUESTION"),
  ).toBeVisible();
  await enterScene(page);
  await expect(page.locator(".question")).toHaveText(`“${originalQuestion}”`);
  await submitAnswer(page);
  await expect(
    page.getByRole("region", { name: "Growth on this question" }),
  ).toContainText("Based on 3 comparable scored responses to this question");
  expect(submissions).toHaveLength(3);
  expect(submissions[2].stage).toBe("practice");
  expect(submissions[2].questionId).toBe(submissions[0].questionId);
  expect(submissions[1].questionId).toBe(submissions[0].questionId);
  expect(
    new Set(submissions.map((submission) => submission.requestId)).size,
  ).toBe(3);
});

test("students can inspect both submitted answers and reset clears the comparison", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 820 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepare(page);
  await reachLesson(page);
  await page.getByRole("button", { name: /Try again with STAR/ }).click();
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  await enterScene(page);
  const secondAnswer =
    "I listed the unfinished tasks and asked each teammate to choose one. I checked our progress, and we completed the project before the class presentation.";
  await submitAnswer(page, secondAnswer);
  await page.locator(".comparison-hero").scrollIntoViewIfNeeded();
  const scoreContrasts = await page
    .locator(".comparison-hero strong")
    .evaluateAll((elements) => {
      const luminance = (color: string) => {
        const channels = color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((value) => {
            const channel = value / 255;
            return channel <= 0.04045
              ? channel / 12.92
              : ((channel + 0.055) / 1.055) ** 2.4;
          });
        return (
          channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        );
      };
      return elements.map((element) => {
        const foreground = getComputedStyle(element).color;
        const background = getComputedStyle(
          element.closest(".comparison-hero")!,
        ).backgroundColor;
        const light = luminance(foreground),
          dark = luminance(background);
        return {
          foreground,
          background,
          ratio:
            (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05),
        };
      });
    });
  expect(scoreContrasts).toHaveLength(2);
  for (const score of scoreContrasts)
    expect(score.ratio, JSON.stringify(score)).toBeGreaterThanOrEqual(3);
  const scoreAccessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(scoreAccessibility.violations).toEqual([]);
  const comparison = page.locator(".answer-comparison");
  await comparison.locator("summary").click();
  await expect(comparison.locator("article").nth(0)).toContainText(answer);
  await expect(comparison.locator("article").nth(1)).toContainText(
    secondAnswer,
  );
  await page.locator(".comparison-feedback > summary").focus();
  await page.keyboard.press("Enter");
  await expect(
    page
      .locator(".comparison-feedback")
      .getByText("Describe a specific outcome."),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  expect(
    await page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
      }),
    ),
  ).not.toContain(answer);
  await page.getByRole("button", { name: "End session", exact: true }).click();
  await expect(page.getByLabel("What should we call you?")).toHaveValue("");
  await expect(comparison).toHaveCount(0);
  expect(await page.locator("body").innerText()).not.toContain(secondAnswer);
  expect(await page.locator("body").innerText()).not.toContain(answer);
});

test("the latest feedback goal follows the same question and clears for a new topic", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepare(page);
  const goals = {
    pre: "Explain the result of your actions.",
    post: "Describe what changed for the people involved.",
    practice: "Name the feedback you heard afterward.",
  };
  await page.route("**/api/interview/evaluate", (route) => {
    const body = route.request().postDataJSON() as {
      stage: keyof typeof goals;
    };
    return route.fulfill({
      json: {
        evaluation: { ...evaluation, improvementArea: goals[body.stage] },
        ...(body.stage === "post"
          ? {
              comparison: {
                improvements: ["Your task was clear.", "You named an action."],
                nextStep: goals.post,
              },
            }
          : {}),
      },
    });
  });
  const focus = page.getByRole("region", { name: "Your focus for this take" });
  await expect(focus).toHaveCount(0);
  await reachLesson(page);
  await page.getByRole("button", { name: /Try again with STAR/ }).click();
  await expect(focus).toContainText(goals.pre);
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  await expect(focus).toContainText(goals.pre);
  await enterScene(page);
  await expect(focus).toContainText(goals.pre);
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations.map((violation) => violation.id)).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await submitAnswer(page);
  await page
    .getByRole("button", { name: "Retry this question", exact: true })
    .click();
  await expect(focus).toContainText(goals.post);
  await enterScene(page);
  await expect(focus).toContainText(goals.post);
  await submitAnswer(page);
  await page
    .getByRole("button", { name: "Retry this question", exact: true })
    .click();
  await expect(focus).toContainText(goals.practice);
  await enterScene(page);
  await expect(focus).toContainText(goals.practice);
  await submitAnswer(page);
  await page
    .getByRole("button", { name: "Try a New Question", exact: true })
    .click();
  await expect(focus).toHaveCount(0);
  await enterScene(page);
  await expect(focus).toHaveCount(0);
});

test("feedback recommends a targeted topic and reports lower retry scores honestly", async ({
  page,
}) => {
  test.setTimeout(60000);
  const submissions = await prepare(page);
  await page
    .getByLabel("Choose a practice question · 10 in your strand")
    .selectOption({ label: "1. Teamwork" });
  await reachLesson(page);
  await page.getByRole("button", { name: /Try again with STAR/ }).click();
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  await enterScene(page);
  await submitAnswer(page);
  await expect(
    page.getByRole("heading", { name: "Same score. A clearer next step." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Finish with an outcome" }),
  ).toBeVisible();
  await expect(page.locator(".recommended-practice")).toContainText(
    "practices result.",
  );
  await page.getByRole("button", { name: "Practice this skill" }).click();
  await enterScene(page);
  await expect(page.locator(".question")).toContainText(
    "accomplishment you are proud of",
  );
  await submitAnswer(page);
  await expect(
    page.getByRole("heading", { name: "Your practice results." }),
  ).toBeVisible();
  expect(submissions.at(-1)?.questionId).toBe("education-achievement-v1");
  await page.getByRole("button", { name: "Retry this question" }).click();
  await expect(
    page.getByText("ANOTHER TAKE · THE SAME QUESTION"),
  ).toBeVisible();
  await enterScene(page);
  await page.route("**/api/interview/evaluate", (route) =>
    route.fulfill({
      json: {
        evaluation: {
          ...evaluation,
          scores: { ...evaluation.scores, action: 1 },
          total: 6,
        },
      },
    }),
  );
  await submitAnswer(page);
  const growth = page.getByRole("region", { name: "Growth on this question" });
  await expect(growth).toContainText("latest response scored lower");
  await expect(growth).toContainText(
    "Based on 2 comparable scored responses to this question",
  );
  await expect(growth).toContainText("-1");
  await page
    .getByText("Review the answer you submitted", { exact: true })
    .click();
  await expect(page.locator(".answer-review")).toContainText(answer);
  await page
    .getByText("Make a quick improvement plan", { exact: false })
    .click();
  const privateReflection = "PRIVATE REFLECTION 5628 — add the real outcome";
  await page
    .getByLabel("What will you change in your next answer?")
    .fill(privateReflection);
  await page.getByRole("button", { name: "Continue to completion" }).click();
  const filePromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my practice plan" }).click();
  const download = await filePromise;
  expect(download.suggestedFilename()).toBe(
    "ignite-my-interview-practice-plan.txt",
  );
  const file = await download.path();
  expect(file).toBeTruthy();
  const contents = await readFile(file!, "utf8");
  expect(contents).toContain("MY NEXT PRACTICE GOAL");
  expect(contents).toContain("7/12 → 6/12");
  expect(contents).toContain("not a prediction of hiring success");
  expect(contents).not.toContain("Studio Student");
  expect(contents).not.toContain(answer);
  expect(contents).not.toContain(privateReflection);
});

test("story notes survive the coached retry but never enter requests or browser storage", async ({
  page,
}) => {
  const submissions = await prepare(page);
  await reachLesson(page);
  const privateNote = "PRIVATE STORY SKETCH 7381 — just my practice notes";
  await page.locator(".story-planner summary").click();
  await page.locator("#story-S").fill(privateNote);
  await page.getByRole("button", { name: /Try again with STAR/ }).click();
  await page.locator(".story-notes-panel summary").click();
  await expect(page.getByText(privateNote, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  await enterScene(page);
  await page.locator(".story-notes-panel summary").click();
  await expect(page.getByText(privateNote, { exact: true })).toBeVisible();
  await submitAnswer(page);
  await expect(
    page.getByRole("button", { name: "Try a New Interview Question" }),
  ).toBeVisible();
  expect(JSON.stringify(submissions)).not.toContain(privateNote);
  const storage = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }),
  );
  expect(storage).not.toContain(privateNote);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Meet your interviewer" }),
  ).toBeVisible();
  await expect(page.getByText(privateNote, { exact: true })).toHaveCount(0);
});

test("optional browser storage failure does not block a recovered interview", async ({
  page,
}) => {
  await page.addInitScript(() => {
    for (const method of ["getItem", "setItem", "removeItem"] as const)
      Storage.prototype[method] = () => {
        throw new DOMException(
          "Browser storage is unavailable",
          "SecurityError",
        );
      };
  });
  await prepare(page);
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  await enterScene(page);
  await submitAnswer(page);
  await expect(
    page.getByRole("button", { name: /Discover the STAR method/ }),
  ).toBeVisible();
});

test("long feedback tokens stay within the mobile review and lesson", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await prepare(page, "technology", {
    ...evaluation,
    strongestPart: "SpecificIdentifier".repeat(30),
    improvementArea: "AddOutcome".repeat(30),
  });
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  await enterScene(page);
  await submitAnswer(page);
  const lesson = page.getByRole("button", { name: /Discover the STAR method/ });
  await expect(lesson).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await lesson.click();
  await expect(
    page.getByRole("button", { name: /Try again with STAR/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

for (const width of [320, 390, 768]) {
  test(`studio flow remains accessible at ${width}px with reduced motion`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await prepare(page);
    const audit = async (screen: string) => {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${screen} has horizontal overflow at ${width}px`,
      ).toBe(true);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
        screen,
      ).toEqual([]);
    };
    await audit("library");
    await page.getByRole("button", { name: "Meet your interviewer" }).click();
    await audit("scene");
    await enterScene(page);
    await audit("question");
    await submitAnswer(page);
    await expect(
      page.getByRole("button", { name: /Discover the STAR method/ }),
    ).toBeVisible();
    await audit("feedback");
    await page
      .getByRole("button", { name: /Discover the STAR method/ })
      .click();
    await audit("STAR lesson");
    await page.locator(".example-card > summary").focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", {
        name: "A story you can follow",
        exact: true,
      }),
    ).toBeVisible();
    await audit("STAR example");
    await page.getByRole("button", { name: /Try again with STAR/ }).click();
    await audit("retry preparation");
  });
}

for (const operation of ["register", "reset"] as const) {
  test(`a stale profile response cannot overwrite ${operation}`, async ({
    page,
  }) => {
    await mockStudentAuth(page);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/profile", async (route) => {
      if (route.request().method() === "POST")
        return route.fulfill({
          headers: {
            "X-Student-Session": "11111111-1111-4111-8111-111111111111",
          },
          json: route.request().postDataJSON(),
        });
      await pending;
      return route.fulfill({
        headers: {
          "X-Student-Session": "11111111-1111-4111-8111-111111111111",
        },
        json: {
          name: "Previous Student",
          strand: "technology",
          ignite_year: 2,
        },
      });
    });
    await page.goto("/interview");
    await registerStudent(page);
    await expect(
      page.getByRole("heading", { name: "Ready, New Student?" }),
    ).toBeVisible();
    if (operation === "reset") {
      await page.getByRole("button", { name: "End session" }).click();
      await expect(page.getByLabel("What should we call you?")).toHaveValue("");
    }
    const response = page.waitForResponse(
      (r) => r.url().endsWith("/api/profile") && r.request().method() === "GET",
    );
    release();
    await (await response).finished();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(
      page.getByText("Previous Student", { exact: false }),
    ).toHaveCount(0);
    if (operation === "reset")
      await expect(page.getByLabel("What should we call you?")).toHaveValue("");
    else
      await expect(
        page.getByRole("heading", { name: "Ready, New Student?" }),
      ).toBeVisible();
  });
}

test("failed shared-device signout blocks new anonymous signup", async ({
  page,
  context,
}) => {
  const session = {
    access_token: "test-access-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "test-refresh",
    user: syntheticUser,
  };
  await context.addCookies([
    {
      name: "sb-test-auth-token",
      value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
      url: "http://localhost:3100",
    },
  ]);
  let signups = 0;
  let signouts = 0;
  await page.route("**/api/profile", (r) =>
    r.fulfill({
      headers: { "X-Student-Session": "11111111-1111-4111-8111-111111111111" },
      json: null,
    }),
  );
  await page.route("**/auth/v1/**", (route) => {
    const url = route.request().url();
    if (url.includes("signup")) {
      signups++;
      return route.fulfill({
        status: 500,
        json: { error: "Unexpected signup" },
      });
    }
    if (url.includes("logout")) {
      signouts++;
      return route.fulfill({
        status: 503,
        json: { message: "Signout unavailable" },
      });
    }
    return route.fulfill({ json: syntheticUser });
  });
  await page.goto("/interview");
  await registerStudent(page);
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "previous session could not be ended" }),
  ).toBeVisible();
  expect(signouts).toBeGreaterThan(0);
  expect(signups).toBe(0);
  await expect(page.getByLabel("What should we call you?")).toHaveValue(
    "New Student",
  );
});

test("orbital experience respects reduced motion and scrolling remains native", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".orbital-hero")).toHaveAttribute(
    "data-motion",
    "paused",
  );
  await expect(
    page.getByRole("button", { name: "Reduced motion on" }),
  ).toBeDisabled();
  await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await expect(page.locator(".orbital-hero")).toHaveAttribute(
    "data-motion",
    "paused",
  );
  await expect(
    page.getByRole("link", { name: "Start Student Interview" }),
  ).toHaveAttribute("href", "/interview");
});

test("orbital page retains navigation when WebGL is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      if (String(args[0]).includes("webgl")) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto("/");
  await expect(page.locator(".orbital-moon-fallback")).toBeVisible();
  await expect(page.locator(".orbital-world-ready")).toHaveCount(0);
  await page.getByRole("link", { name: "Start Student Interview" }).click();
  await expect(page.getByLabel("What should we call you?")).toBeVisible();
});

test("scene film plays real local media with pause and replay controls", async ({
  page,
}) => {
  await prepare(page, "technology");
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  const film = page.locator("video.scene-film-video");
  await expect(
    page.getByRole("button", { name: "Pause scene film" }),
  ).toBeVisible();
  await expect
    .poll(() => film.evaluate((element: HTMLVideoElement) => element.duration))
    .toBeGreaterThan(10);
  await expect
    .poll(() =>
      film.evaluate((element: HTMLVideoElement) => element.currentTime),
    )
    .toBeGreaterThan(0);
  await expect(film).toHaveJSProperty("muted", true);
  await expect(film).toHaveJSProperty("controls", true);
  await page.getByRole("button", { name: "Pause scene film" }).click();
  await expect(film).toHaveJSProperty("paused", true);
  await page
    .getByRole("button", { name: "Play scene film", exact: true })
    .click();
  await film.evaluate((element: HTMLVideoElement) => {
    element.currentTime = element.duration - 0.1;
  });
  await expect(
    page.getByRole("button", { name: "Replay scene film" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "I’m ready — ask the question" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Replay scene film" }).click();
  await expect(film).toHaveJSProperty("paused", false);
  await expect(page.locator(".scene-film-caption small")).toHaveText(
    "Step inside",
  );
  await expect
    .poll(() =>
      film.evaluate((element: HTMLVideoElement) => element.currentTime),
    )
    .toBeLessThan(5);
  await page
    .getByRole("button", { name: "I’m ready — ask the question" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(film).toHaveCount(0);
});

test("a decoded terminal clock offers replay even without a native ended event", async ({
  page,
}) => {
  await prepare(page, "technology");
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  const film = page.locator("video.scene-film-video");
  await expect
    .poll(() =>
      film.evaluate((element: HTMLVideoElement) => element.currentTime),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause scene film" }).click();
  await expect(film).toHaveJSProperty("paused", true);
  await expect(film).toHaveJSProperty("ended", false);
  // Reproduce WebKit's observed final clock: duration minus one nanosecond,
  // decoded and not seeking, but no native ended event. Keep real media for
  // initial playback and replay; override only this terminal-event snapshot.
  await film.evaluate((element: HTMLVideoElement) => {
    Object.defineProperty(element, "currentTime", {
      configurable: true,
      get: () => element.duration - 0.000000001,
    });
    element.dispatchEvent(new Event("timeupdate"));
  });
  const replay = page.getByRole("button", { name: "Replay scene film" });
  await expect(replay).toBeVisible();
  for (const event of ["play", "playing", "waiting", "timeupdate"] as const) {
    await film.evaluate((element, type) => {
      element.dispatchEvent(new Event(type));
    }, event);
    await expect(replay).toBeVisible();
  }
  await film.evaluate((element) => {
    Reflect.deleteProperty(element, "currentTime");
  });
  await replay.click();
  await expect(film).toHaveJSProperty("paused", false);
  await expect
    .poll(() =>
      film.evaluate((element: HTMLVideoElement) => element.currentTime),
    )
    .toBeLessThan(5);
  await expect(page.locator(".scene-film-caption small")).toHaveText(
    "Step inside",
  );
});

test("pausing a loading scene cancels pending autoplay and explicit play still works", async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/films/technology.mp4", async (route) => {
    await pending;
    await route.continue();
  });
  await prepare(page, "technology");
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  const film = page.locator("video.scene-film-video");
  try {
    await page.getByRole("button", { name: "Pause scene film" }).click();
    await expect(film).toHaveJSProperty("paused", true);
  } finally {
    release();
  }
  await expect
    .poll(() => film.evaluate((element: HTMLVideoElement) => element.duration))
    .toBeGreaterThan(10);
  await page.waitForTimeout(400);
  await expect(film).toHaveJSProperty("paused", true);
  await expect(film).toHaveJSProperty("currentTime", 0);
  await page
    .getByRole("button", { name: "Play scene film", exact: true })
    .click();
  await expect
    .poll(() =>
      film.evaluate((element: HTMLVideoElement) => element.currentTime),
    )
    .toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "I’m ready — ask the question" })
    .click();
  await expect(film).toHaveCount(0);
});

test("reduced-motion scene stays paused and never gates the question", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepare(page, "technology");
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  const film = page.locator("video.scene-film-video");
  await expect(film).toHaveJSProperty("paused", true);
  await expect(film).toHaveJSProperty("currentTime", 0);
  await expect(
    page.getByRole("button", { name: "Play scene film", exact: true }),
  ).toBeVisible();
  await enterScene(page);
  await expect(
    page.getByRole("button", { name: "Type my answer" }),
  ).toBeVisible();
});

test("failed scene media preserves the written setting and question access", async ({
  page,
}) => {
  test.setTimeout(45000);
  let mediaFails = true;
  await page.route("**/films/*.mp4", (route) =>
    mediaFails ? route.fulfill({ status: 503 }) : route.continue(),
  );
  await prepare(page, "technology");
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  await expect(
    page.getByText("Scene unavailable. Your written scene is ready."),
    // Some WebKit media failures emit no error event; the 15-second recovery
    // timeout must still expose Retry while the interview remains available.
  ).toBeVisible({ timeout: 20000 });
  await expect(page.locator(".scene-opening")).not.toBeEmpty();
  await expect(
    page.getByRole("button", { name: "I’m ready — ask the question" }),
  ).toBeEnabled();
  mediaFails = false;
  await page.getByRole("button", { name: "Retry scene film" }).click();
  await expect(
    page.getByRole("button", { name: "Pause scene film" }),
  ).toBeVisible();
  const film = page.locator("video.scene-film-video");
  await expect
    .poll(() => film.evaluate((element: HTMLVideoElement) => element.duration))
    .toBeGreaterThan(10);
  await expect
    .poll(() =>
      film.evaluate((element: HTMLVideoElement) => element.currentTime),
    )
    .toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "I’m ready — ask the question" })
    .click();
  await expect(
    page.getByRole("button", { name: "Type my answer" }),
  ).toBeVisible();
});

test("a stalled scene offers recovery without delaying the interview", async ({
  page,
}) => {
  await page.clock.install();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/films/*.mp4", async (route) => {
    await pending;
    await route.abort().catch(() => {});
  });
  try {
    await prepare(page, "technology");
    await page.getByRole("button", { name: "Meet your interviewer" }).click();
    await expect(
      page.getByText("Loading scene. You can continue."),
    ).toBeVisible();
    await page.clock.fastForward(16000);
    await expect(
      page.getByRole("button", { name: "Retry scene film" }),
    ).toBeVisible();
    await expect(
      page.getByText("Scene unavailable. Your written scene is ready."),
    ).toBeVisible();
    await enterScene(page);
    await expect(
      page.getByRole("button", { name: "Type my answer" }),
    ).toBeVisible();
  } finally {
    release();
  }
});
