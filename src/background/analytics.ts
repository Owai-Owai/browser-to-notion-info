import { analyticsBatchSchema, analyticsTTL, queueUsage, type AnalyticsEvent } from "../../shared/analytics";
import type { AppState } from "../../shared/schema";
import { usageSupported, serviceURL } from "../lib/service-config";
import { readState, updateState } from "./store";

export function usageEvent(state: AppState, event: AnalyticsEvent["event"], properties: Record<string, unknown> = {}) {
  if (!usageSupported || !state.usage.enabled) return;
  queueUsage(state.usage, { event, properties: { version: chrome.runtime.getManifest().version, ...properties } } as AnalyticsEvent);
}

let flushing = false;
let activeRequest: AbortController | undefined;
export function stopUsageRequest() { activeRequest?.abort(); }

/** Separate from the bookmark queue. Failures never change bookmark status. */
export async function flushUsage() {
  if (!usageSupported || flushing) return;
  flushing = true;
  try {
    const state = await readState();
    if (!state.usage.enabled || !state.usage.installationId || !state.connection || state.usage.nextAttemptAt > Date.now()) return;
    const events = state.usage.queue.filter(item => Date.parse(item.timestamp) > Date.now() - analyticsTTL).slice(0, 25);
    if (!events.length) return;
    const batch = analyticsBatchSchema.parse({ consent: true, installationId: state.usage.installationId, events });
    activeRequest = new AbortController();
    const timer = setTimeout(() => activeRequest?.abort(), 10_000);
    let accepted = false;
    try {
      // Recheck after reading: opting out can race a scheduled flush.
      const current = await readState();
      if (!current.usage.enabled || current.usage.installationId !== batch.installationId) return;
      const response = await fetch(`${serviceURL}/v1/analytics`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.connection.token}` }, body: JSON.stringify(batch), signal: activeRequest.signal });
      accepted = response.ok;
    } finally { clearTimeout(timer); }
    const ids = new Set(events.map(item => item.id));
    await updateState(current => {
      if (!current.usage.enabled || current.usage.installationId !== batch.installationId) return;
      current.usage.queue = current.usage.queue.filter(item => (!accepted || !ids.has(item.id)) && Date.parse(item.timestamp) > Date.now() - analyticsTTL);
      current.usage.nextAttemptAt = Date.now() + (accepted ? 30_000 : 5 * 60_000);
    });
  } catch {
    await updateState(state => { if (state.usage.enabled) state.usage.nextAttemptAt = Date.now() + 5 * 60_000; }).catch(() => undefined);
  } finally { flushing = false; activeRequest = undefined; }
}
