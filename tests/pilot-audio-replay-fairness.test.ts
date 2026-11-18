import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createConnection } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mock = vi.hoisted(() => ({
  eval: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  zrem: vi.fn(),
  fromEnv: vi.fn(),
  rateLimit: vi.fn(),
}));
vi.mock("@upstash/redis", () => ({ Redis: { fromEnv: mock.fromEnv } }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mock.rateLimit }));

import { withProviderCapacity } from "@/lib/ai/capacity";
import {
  limitLogicalSubmission,
  withUploadAdmission,
} from "@/lib/request-admission";

const studentA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const studentB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const redisBinary = process.env.IGNITE_TEST_REDIS_SERVER ?? "redis-server";
const localRedisAvailable =
  spawnSync(redisBinary, ["--version"], { timeout: 2000 }).status === 0;
if (process.env.CI && !localRedisAvailable)
  throw new Error(
    "CI requires redis-server for atomic provider admission tests.",
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://local-redis.invalid");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "controlled-test-token");
  vi.stubEnv("IGNITE_AI_AUDIO_USER_CALLS_10M", "2");
  vi.stubEnv("IGNITE_AI_AUDIO_RPM", "200");
  vi.stubEnv("IGNITE_AI_AUDIO_CONCURRENCY", "8");
  mock.fromEnv.mockReturnValue(mock);
  mock.eval.mockResolvedValue([1, 0, 0]);
  mock.zrem.mockResolvedValue(1);
  mock.get.mockResolvedValue(null);
  mock.set.mockResolvedValue("OK");
  mock.rateLimit.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

it("uses the trusted student's stable hashed key and a fresh physical-call ID on every admission", async () => {
  await withProviderCapacity("audio", "test-asr", async () => "one", studentA);
  await withProviderCapacity(
    "audio",
    "test-asr",
    async () => "retry of the same clip",
    studentA.toUpperCase(),
  );
  await withProviderCapacity(
    "audio",
    "test-asr",
    async () => "other",
    studentB,
  );
  const calls = mock.eval.mock.calls;
  expect(calls[1][1][3]).toBe(calls[0][1][3]);
  expect(calls[2][1][3]).not.toBe(calls[0][1][3]);
  expect(calls.every((call) => call[1].length === 4 && call[2][4] === 2)).toBe(
    true,
  );
  for (const [, keys] of calls) {
    expect(
      new Set(keys.map((key: string) => key.match(/\{[^}]+\}/)?.[0])).size,
    ).toBe(1);
    expect(keys[3]).not.toContain(studentA);
    expect(keys[3]).not.toContain(studentB);
  }
  expect(new Set(calls.map((call) => call[2][0])).size).toBe(3);
});

it("returns a terminal student allowance error without invoking or releasing nonexistent provider work", async () => {
  mock.eval.mockResolvedValue([0, 517, 3]);
  const provider = vi.fn();
  const error = await withProviderCapacity(
    "audio",
    "test-asr",
    provider,
    studentA,
  ).catch((failure: unknown) => failure);
  expect(error).toMatchObject({ status: 429, retryAfterSeconds: 517 });
  expect(error).not.toHaveProperty("code");
  expect(provider).not.toHaveBeenCalled();
  expect(mock.zrem).not.toHaveBeenCalled();
});

it.each(["", "client-supplied-name", "../other-student"])(
  "fails closed for a malformed admission identity %j before reserving any capacity",
  async (identity) => {
    const provider = vi.fn();
    await expect(
      withProviderCapacity("audio", "test-asr", provider, identity),
    ).rejects.toMatchObject({ status: 503 });
    expect(mock.eval).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  },
);

