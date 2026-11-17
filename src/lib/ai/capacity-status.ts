import { z } from "zod";

const count = z.number().finite().min(0).max(1e12);
const observationSchema = z.object({
  observedAt: z.iso.datetime(),
  status: z.number().int().min(100).max(599),
  latencyMs: count.max(300000),
  requestsPerDayLimit: count.optional(),
  requestsPerDayRemaining: count.optional(),
  tokensPerMinuteLimit: count.optional(),
  tokensPerMinuteRemaining: count.optional(),
  requestsResetSeconds: count.optional(),
  tokensResetSeconds: count.optional(),
  retryAfterSeconds: count.optional(),
  promptTokens: count.optional(),
  completionTokens: count.optional(),
  totalTokens: count.optional(),
});

// The staff boundary exposes only counters, known lane names, and observation
// times. Extra fields (including provider models and any future raw data) strip.
export const capacityStatusSchema = z.object({
  configured: z.boolean(),
  available: z.boolean(),
  checkedAt: z.iso.datetime(),
  lanes: z
    .array(
      z.object({
        lane: z.enum(["text", "audio"]),
        maxConcurrent: count.int(),
        requestsPerMinute: count.int(),
        active: count.int(),
        requestsInMinute: count.int(),
        cooldownSeconds: count,
        latest: observationSchema.nullable(),
      }),
    )
    .max(2),
});
export type CapacityStatus = z.infer<typeof capacityStatusSchema>;
export type CapacityLane = CapacityStatus["lanes"][number];
