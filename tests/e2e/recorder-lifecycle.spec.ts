import { expect, test, type BrowserContext, type Page } from "@playwright/test";

type RecorderHarness = {
  tracks: { readyState: string; stop: () => void }[];
  starts: number;
  aborts: number;
  failStop: boolean;
  grant: (() => void) | null;
  emitError: (() => void) | null;
  emitOversize: (() => void) | null;
};
declare global {
  interface Window {
    recorderHarness: RecorderHarness;
  }
}
const answer =
  "I tested our project, found the missing connection, and helped our team finish on time.";
const evaluation = {
  scores: {
    situationTask: 2,
    personalActions: 2,
    resultImpact: 2,
    professionalCommunication: 2,
  },
  total: 8,
  strongestPart: "You described your own action.",
  improvementArea: "State your responsibility.",
};

async function fakeRecorder(page: Page, pendingPermission = false) {
  await page.addInitScript(
    ({ pendingPermission }) => {
      const state: RecorderHarness = {
        tracks: [],
        starts: 0,
        aborts: 0,
        failStop: false,
        grant: null,
        emitError: null,
        emitOversize: null,
      };
      window.recorderHarness = state;
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: () => {
            const track = {
              readyState: "live",
              stop() {
                this.readyState = "ended";
              },
            };
            state.tracks.push(track);
            const stream = { getTracks: () => [track] };
            return pendingPermission
              ? new Promise((resolve) => {
                  state.grant = () => resolve(stream);
                })
              : Promise.resolve(stream);
          },
        },
      });
      class FakeMediaRecorder {
        static isTypeSupported() {
          return true;
        }
        state = "inactive";
        mimeType = "audio/webm";
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onerror: (() => void) | null = null;
        onstop: (() => void) | null = null;
        start() {
          this.state = "recording";
          state.starts++;
          state.emitError = () => {
            // Replay a queued stop even after onerror detaches event handlers.
            const queuedStop = this.onstop;
            this.onerror?.();
            queuedStop?.();
          };
          state.emitOversize = () =>
            this.ondataavailable?.({
              data: new Blob([new Uint8Array(3_900_001)]),
            });
        }
        stop() {
          if (state.failStop) throw new Error("Recorder has failed");
          this.state = "inactive";
          const data = this.ondataavailable;
          const stop = this.onstop;
          queueMicrotask(() => {
            data?.({
              data: new Blob([new Uint8Array(256)], { type: this.mimeType }),
            });
            stop?.();
          });
        }
      }
      Object.defineProperty(window, "MediaRecorder", {
        value: FakeMediaRecorder,
        configurable: true,
      });
      const originalFetch = window.fetch;
      window.fetch = (input, options) => {
        if (String(input).includes("/api/transcribe")) {
          options?.signal?.addEventListener(
            "abort",
            () => {
              state.aborts++;
            },
            { once: true },
          );
        }
        return originalFetch(input, options);
      };
    },
    { pendingPermission },
  );
}
async function enter(page: Page) {
  await page.route("**/api/profile", (route) =>
    route.fulfill({
      headers: { "X-Student-Session": "11111111-1111-4111-8111-111111111111" },
      json: { name: "Recorder Student", strand: "technology", ignite_year: 1 },
    }),
  );
  await page.goto("/interview");
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  await page
    .getByRole("button", { name: "I’m ready — ask the question" })
    .click();
}
async function begin(page: Page) {
  await page
    .getByRole("button", { name: "Begin Answer", exact: true })
    .first()
    .click();
}
async function finish(page: Page) {
  await page
    .getByRole("button", { name: "I'm Finished", exact: true })
    .first()
    .click();
}
async function expectTracksEnded(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.recorderHarness.tracks.every(
          (track) => track.readyState === "ended",
        ),
      ),
    )
    .toBe(true);
}
async function seedSession(context: BrowserContext) {
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    aud: "authenticated",
    role: "authenticated",
    is_anonymous: true,
    created_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
  };
  const session = {
    access_token: "test-access-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "test-refresh",
    user,
  };
  await context.addCookies([
    {
      name: "sb-test-auth-token",
      value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
      url: "http://localhost:3100",
    },
  ]);
  return user;
}

test("discarding a recording releases tracks without uploading and allows a fresh take", async ({
  page,
}) => {
  await fakeRecorder(page);
  let uploads = 0;
  await page.route("**/api/transcribe", (route) => {
    uploads++;
    return route.fulfill({ json: { transcript: answer } });
  });
  await page.route("**/api/interview/evaluate", (route) =>
    route.fulfill({ json: { evaluation } }),
  );
  await enter(page);
  await begin(page);
  await expect(page.locator(".record-status")).toContainText("Recording");
  await page.getByRole("button", { name: "Discard recording" }).click();
  await expectTracksEnded(page);
  await expect(page.locator(".record-status")).toHaveText(
    "Ready when you are.",
  );
  expect(uploads).toBe(0);
  await begin(page);
  await finish(page);
  await expect(
    page.getByRole("heading", { name: "Your starting point." }),
  ).toBeVisible();
  await expectTracksEnded(page);
  expect(uploads).toBe(1);
});

