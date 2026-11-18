import { analyticsBatchSchema, analyticsTTL } from "../../../shared/analytics.ts";
import { ApiError } from "../../../shared/api-error.ts";
import { okSchema, rpc, type Repository } from "./repository.ts";
import type { EdgeConfig } from "./config.ts";

export async function captureUsage(config: EdgeConfig, repository: Repository, owner: string, body: unknown, transport: typeof fetch) {
  const input = analyticsBatchSchema.parse(body);
  if (!config.posthogToken) throw new ApiError(503, { code: "analytics_unavailable", message: "Usage sharing is not configured yet." });
  const now = Date.now();
  const events = input.events.filter(item => Date.parse(item.timestamp) >= now - analyticsTTL && Date.parse(item.timestamp) <= now + 60_000);
  if (!events.length) return { ok: true };
  await rpc(repository, "analytics_allow", { owner, count: events.length }, okSchema);
  // Rebuild every field. Never forward request headers, IPs, session IDs or arbitrary properties.
  const batch = events.map(item => ({
    event: item.data.event, uuid: item.id, timestamp: item.timestamp,
    properties: { ...item.data.properties, distinct_id: input.installationId, $process_person_profile: false, $geoip_disable: true, $ip: null },
  }));
  const response = await transport(`${config.posthogHost}/batch/`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: config.posthogToken, batch }), signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new ApiError(503, { code: "analytics_unavailable", message: "Usage sharing is temporarily unavailable." });
  const result = await response.json();
  if (result?.status !== "Ok" && result?.status !== 1) throw new ApiError(503, { code: "analytics_unavailable", message: "Usage sharing was not accepted." });
  return { ok: true };
}
