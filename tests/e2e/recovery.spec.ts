import { expect, test, type Page } from "@playwright/test";
const answer =
  "Our school project fell behind. I organized the work and tested it. We finished on time.";
const evaluation = {
  scores: {
    situationTask: 2,
    personalActions: 2,
    resultImpact: 2,
    professionalCommunication: 2,
  },
  total: 8,
  strongestPart: "You explained your action.",
  improvementArea: "State your responsibility.",
};
async function enter(page: Page) {
  await page.route("**/api/profile", (r) =>
    r.fulfill({
      json: { name: "Recovery Student", strand: "technology", ignite_year: 1 },
    }),
  );
  await page.goto("/interview");
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
}
async function typed(page: Page) {
  await page.getByRole("button", { name: "Type my answer" }).click();
  await page.getByLabel("Your answer", { exact: true }).fill(answer);
}
async function finish(page: Page) {
  await page
    .getByRole("button", { name: "I'm Finished", exact: true })
    .first()
    .click();
}
for (const kind of ["unavailable", "limited", "gateway", "network"]) {
  test(`typed answer survives ${kind} failure and retries once`, async ({
    page,
  }) => {
    let calls = 0;
    await page.route("**/api/interview/evaluate", async (r) => {
      calls++;
      if (calls === 1) {
        if (kind === "network") return r.abort("internetdisconnected");
        if (kind === "gateway")
          return r.fulfill({
            status: 502,
            contentType: "text/html",
            body: "Bad Gateway",
          });
        return r.fulfill({
          status: kind === "limited" ? 429 : 503,
          json: { error: "Please wait a moment and try again." },
        });
      }
      return r.fulfill({ json: { evaluation } });
    });
    await enter(page);
    await typed(page);
    await finish(page);
    await expect(page.locator("p[role=alert]")).toBeVisible();
    await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(
      answer,
    );
    await expect(
      page.getByRole("button", { name: "I'm Finished", exact: true }),
    ).toBeEnabled();
    await finish(page);
    await expect(
      page.getByRole("heading", { name: "Your starting point." }),
    ).toBeVisible();
    expect(calls).toBe(2);
    expect(
      await page.evaluate(() =>
        Object.values(sessionStorage).some((v) =>
          v.includes("Our school project"),
        ),
      ),
    ).toBe(false);
  });
}
test("post and transfer evaluation failures preserve current answer and stage", async ({
  page,
}) => {
  let postCalls = 0;
  let transferCalls = 0;
  await page.route("**/api/interview/evaluate", (r) => {
    const post = r.request().postDataJSON().stage === "post";
    if (post && ++postCalls === 1)
      return r.fulfill({ status: 503, json: { error: "Please try again." } });
    return r.fulfill({
      json: {
        evaluation,
        ...(post
          ? {
              comparison: {
                improvements: ["Clearer action.", "Outcome present."],
                nextStep: "Add detail.",
              },
            }
          : {}),
      },
    });
  });
  await page.route("**/api/interview/transfer-question", (r) =>
    r.fulfill({
      json: {
        question:
          "Tell me about a time you helped your team solve a difficult problem.",
      },
    }),
  );
  await page.route("**/api/interview/transfer-evaluate", (r) =>
    ++transferCalls === 1
      ? r.fulfill({ status: 503, json: { error: "Please try again." } })
      : r.fulfill({
          json: {
            situation: true,
            task: true,
            action: true,
            result: true,
            observation: "All components present.",
          },
        }),
  );
  await enter(page);
  await typed(page);
  await finish(page);
  await page.getByRole("button", { name: "Discover the STAR method" }).click();
  await page.getByRole("button", { name: /I understand STAR/ }).click();
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  await typed(page);
  await finish(page);
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(
    answer,
  );
  await expect(
    page.getByText("POST-ASSESSMENT", { exact: true }),
  ).toBeVisible();
  await finish(page);
  await page
    .getByRole("button", { name: "Try a New Interview Question" })
    .click();
  await typed(page);
  await finish(page);
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(
    answer,
  );
  await finish(page);
  await expect(
    page.getByRole("heading", { name: "Interview Practice Complete" }),
  ).toBeVisible();
  expect(postCalls).toBe(2);
  expect(transferCalls).toBe(2);
});
test("transcription failure offers typed recovery", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  await page.route("**/api/transcribe", (r) =>
    r.fulfill({
      status: 503,
      json: {
        error:
          "We couldn't transcribe your recording. Please record again or type your answer.",
      },
    }),
  );
  await page.route("**/api/interview/evaluate", (r) =>
    r.fulfill({ json: { evaluation } }),
  );
  await enter(page);
  await page
    .getByRole("button", { name: "Begin Answer", exact: true })
    .first()
    .click();
  await expect(page.getByRole("status")).toContainText("Recording");
  await page.waitForTimeout(1100);
  await finish(page);
  await expect(page.getByLabel("Your answer", { exact: true })).toBeVisible();
  await expect(page.locator("p[role=alert]")).toContainText("transcribe");
  await page.getByLabel("Your answer", { exact: true }).fill(answer);
  await finish(page);
  await expect(
    page.getByRole("heading", { name: "Your starting point." }),
  ).toBeVisible();
});
test("successful transcription survives failed evaluation without rerecording", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  let transcriptions = 0;
  let evaluations = 0;
  await page.route("**/api/transcribe", (r) => {
    transcriptions++;
    return r.fulfill({ json: { transcript: answer } });
  });
  await page.route("**/api/interview/evaluate", (r) =>
    ++evaluations === 1
      ? r.fulfill({
          status: 503,
          json: { error: "Review unavailable. Please try again." },
        })
      : r.fulfill({ json: { evaluation } }),
  );
  await enter(page);
  await page
    .getByRole("button", { name: "Begin Answer", exact: true })
    .first()
    .click();
  await expect(page.getByRole("status")).toContainText("Recording");
  await page.waitForTimeout(1100);
  await finish(page);
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(
    answer,
  );
  await finish(page);
  await expect(
    page.getByRole("heading", { name: "Your starting point." }),
  ).toBeVisible();
  expect(transcriptions).toBe(1);
  expect(evaluations).toBe(2);
});
test("microphone permission pending blocks duplicate starts and allows typed fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => new Promise(() => {});
  });
  await enter(page);
  await page
    .getByRole("button", { name: "Begin Answer", exact: true })
    .first()
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Waiting for microphone permission",
  );
  await expect(
    page.getByRole("button", { name: "Begin Answer", exact: true }).first(),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Type my answer" }).click();
  await expect(page.getByLabel("Your answer", { exact: true })).toBeVisible();
});
test("slow evaluation disables duplicate submissions and preserves answer", async ({
  page,
}) => {
  let calls = 0;
  let release: () => void = () => {};
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/interview/evaluate", async (r) => {
    calls++;
    await wait;
    await r.fulfill({ json: { evaluation } });
  });
  await enter(page);
  await typed(page);
  await finish(page);
  await expect(page.getByRole("status")).toContainText("Reviewing");
  await expect(
    page.getByRole("button", { name: "I'm Finished", exact: true }),
  ).toBeDisabled();
  expect(calls).toBe(1);
  release();
  await expect(
    page.getByRole("heading", { name: "Your starting point." }),
  ).toBeVisible();
});

test("late microphone permission after typed fallback releases its tracks", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return stream;
    };
  });
  await enter(page);
  await page
    .getByRole("button", { name: "Begin Answer", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Type my answer" }).click();
  await page.getByLabel("Your answer", { exact: true }).fill(answer);
  await page.waitForTimeout(1400);
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(
    answer,
  );
  await expect(page.getByRole("status")).toHaveText("Ready when you are.");
  await expect(
    page.getByRole("button", { name: "Begin Answer", exact: true }),
  ).toHaveCount(0);
});
