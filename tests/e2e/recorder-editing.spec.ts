import { expect, test, type Page } from "@playwright/test";

type EditRecorderHarness = {
  tracks: { readyState: string; stop: () => void }[];
  starts: number;
  aborts: number;
  clipBytes: number;
  supportedMime: string;
  endDevice: (() => void) | null;
};
declare global {
  interface Window {
    recorderEditHarness: EditRecorderHarness;
  }
}
const original = "Our class website needed a clearer navigation menu.";
const addition = "I grouped the links and checked them with a classmate.";
const evaluation = {
  scores: { situation: 2, task: 2, action: 2, result: 2 },
  total: 8,
  strongestPart: "Your own action is clear.",
  improvementArea: "Explain the observed result.",
};

async function prepare(page: Page) {
  await page.addInitScript(() => {
    const state: EditRecorderHarness = {
      tracks: [],
      starts: 0,
      aborts: 0,
      clipBytes: 256,
      supportedMime: "audio/webm",
      endDevice: null,
    };
    window.recorderEditHarness = state;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const events = new EventTarget();
          const track = {
            readyState: "live",
            stop() {
              this.readyState = "ended";
            },
            addEventListener: events.addEventListener.bind(events),
            removeEventListener: events.removeEventListener.bind(events),
          };
          state.tracks.push(track);
          state.endDevice = () => {
            track.readyState = "ended";
            events.dispatchEvent(new Event("ended"));
          };
          return { getTracks: () => [track] };
        },
      },
    });
    class FakeMediaRecorder {
      static isTypeSupported(mime: string) {
        return mime.startsWith(state.supportedMime);
      }
      state = "inactive";
      mimeType: string;
      constructor(_stream: unknown, options?: { mimeType?: string }) {
        this.mimeType = options?.mimeType ?? state.supportedMime;
      }
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;
      start() {
        this.state = "recording";
        state.starts++;
      }
      stop() {
        this.state = "inactive";
        const data = this.ondataavailable,
          stopped = this.onstop;
        queueMicrotask(() => {
          data?.({
            data: new Blob([new Uint8Array(state.clipBytes)], {
              type: this.mimeType,
            }),
          });
          stopped?.();
        });
      }
    }
    Object.defineProperty(window, "MediaRecorder", {
      value: FakeMediaRecorder,
      configurable: true,
    });
    const fetch = window.fetch;
    window.fetch = (input, options) => {
      if (String(input).includes("/api/transcribe"))
        options?.signal?.addEventListener(
          "abort",
          () => {
            state.aborts++;
          },
          { once: true },
        );
      return fetch(input, options);
    };
  });
  await page.route("**/api/profile", (route) =>
    route.fulfill({
      headers: { "X-Student-Session": "11111111-1111-4111-8111-111111111111" },
      json: {
        name: "Synthetic Voice Editor",
        strand: "technology",
        ignite_year: 1,
      },
    }),
  );
  const submissions: string[] = [];
  await page.route("**/api/interview/evaluate", (route) => {
    submissions.push(route.request().postDataJSON().transcript);
    return route.fulfill({ json: { evaluation } });
  });
  await page.goto("/interview");
  await page.getByRole("button", { name: "Meet your interviewer" }).click();
  await page
    .getByRole("button", { name: "I’m ready — ask the question" })
    .click();
  return submissions;
}
async function start(page: Page) {
  await page
    .getByRole("button", { name: "Begin Answer", exact: true })
    .first()
    .click();
}
async function stop(page: Page) {
  await page
    .getByRole("button", { name: "Stop and review", exact: true })
    .first()
    .click();
}
async function edit(page: Page, text = original) {
  await page.getByRole("button", { name: "Type my answer" }).click();
  await page.getByLabel("Your answer", { exact: true }).fill(text);
}
async function select(page: Page, start: number, end: number) {
  await page.getByLabel("Your answer", { exact: true }).evaluate(
    (element, range) => {
      const field = element as HTMLTextAreaElement;
      field.focus();
      field.setSelectionRange(range.start, range.end);
      field.dispatchEvent(
        new KeyboardEvent("keyup", { key: "Shift", bubbles: true }),
      );
    },
    { start, end },
  );
}
async function tracksEnded(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.recorderEditHarness.tracks.every(
          (track) => track.readyState === "ended",
        ),
      ),
    )
    .toBe(true);
}