// These tests execute the exported Lua through a private, unauthenticated local
// Unix socket. They never contact Upstash, Supabase, or an inference provider.
// CI can opt in with IGNITE_TEST_REDIS_SERVER or a redis-server on PATH.
type Reply = string | number | null | Reply[];
function parseReply(
  buffer: Buffer,
  start = 0,
): { value: Reply; next: number } | undefined {
  const end = buffer.indexOf("\r\n", start);
  if (end === -1) return;
  const kind = String.fromCharCode(buffer[start]);
  const line = buffer.toString("utf8", start + 1, end);
  let next = end + 2;
  if (kind === "-") throw new Error(line);
  if (kind === "+") return { value: line, next };
  if (kind === ":") return { value: Number(line), next };
  if (kind === "$") {
    const length = Number(line);
    if (length === -1) return { value: null, next };
    if (buffer.length < next + length + 2) return;
    return {
      value: buffer.toString("utf8", next, next + length),
      next: next + length + 2,
    };
  }
  if (kind === "*") {
    const count = Number(line);
    if (count === -1) return { value: null, next };
    const value: Reply[] = [];
    for (let index = 0; index < count; index++) {
      const item = parseReply(buffer, next);
      if (!item) return;
      value.push(item.value);
      next = item.next;
    }
    return { value, next };
  }
  throw new Error("Unexpected local Redis response");
}

