import { test, expect } from "@playwright/test";
const pre = {
  scores: {
    situationTask: 2,
    personalActions: 2,
    resultImpact: 2,
    professionalCommunication: 2,
  },
  total: 8,
  strongestPart: "Clear actions.",
  improvementArea: "State the outcome.",
};
test("selected bank question stays identical through pre and post, then another round retains the student", async ({
  page,
}) => {
  await page.route("**/api/profile", (route) =>
    route.fulfill({
      json: { name: "Practice Student", strand: "technology", ignite_year: 1 },
    }),
  );
  const submissions: Record<string, unknown>[] = [];
  await page.route("**/api/interview/evaluate", (route) => {
    const body = route.request().postDataJSON();
    submissions.push(body);
    return route.fulfill({
      json: {
        evaluation: pre,
        ...(body.stage === "post"
          ? {
              comparison: {
                improvements: ["Clearer responsibility.", "Stronger outcome."],
                nextStep: "Be specific.",
              },
            }
          : {}),
      },
    });
  });
  await page.route("**/api/interview/transfer-question", (route) => {
    expect(route.request().postDataJSON().questionId).toBe(
      "technology-teamwork-v1",
    );
    return route.fulfill({
      json: {
        question:
          "Tell me about a time you learned a new technical skill quickly.",
        questionId: "technology-learning-v1",
      },
    });
  });
  await page.route("**/api/interview/transfer-evaluate", (route) =>
    route.fulfill({
      json: {
        situation: true,
        task: true,
        action: true,
        result: true,
        observation: "All components were present.",
      },
    }),
  );
  await page.goto("/interview");
  const select = page.getByLabel(
    "Choose a practice question · 10 in your strand",
  );
  await expect(select.locator("option")).toHaveCount(10);
  await select.selectOption("technology-teamwork-v1");
  const selectedText = await page.locator(".question-preview").innerText();
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  await expect(page.locator(".question")).toContainText(
    selectedText.replace(/[“”]/g, ""),
  );
  await page.getByRole("button", { name: "Type my answer" }).click();
  await page
    .getByLabel("Your answer", { exact: true })
    .fill("I worked with my team and organized our technology project.");
  await page.getByRole("button", { name: "I'm Finished", exact: true }).click();
  await page.getByRole("button", { name: /Discover the STAR method/ }).click();
  await page.getByRole("button", { name: /I understand STAR/ }).click();
  await expect(select).toHaveCount(0);
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  await expect(page.locator(".question")).toContainText(
    selectedText.replace(/[“”]/g, ""),
  );
  await page.getByRole("button", { name: "Type my answer" }).click();
  await page
    .getByLabel("Your answer", { exact: true })
    .fill(
      "I organized tasks, tested the project, and our team completed it on time.",
    );
  await page.getByRole("button", { name: "I'm Finished", exact: true }).click();
  expect(submissions).toHaveLength(2);
  expect(submissions.map((s) => s.questionId)).toEqual([
    "technology-teamwork-v1",
    "technology-teamwork-v1",
  ]);
  expect(submissions[1].preRequestId).toBe(submissions[0].requestId);
  await page
    .getByRole("button", { name: "Try a New Interview Question" })
    .click();
  await page.getByRole("button", { name: "Type my answer" }).click();
  await page
    .getByLabel("Your answer", { exact: true })
    .fill("I learned a new tool, practiced using it, and finished my project.");
  await page.getByRole("button", { name: "I'm Finished", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your practice results." }),
  ).toBeVisible();
  expect(submissions[2].stage).toBe("practice");
  expect(submissions[2].questionId).toBe("technology-challenge-v1");
  await expect(page.getByText("Clear actions.")).toBeVisible();
  // More than ten rounds proves the bank wraps without restarting onboarding.
  for (let round = 0; round < 12; round++) {
    await page
      .getByRole("button", { name: "Try a New Question", exact: true })
      .click();
    await page.getByRole("button", { name: "Type my answer" }).click();
    await page
      .getByLabel("Your answer", { exact: true })
      .fill(
        `Practice answer ${round}: I organized my team and we completed our project.`,
      );
    await page
      .getByRole("button", { name: "I'm Finished", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your practice results." }),
    ).toBeVisible();
  }
  expect(new Set(submissions.slice(2).map((s) => s.questionId)).size).toBe(10);
  expect(new Set(submissions.map((s) => s.requestId)).size).toBe(
    submissions.length,
  );
  const previousQuestion = submissions.at(-1)?.questionId;
  await page.getByRole("button", { name: "Retry this question" }).click();
  await page.getByRole("button", { name: "Type my answer" }).click();
  await page
    .getByLabel("Your answer", { exact: true })
    .fill("An improved answer for this same question.");
  await page.getByRole("button", { name: "I'm Finished", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your practice results." }),
  ).toBeVisible();
  expect(submissions.at(-1)?.questionId).toBe(previousQuestion);
  expect(submissions.at(-1)?.requestId).not.toBe(submissions.at(-2)?.requestId);
});
test("all ten strand banks have ten questions in the ready screen", async ({
  page,
}) => {
  for (const strand of [
    "technology",
    "health-sciences",
    "law-public-policy",
    "aviation",
    "culinary",
    "engineering",
    "construction",
    "education",
    "business",
    "digital-media",
  ]) {
    await page.route("**/api/profile", (route) =>
      route.fulfill({ json: { name: "Bank Student", strand, ignite_year: 1 } }),
    );
    await page.goto("/interview");
    await expect(
      page
        .getByLabel("Choose a practice question · 10 in your strand")
        .locator("option"),
    ).toHaveCount(10);
    await page.unroute("**/api/profile");
  }
});