test("stopping a clip opens editable text and never submits before explicit review", async ({
  page,
}) => {
  const submissions = await prepare(page);
  await page.route("**/api/transcribe", (route) =>
    route.fulfill({ json: { transcript: original } }),
  );
  await start(page);
  await stop(page);
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(
    original,
  );
  await tracksEnded(page);
  expect(submissions).toEqual([]);
  const revised = original + " I was responsible for the menu.";
  await page.getByLabel("Your answer", { exact: true }).fill(revised);
  await page.getByRole("button", { name: "I'm Finished", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your starting point." }),
  ).toBeVisible();
  expect(submissions).toEqual([revised]);
});

test("resuming appends separate clips after typed edits without duplicating earlier audio", async ({
  page,
}) => {
  const submissions = await prepare(page);
  const clips = [addition, "My classmate found the meeting page without help."];
  let uploads = 0;
  const clipIds: string[] = [];
  await page.route("**/api/transcribe", (route) => {
    clipIds.push(route.request().headers()["x-transcription-request"]);
    return route.fulfill({ json: { transcript: clips[uploads++] } });
  });
  await edit(page);
  await page
    .getByRole("button", { name: "Continue recording", exact: true })
    .click();
  await stop(page);
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(
    original + " " + addition,
  );
  const revised = original + " My task was to fix the links. " + addition;
  await page.getByLabel("Your answer", { exact: true }).fill(revised);
  await page
    .getByRole("button", { name: "Continue recording", exact: true })
    .click();
  await stop(page);
  const complete = revised + " " + clips[1];
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(
    complete,
  );
  expect(uploads).toBe(2);
  expect(clipIds).toHaveLength(2);
  expect(
    clipIds.every((id) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      ),
    ),
  ).toBe(true);
  expect(clipIds[0]).not.toBe(clipIds[1]);
  expect(submissions).toEqual([]);
  await tracksEnded(page);
  await page.getByRole("button", { name: "I'm Finished", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your starting point." }),
  ).toBeVisible();
  expect(submissions).toEqual([complete]);
});

test("a selected phrase can be replaced by a new voice clip", async ({
  page,
}) => {
  await prepare(page);
  await page.route("**/api/transcribe", (route) =>
    route.fulfill({ json: { transcript: "tested the links" } }),
  );
  await edit(page, "I helped our team.");
  await select(page, 2, 8);
  await expect(
    page.getByRole("button", { name: "Replace selection by voice" }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Replace selection by voice" })
    .click();
  await stop(page);
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(
    "I tested the links our team.",
  );
  await tracksEnded(page);
});

test("keyboard selection can replace only the selected words by voice", async ({
  page,
}) => {
  const submissions = await prepare(page);
  await page.route("**/api/transcribe", (route) =>
    route.fulfill({ json: { transcript: "tested" } }),
  );
  await edit(page, "I helped our team.");
  const answer = page.getByLabel("Your answer", { exact: true });
  await answer.press("Home");
  await answer.press("ArrowRight");
  await answer.press("ArrowRight");
  for (let index = 0; index < "helped".length; index++)
    await answer.press("Shift+ArrowRight");
  await expect
    .poll(() =>
      answer.evaluate((element) => {
        const field = element as HTMLTextAreaElement;
        return field.value.slice(field.selectionStart, field.selectionEnd);
      }),
    )
    .toBe("helped");
  await page
    .getByRole("button", { name: "Replace selection by voice" })
    .click();
  await stop(page);
  await expect(answer).toHaveValue("I tested our team.");
  await tracksEnded(page);
  expect(submissions).toEqual([]);
});

test("elapsed recording time does not change the live announcement", async ({
  page,
}) => {
  await prepare(page);
  await page.clock.install();
  await start(page);
  const status = page.locator(".record-status [role=status]");
  await expect(status).toHaveText("Recording");
  await page.clock.runFor(2100);
  await expect(page.locator(".record-status")).toContainText("0:02");
  await expect(status).toHaveText("Recording");
  const timer = page.getByRole("timer");
  await expect(timer).toContainText("0:02");
  await expect(timer).toHaveAttribute("aria-live", "off");
  await expect(timer).toHaveAccessibleName("Elapsed recording time: 0:02");
  await page
    .getByRole("button", { name: "Discard recording", exact: true })
    .click();
  await tracksEnded(page);
});

test("an MP4-only recorder uploads the selected container without mislabeling it", async ({
  page,
}) => {
  await prepare(page);
  await page.evaluate(() => {
    window.recorderEditHarness.supportedMime = "audio/mp4";
  });
  let uploaded = false;
  await page.route("**/api/transcribe", (route) => {
    const body = route.request().postDataBuffer()?.toString() ?? "";
    expect(body).toContain('filename="answer.mp4"');
    expect(body).toMatch(/content-type: audio\/mp4/i);
    uploaded = true;
    return route.fulfill({ json: { transcript: original } });
  });
  await start(page);
  await stop(page);
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(
    original,
  );
  expect(uploaded).toBe(true);
  await tracksEnded(page);
});

test("retrying failed transcription preserves later edits until deliberate placement", async ({
  page,
}) => {
  const submissions = await prepare(page);
  let uploads = 0;
  const clipIds: string[] = [];
  await page.route("**/api/transcribe", (route) => {
    clipIds.push(route.request().headers()["x-transcription-request"]);
    return ++uploads === 1
      ? route.fulfill({
          status: 503,
          json: { error: "Transcription unavailable. Retry shortly." },
        })
      : route.fulfill({ json: { transcript: addition } });
  });
  await edit(page);
  await page
    .getByRole("button", { name: "Continue recording", exact: true })
    .click();
  await stop(page);
  await expect(
    page.getByRole("button", { name: "Retry transcription" }),
  ).toBeVisible();
  const revised = "Edited while the clip was waiting: " + original;
  await page.getByLabel("Your answer", { exact: true }).fill(revised);
  await expect(
    page.getByRole("button", { name: "I'm Finished", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Retry transcription" }).click();
  await expect(page.getByLabel("Recorded text to add")).toHaveValue(addition);
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(
    revised,
  );
  await page.getByRole("button", { name: "Add to end", exact: true }).click();
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(
    revised + " " + addition,
  );
  expect(submissions).toEqual([]);
  expect(uploads).toBe(2);
  expect(clipIds[0]).toBeTruthy();
  expect(clipIds[1]).toBe(clipIds[0]);
});

test("canceling transcription ignores late words and keeps the editable draft", async ({
  page,
}) => {
  const submissions = await prepare(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let uploaded = false,
    returned = false;
  await page.route("**/api/transcribe", async (route) => {
    uploaded = true;
    await gate;
    await route.fulfill({ json: { transcript: addition } }).catch(() => {});
    returned = true;
  });
  await edit(page);
  await page
    .getByRole("button", { name: "Continue recording", exact: true })
    .click();
  await stop(page);
  await expect.poll(() => uploaded).toBe(true);
  await page.getByRole("button", { name: "Cancel transcription" }).click();
  const revised = "This edit must survive a late response.";
  await page.getByLabel("Your answer", { exact: true }).fill(revised);
  release();
  await expect.poll(() => returned).toBe(true);
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(
    revised,
  );
  expect(await page.evaluate(() => window.recorderEditHarness.aborts)).toBe(1);
  await page
    .getByRole("region", { name: "Pending recording" })
    .getByRole("button", { name: "Discard recording" })
    .click();
  await expect(
    page.getByRole("button", { name: "I'm Finished", exact: true }),
  ).toBeEnabled();
  expect(submissions).toEqual([]);
});

test("a full draft keeps all returned words and can add corrected cached text without another upload", async ({
  page,
}) => {
  await prepare(page);
  const spoken = "x".repeat(15995);
  let uploads = 0;
  await page.route("**/api/transcribe", (route) => {
    uploads++;
    return route.fulfill({ json: { transcript: spoken } });
  });
  await edit(page);
  await page
    .getByRole("button", { name: "Continue recording", exact: true })
    .click();
  await stop(page);
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(
    original,
  );
  await expect(page.getByLabel("Recorded text to add")).toHaveValue(spoken);
  await expect(
    page.getByRole("button", { name: "I'm Finished", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Recorded text to add")
    .fill("A shorter recorded result.");
  await page.getByRole("button", { name: "Add to end", exact: true }).click();
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(
    original + " A shorter recorded result.",
  );
  expect(uploads).toBe(1);
});

test("device disconnection releases tracks and preserves earlier text without an upload", async ({
  page,
}) => {
  await prepare(page);
  let uploads = 0;
  await page.route("**/api/transcribe", (route) => {
    uploads++;
    return route.abort();
  });
  await edit(page);
  await page
    .getByRole("button", { name: "Continue recording", exact: true })
    .click();
  await page.evaluate(() => window.recorderEditHarness.endDevice?.());
  await expect(page.locator(".answer-area [role=alert]")).toContainText(
    "Microphone disconnected",
  );
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(
    original,
  );
  await tracksEnded(page);
  expect(uploads).toBe(0);
});

test("an empty clip never overwrites an earlier draft or starts a review", async ({
  page,
}) => {
  const submissions = await prepare(page);
  let uploads = 0;
  await page.route("**/api/transcribe", (route) => {
    uploads++;
    return route.abort();
  });
  await edit(page);
  await page.evaluate(() => {
    window.recorderEditHarness.clipBytes = 0;
  });
  await page
    .getByRole("button", { name: "Continue recording", exact: true })
    .click();
  await stop(page);
  await expect(page.locator(".answer-area [role=alert]")).toContainText(
    "No recording captured",
  );
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(
    original,
  );
  expect(uploads).toBe(0);
  expect(submissions).toEqual([]);
});

test("cached voice replacement cannot overwrite a changed selection snapshot", async ({
  page,
}) => {
  await prepare(page);
  let uploads = 0;
  await page.route("**/api/transcribe", (route) =>
    ++uploads === 1
      ? route.fulfill({ status: 503, json: { error: "Retry the clip." } })
      : route.fulfill({ json: { transcript: "tested" } }),
  );
  await edit(page, "I helped the group.");
  await select(page, 2, 8);
  await page
    .getByRole("button", { name: "Replace selection by voice" })
    .click();
  await stop(page);
  await expect(
    page.getByRole("button", { name: "Retry transcription" }),
  ).toBeVisible();
  await page
    .getByLabel("Your answer", { exact: true })
    .fill("I reviewed the links carefully.");
  await page.getByRole("button", { name: "Retry transcription" }).click();
  await expect(page.getByLabel("Recorded text to add")).toHaveValue("tested");
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(
    "I reviewed the links carefully.",
  );
  await select(page, 2, 10);
  await page
    .getByRole("button", { name: "Replace selection", exact: true })
    .click();
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(
    "I tested the links carefully.",
  );
  expect(uploads).toBe(2);
});

test("capacity backoff can be canceled without a late retry or draft loss", async ({
  page,
}) => {
  const submissions = await prepare(page);
  let uploads = 0;
  await page.route("**/api/transcribe", (route) => {
    uploads++;
    return route.fulfill({
      status: 429,
      headers: { "Retry-After": "1" },
      json: { error: "Transcription is busy.", code: "AI_CAPACITY_BUSY" },
    });
  });
  await edit(page);
  await page
    .getByRole("button", { name: "Continue recording", exact: true })
    .click();
  await stop(page);
  await expect(page.locator(".record-status")).toContainText(
    "Retrying shortly",
  );
  await page.getByRole("button", { name: "Cancel transcription" }).click();
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(
    original,
  );
  await page.waitForTimeout(1600);
  expect(uploads).toBe(1);
  expect(submissions).toEqual([]);
  await tracksEnded(page);
});