test("recorder errors ignore queued stop events and preserve a typed draft", async ({
  page,
}) => {
  await fakeRecorder(page);
  let uploads = 0;
  await page.route("**/api/transcribe", (route) => {
    uploads++;
    return route.abort();
  });
  await enter(page);
  await page.getByRole("button", { name: "Type my answer" }).click();
  await page.getByLabel("Your answer", { exact: true }).fill(answer);
  await page.getByRole("button", { name: "Use microphone" }).click();
  await begin(page);
  await page.evaluate(() => window.recorderHarness.emitError?.());
  await expect(page.locator(".answer-area [role=alert]")).toContainText(
    "Recording failed",
  );
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(
    answer,
  );
  await expectTracksEnded(page);
  expect(uploads).toBe(0);
});

test("oversized capture stops before upload and releases its microphone", async ({
  page,
}) => {
  await fakeRecorder(page);
  let uploads = 0;
  await page.route("**/api/transcribe", (route) => {
    uploads++;
    return route.abort();
  });
  await enter(page);
  await begin(page);
  await page.evaluate(() => window.recorderHarness.emitOversize?.());
  await expect(page.locator(".answer-area [role=alert]")).toContainText(
    "upload limit",
  );
  await expect(page.getByLabel("Your answer", { exact: true })).toBeVisible();
  await expectTracksEnded(page);
  expect(uploads).toBe(0);
});

test("permission granted after session reset cannot start an old student's recorder", async ({
  page,
}) => {
  await fakeRecorder(page, true);
  await enter(page);
  await begin(page);
  await expect(page.locator(".record-status")).toContainText(
    "Waiting for microphone",
  );
  await page.getByRole("button", { name: "End session" }).click();
  await expect(page.getByLabel("What should we call you?")).toHaveValue("");
  await page.evaluate(() => window.recorderHarness.grant?.());
  await expectTracksEnded(page);
  expect(await page.evaluate(() => window.recorderHarness.starts)).toBe(0);
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveCount(0);
});

test("session reset releases the microphone even when recorder stop throws", async ({
  page,
}) => {
  await fakeRecorder(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await enter(page);
  await begin(page);
  await page.evaluate(() => {
    window.recorderHarness.failStop = true;
  });
  await page.getByRole("button", { name: "End session" }).click();
  await expect(page.getByLabel("What should we call you?")).toHaveValue("");
  await expectTracksEnded(page);
  expect(errors).toEqual([]);
});

test("session reset aborts pending transcription before signout resolves and never evaluates its late answer", async ({
  page,
  context,
}) => {
  await fakeRecorder(page);
  const user = await seedSession(context);
  let releaseLogout: () => void = () => {};
  const logoutGate = new Promise<void>((resolve) => {
    releaseLogout = resolve;
  });
  await page.route("**/auth/v1/**", async (route) => {
    if (route.request().url().includes("logout")) {
      await logoutGate;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ json: user });
  });
  let releaseTranscript: () => void = () => {};
  const transcriptGate = new Promise<void>((resolve) => {
    releaseTranscript = resolve;
  });
  let uploads = 0;
  let evaluations = 0;
  await page.route("**/api/transcribe", async (route) => {
    uploads++;
    await transcriptGate;
    await route.fulfill({ json: { transcript: answer } }).catch(() => {});
  });
  await page.route("**/api/interview/evaluate", (route) => {
    evaluations++;
    return route.fulfill({ json: { evaluation } });
  });
  await enter(page);
  await begin(page);
  await finish(page);
  await expect.poll(() => uploads).toBe(1);
  await expectTracksEnded(page);
  await page.getByRole("button", { name: "End session" }).click();
  await expect(
    page.getByText("Ending your session…", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.recorderHarness.aborts))
    .toBe(1);
  releaseTranscript();
  releaseLogout();
  await expect(page.getByLabel("What should we call you?")).toHaveValue("");
  expect(evaluations).toBe(0);
  await expect(page.getByText(answer, { exact: true })).toHaveCount(0);
});

test("read aloud explains unsupported audio and leaves the question available", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", {
      value: undefined,
      configurable: true,
    });
  });
  await enter(page);
  await page.getByRole("button", { name: "Read question aloud" }).click();
  await expect(
    page.getByText(
      "Read aloud is unavailable in this browser. The question is written above.",
    ),
  ).toBeVisible();
  await expect(page.locator("h1.question")).toBeVisible();
});

test("question read aloud can be stopped without starting a recording", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", {
      value: { cancel() {}, speak() {} },
      configurable: true,
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      value: class {
        constructor(public text: string) {}
      },
      configurable: true,
    });
  });
  await enter(page);
  await page.getByRole("button", { name: "Read question aloud" }).click();
  await expect(
    page.getByRole("button", { name: "Stop reading" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Stop reading" }).click();
  await expect(
    page.getByRole("button", { name: "Read question aloud" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".record-status")).toHaveText(
    "Ready when you are.",
  );
});
