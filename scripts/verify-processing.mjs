// Run manually: node --env-file=.env.local scripts/verify-processing.mjs
// No interview content, IPs, API tokens, or provider output is printed.
import Groq from "groq-sdk";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
let failed = false;
try {
  const limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(1, "10 s"),
    analytics: false,
    prefix: "ignite:health",
  });
  const id = crypto.randomUUID();
  const first = await limiter.limit(id);
  const second = await limiter.limit(id);
  if (
    !first.success ||
    second.success ||
    first.reason === "timeout" ||
    second.reason === "timeout"
  )
    throw new Error("Counters did not enforce the limit");
  console.log(
    "PASS: Redis can write ephemeral counters and reject excess requests.",
  );
} catch {
  failed = true;
  console.error(
    "FAIL: Redis counters unavailable. Use the standard read/write REST token, not the read-only token. PING alone is insufficient.",
  );
}
try {
  const models = await new Groq({
    apiKey: process.env.GROQ_API_KEY,
    timeout: 10000,
    maxRetries: 0,
  }).models.list();
  for (const model of [
    process.env.GROQ_MODEL,
    process.env.GROQ_TRANSCRIPTION_MODEL,
  ])
    if (!model || !models.data.some((item) => item.id === model))
      throw new Error("Model unavailable");
  console.log(
    "PASS: Groq credentials authenticate and both configured models are available (no paid generation).",
  );
} catch {
  failed = true;
  console.error(
    "FAIL: Check Groq key and model configuration locally; keep credentials out of chat.",
  );
}
process.exitCode = failed ? 1 : 0;
