import { z } from "zod";

const version = z.string().regex(/^\d+\.\d+\.\d+$/).max(32);
const common = { version };
export const analyticsEventSchema = z.discriminatedUnion("event", [
  z.strictObject({ event: z.literal("bns_usage_enabled"), properties: z.strictObject(common) }),
  z.strictObject({ event: z.literal("bns_sync_enabled"), properties: z.strictObject({ ...common, firstSetup: z.boolean() }) }),
  z.strictObject({ event: z.literal("bns_bookmark_saved"), properties: z.strictObject({ ...common, source: z.enum(["automatic", "import"]), result: z.enum(["saved", "duplicate"]) }) }),
  z.strictObject({ event: z.literal("bns_save_failed"), properties: z.strictObject({ ...common, category: z.enum(["offline", "auth", "rate_limit", "schema", "destination", "uncertain", "temporary", "other"]) }) }),
  z.strictObject({ event: z.literal("bns_import_started"), properties: z.strictObject(common) }),
  z.strictObject({ event: z.literal("bns_sync_paused"), properties: z.strictObject(common) }),
  z.strictObject({ event: z.literal("bns_sync_resumed"), properties: z.strictObject(common) }),
]);
export const queuedEventSchema = z.strictObject({
  id: z.string().uuid(), timestamp: z.string().datetime(), data: analyticsEventSchema,
});
export const usageStateSchema = z.object({
  enabled: z.boolean().default(false), installationId: z.string().uuid().optional(),
  queue: z.array(queuedEventSchema).max(100).default([]), nextAttemptAt: z.number().default(0),
}).default({ enabled: false, queue: [], nextAttemptAt: 0 });
export const analyticsBatchSchema = z.strictObject({
  consent: z.literal(true), installationId: z.string().uuid(), events: z.array(queuedEventSchema).min(1).max(25),
});
export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;
export type UsageState = z.infer<typeof usageStateSchema>;
export type AnalyticsBatch = z.infer<typeof analyticsBatchSchema>;
export const analyticsTTL = 7 * 86400_000;

/** A content-free, finite event vocabulary. Call inside the local transaction. */
export function queueUsage(usage: UsageState, event: AnalyticsEvent, now = Date.now()) {
  if (!usage.enabled || !usage.installationId) return;
  const data = analyticsEventSchema.parse(event);
  usage.queue = usage.queue.filter(item => Date.parse(item.timestamp) > now - analyticsTTL).slice(-99);
  usage.queue.push({ id: crypto.randomUUID(), timestamp: new Date(now).toISOString(), data });
}