describe.skipIf(!localRedisAvailable)(
  "real Redis audio and upload fairness",
  () => {
    let server: ChildProcess;
    let folder: string;
    let socket: string;
    function command(...args: (string | number)[]): Promise<Reply> {
      return new Promise((resolve, reject) => {
        const connection = createConnection(socket);
        let received = Buffer.alloc(0);
        const done = (failure?: Error, value?: Reply) => {
          connection.destroy();
          if (failure) reject(failure);
          else resolve(value ?? null);
        };
        connection.setTimeout(3000, () =>
          done(new Error("Local Redis command timed out")),
        );
        connection.once("error", (failure) => done(failure));
        connection.once("connect", () => {
          const parts = args.map((value) => Buffer.from(String(value)));
          connection.write(
            Buffer.concat([
              Buffer.from(`*${parts.length}\r\n`),
              ...parts.flatMap((part) => [
                Buffer.from(`$${part.length}\r\n`),
                part,
                Buffer.from("\r\n"),
              ]),
            ]),
          );
        });
        connection.on("data", (chunk) => {
          received = Buffer.concat([
            received,
            typeof chunk === "string" ? Buffer.from(chunk) : chunk,
          ]);
          try {
            const reply = parseReply(received);
            if (reply) done(undefined, reply.value);
          } catch (failure) {
            done(failure as Error);
          }
        });
      });
    }
    beforeAll(async () => {
      folder = await mkdtemp(join(tmpdir(), "ignite-replay-test-"));
      socket = join(folder, "redis.sock");
      server = spawn(
        redisBinary,
        [
          "--port",
          "0",
          "--unixsocket",
          socket,
          "--save",
          "",
          "--appendonly",
          "no",
          "--dir",
          folder,
        ],
        { stdio: "ignore" },
      );
      for (let attempt = 0; attempt < 100; attempt++) {
        try {
          if ((await command("PING")) === "PONG") return;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      }
      throw new Error("Isolated local Redis did not become ready");
    });
    afterAll(async () => {
      if (server?.exitCode === null) {
        const exited = new Promise<void>((resolve) =>
          server.once("exit", () => resolve()),
        );
        server.kill("SIGTERM");
        await exited;
      }
      if (folder) await rm(folder, { recursive: true, force: true });
    });
    beforeEach(async () => {
      await command("FLUSHDB");
      mock.eval.mockImplementation(
        (script: string, keys: string[], args: (string | number)[]) =>
          command("EVAL", script, keys.length, ...keys, ...args),
      );
      mock.get.mockImplementation((key: string) => command("GET", key));
      mock.set.mockImplementation(
        (key: string, value: string, options: { ex: number }) =>
          command("SET", key, value, "EX", options.ex),
      );
      mock.zrem.mockImplementation((key: string, member: string) =>
        command("ZREM", key, member),
      );
    });
    const transcribe = (
      identity: string,
      work = async () => "synthetic recorded words",
    ) => withProviderCapacity("audio", "test-asr", work, identity);
    const latestKeys = (): string[] => mock.eval.mock.calls.at(-1)![1];
    function heldUpload(identity: string) {
      let entered!: () => void;
      let release!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const finished = withUploadAdmission(async () => {
        entered();
        await held;
        return "synthetic upload completed";
      }, identity);
      return { started, release, finished };
    }

    it("limits one student to two held multipart uploads while other students fill the eight global slots", async () => {
      const held: ReturnType<typeof heldUpload>[] = [];
      try {
        held.push(heldUpload(studentA), heldUpload(studentA));
        await Promise.all(held.map((upload) => upload.started));
        const keys = latestKeys();
        const deniedWork = vi.fn();
        await expect(
          withUploadAdmission(deniedWork, studentA),
        ).rejects.toMatchObject({
          status: 429,
          code: "AI_CAPACITY_BUSY",
        });
        expect(deniedWork).not.toHaveBeenCalled();
        expect(await command("ZCARD", keys[0])).toBe(2);
        expect(await command("ZCARD", keys[1])).toBe(2);
        for (const identity of [
          studentB,
          "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        ]) {
          const pair = [heldUpload(identity), heldUpload(identity)];
          held.push(...pair);
          await Promise.all(pair.map((upload) => upload.started));
          expect(await command("ZCARD", latestKeys()[1])).toBe(2);
        }
        expect(await command("ZCARD", keys[0])).toBe(8);
        await expect(
          withUploadAdmission(
            deniedWork,
            "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          ),
        ).rejects.toMatchObject({ status: 429 });
        expect(await command("ZCARD", keys[0])).toBe(8);
        expect(await command("EXISTS", latestKeys()[1])).toBe(0);
        expect(deniedWork).not.toHaveBeenCalled();
      } finally {
        held.forEach((upload) => upload.release());
        await Promise.allSettled(held.map((upload) => upload.finished));
      }
      expect(await command("ZCARD", "ignite:uploads:active")).toBe(0);
    });

    it("expires an old upload in both shares and prevents its late release from deleting replacement owners", async () => {
      const held: ReturnType<typeof heldUpload>[] = [];
      try {
        const old = heldUpload(studentA);
        held.push(old);
        await old.started;
        const [, keys, args] = mock.eval.mock.calls.at(-1)!;
        const oldOwner = args[2];
        const other = heldUpload(studentA);
        held.push(other);
        await other.started;
        for (const key of keys) await command("ZADD", key, 1, oldOwner);

        const replacement = heldUpload(studentA);
        held.push(replacement);
        await replacement.started;
        const replacementOwner = mock.eval.mock.calls.at(-1)![2][2];
        expect(replacementOwner).not.toBe(oldOwner);
        for (const key of keys) {
          expect(await command("ZCARD", key)).toBe(2);
          expect(await command("ZSCORE", key, oldOwner)).toBeNull();
          expect(await command("PTTL", key)).toBeGreaterThan(100000);
        }
        old.release();
        await expect(old.finished).resolves.toBe("synthetic upload completed");
        for (const key of keys) {
          expect(await command("ZCARD", key)).toBe(2);
          expect(await command("ZSCORE", key, replacementOwner)).not.toBeNull();
        }
        other.release();
        await other.finished;
        for (const key of keys) expect(await command("ZCARD", key)).toBe(1);
      } finally {
        held.forEach((upload) => upload.release());
        await Promise.allSettled(held.map((upload) => upload.finished));
      }
      expect(await command("ZCARD", "ignite:uploads:active")).toBe(0);
    });

    it("charges every physical replay of the same previously accepted logical clip", async () => {
      const provider = vi.fn(async () => "synthetic recorded words");
      for (let replay = 0; replay < 2; replay++) {
        await limitLogicalSubmission(
          studentA,
          "transcribe",
          "same-clip-id",
          "same-audio-hash",
        );
        await transcribe(studentA, provider);
      }
      await limitLogicalSubmission(
        studentA,
        "transcribe",
        "same-clip-id",
        "same-audio-hash",
      );
      await expect(transcribe(studentA, provider)).rejects.toMatchObject({
        status: 429,
      });
      const keys = latestKeys();
      expect(provider).toHaveBeenCalledTimes(2);
      expect(mock.rateLimit).toHaveBeenCalledTimes(1);
      expect(await command("ZCARD", keys[1])).toBe(2);
      expect(await command("ZCARD", keys[3])).toBe(2);
      expect(await command("ZCARD", keys[0])).toBe(0);
    });

    it("rejects 100 exhausted-student replays without consuming or pruning global reservations", async () => {
      await transcribe(studentA);
      await transcribe(studentA);
      const keys = latestKeys();
      // Even stale global members are untouched by a student-only denial.
      await command("ZADD", keys[0], 1, "stale-global-lease");
      await command("ZADD", keys[1], 1, "stale-global-request");
      const before = await Promise.all(
        keys
          .slice(0, 2)
          .map((key) => command("ZRANGE", key, 0, -1, "WITHSCORES")),
      );
      const provider = vi.fn();
      const denied = await Promise.allSettled(
        Array.from({ length: 100 }, () => transcribe(studentA, provider)),
      );
      expect(
        denied.every(
          (result) =>
            result.status === "rejected" &&
            result.reason.status === 429 &&
            result.reason.code === undefined,
        ),
      ).toBe(true);
      expect(provider).not.toHaveBeenCalled();
      const after = await Promise.all(
        keys
          .slice(0, 2)
          .map((key) => command("ZRANGE", key, 0, -1, "WITHSCORES")),
      );
      expect(after).toEqual(before);
      await expect(transcribe(studentB)).resolves.toBe(
        "synthetic recorded words",
      );
      expect(await command("ZCARD", latestKeys()[3])).toBe(1);
    });

    it("atomically limits a 50-request same-student burst while leaving another student eligible", async () => {
      vi.stubEnv("IGNITE_AI_AUDIO_USER_CALLS_10M", "3");
      const provider = vi.fn(async () => "synthetic recorded words");
      const burst = await Promise.allSettled(
        Array.from({ length: 50 }, () => transcribe(studentA, provider)),
      );
      expect(
        burst.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(3);
      expect(provider).toHaveBeenCalledTimes(3);
      expect(await command("ZCARD", latestKeys()[3])).toBe(3);
      await expect(transcribe(studentB)).resolves.toBe(
        "synthetic recorded words",
      );
    });

    it("keeps a dispatched failed call charged while releasing only its active lease", async () => {
      const failure = new Error("synthetic provider failure");
      await expect(
        transcribe(studentA, async () => {
          throw failure;
        }),
      ).rejects.toBe(failure);
      const keys = latestKeys();
      expect(await command("ZCARD", keys[0])).toBe(0);
      expect(await command("ZCARD", keys[1])).toBe(1);
      expect(await command("ZCARD", keys[3])).toBe(1);
      await expect(transcribe(studentA)).resolves.toBe(
        "synthetic recorded words",
      );
      await expect(transcribe(studentA)).rejects.toMatchObject({ status: 429 });
    });

    it.each(["concurrency", "minute pacing", "provider cooldown"])(
      "does not charge a student's ten-minute allowance when global %s denies admission",
      async (reason) => {
        await transcribe(studentA);
        const keys = latestKeys();
        if (reason === "concurrency") {
          vi.stubEnv("IGNITE_AI_AUDIO_CONCURRENCY", "1");
          await command(
            "ZADD",
            keys[0],
            Date.now() + 60000,
            "other-active-call",
          );
        } else if (reason === "minute pacing") {
          vi.stubEnv("IGNITE_AI_AUDIO_RPM", "1");
        } else {
          await command("SET", keys[2], Date.now() + 60000, "PX", 60000);
        }
        await expect(transcribe(studentB)).rejects.toMatchObject({
          status: 429,
        });
        expect(await command("EXISTS", latestKeys()[3])).toBe(0);
        expect(await command("ZCARD", keys[1])).toBe(1);
      },
    );

    it("expires only old student reservations and reports the remaining actual ten-minute wait", async () => {
      await transcribe(studentA);
      await transcribe(studentA);
      const keys = latestKeys();
      const clock = (await command("TIME")) as string[];
      const now = Number(clock[0]) * 1000 + Math.floor(Number(clock[1]) / 1000);
      const members = (await command("ZRANGE", keys[3], 0, -1)) as string[];
      await command(
        "ZADD",
        keys[3],
        now - 500000,
        members[0],
        now - 300000,
        members[1],
      );
      await expect(transcribe(studentA)).rejects.toMatchObject({
        status: 429,
        retryAfterSeconds: 100,
      });
      await command("ZADD", keys[3], now - 600001, members[0]);
      await expect(transcribe(studentA)).resolves.toBe(
        "synthetic recorded words",
      );
      expect(await command("ZCARD", keys[3])).toBe(2);
      expect(await command("ZSCORE", keys[3], members[0])).toBeNull();
      expect(await command("ZSCORE", keys[3], members[1])).not.toBeNull();
      expect(await command("PTTL", keys[3])).toBeGreaterThan(599000);
    });
  },
);
