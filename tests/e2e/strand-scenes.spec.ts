import { expect, test, type Locator } from "@playwright/test";
import { getStrand, strandIds } from "../../src/config/strands";

async function decodedFrame(film: Locator, time: number) {
  await film.evaluate((element: HTMLVideoElement, seconds) => {
    element.currentTime = seconds;
  }, time);
  await expect
    .poll(() =>
      film.evaluate(
        (element: HTMLVideoElement, target) =>
          !element.seeking &&
          element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          Math.abs(element.currentTime - target) < 0.1,
        time,
      ),
    )
    .toBe(true);
  return film.evaluate((element: HTMLVideoElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 36;
    const context = canvas.getContext("2d")!;
    context.drawImage(element, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    let light = 0;
    for (let i = 0; i < pixels.length; i++) {
      hash = Math.imul(hash ^ pixels[i], 16777619);
      if (i % 4 !== 3) light += pixels[i];
    }
    return {
      hash: hash >>> 0,
      meanLight: light / (canvas.width * canvas.height * 3),
    };
  });
}

test("all ten strand films decode, fit a narrow screen, and preserve interview access", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 320, height: 844 });
  let strand: (typeof strandIds)[number] = strandIds[0];
  await page.route("**/api/profile", (route) =>
    route.fulfill({
      headers: { "X-Student-Session": "11111111-1111-4111-8111-111111111111" },
      json: { name: "Scene review", strand, ignite_year: 1 },
    }),
  );
  // These scenes need no hosted identity, evaluation, or microphone.
  await page.route("**/auth/v1/**", (route) => route.fulfill({ status: 204 }));
  await page.route("**/api/interview/**", (route) => route.abort());
  const decodedRooms = new Set<number>();
  for (strand of strandIds) {
    await test.step(strand, async () => {
      await page.goto("/interview");
      const meet = page.getByRole("button", { name: "Meet your interviewer" });
      await expect(meet).toBeVisible();
      const questionId = await page
        .getByLabel("Choose a practice question · 10 in your strand")
        .inputValue();
      const question = getStrand(strand).questions.find(
        (item) => item.id === questionId,
      )!;
      await meet.click();
      const film = page.locator("video.scene-film-video");
      await expect(film).toHaveAttribute("src", `/films/${strand}.mp4`);
      await film.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          film.evaluate((element: HTMLVideoElement) => element.currentTime),
        )
        .toBeGreaterThan(0);
      await expect(film).toHaveJSProperty("muted", true);
      await expect(film).toHaveJSProperty("videoWidth", 960);
      await expect(film).toHaveJSProperty("videoHeight", 540);
      const geometry = await film.evaluate((element) => {
        const frame = element.parentElement!.getBoundingClientRect();
        return {
          ratio: frame.width / frame.height,
          fit: getComputedStyle(element).objectFit,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(
        geometry.ratio,
        `${strand}: whole 16:9 frame remains visible`,
      ).toBeCloseTo(16 / 9, 2);
      expect(geometry.fit).toBe("contain");
      expect(geometry.overflow).toBe(false);
      await page.getByRole("button", { name: "Pause scene film" }).click();
      await expect(film).toHaveJSProperty("paused", true);
      const entering = await decodedFrame(film, 3.5);
      const approaching = await decodedFrame(film, 9);
      expect(
        entering.meanLight,
        `${strand}: decoded entry frame is not black`,
      ).toBeGreaterThan(5);
      expect(
        approaching.meanLight,
        `${strand}: decoded room frame is not black`,
      ).toBeGreaterThan(5);
      expect(approaching.hash, `${strand}: walk-in is moving`).not.toBe(
        entering.hash,
      );
      decodedRooms.add(approaching.hash);
      const duration = await film.evaluate(
        (element: HTMLVideoElement) => element.duration,
      );
      await decodedFrame(film, duration - 0.15);
      const play = page.getByRole("button", {
        name: "Play scene film",
        exact: true,
      });
      await expect(film).toHaveJSProperty("paused", true);
      await expect(play).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Replay scene film" }),
      ).toHaveCount(0);
      await play.click();
      const replay = page.getByRole("button", { name: "Replay scene film" });
      await expect(replay).toBeVisible();
      const ready = page.getByRole("button", {
        name: "I’m ready — ask the question",
      });
      await expect(ready).toBeEnabled();
      await replay.click();
      await expect(film).toHaveJSProperty("paused", false);
      await expect
        .poll(() =>
          film.evaluate((element: HTMLVideoElement) => element.currentTime),
        )
        .toBeLessThan(5);
      await ready.click();
      await expect(film).toHaveCount(0);
      await expect(page.locator(".question")).toHaveText(`“${question.text}”`);
    });
  }
  expect(
    decodedRooms.size,
    "all ten strands use different decoded room imagery",
  ).toBe(strandIds.length);
});
