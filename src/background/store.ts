import { appStateSchema, initialState, terminalStatuses, type AppState } from "../../shared/schema";
import { analyticsTTL } from "../../shared/analytics";

let transaction: Promise<unknown> = Promise.resolve();

/** All local mutations share one transaction lane in the service worker. */
export function updateState<T>(mutate: (state: AppState) => T | Promise<T>): Promise<T> {
  const next = transaction.then(async () => {
    const state = await readState();
    const result = await mutate(state);
    const cutoff = Date.now() - 30 * 86400_000;
    state.jobs = state.jobs.filter(job => !terminalStatuses.includes(job.status) || job.updatedAt >= cutoff);
    state.usage.queue = state.usage.enabled ? state.usage.queue.filter(event => Date.parse(event.timestamp) > Date.now() - analyticsTTL) : [];
    await chrome.storage.local.set({ state });
    await chrome.storage.session.remove("workerError");
    return result;
  });
  transaction = next.catch(() => undefined);
  return next;
}

export async function readState(): Promise<AppState> {
  const { state } = await chrome.storage.local.get("state");
  if (!state) return initialState();
  const result = appStateSchema.safeParse(state);
  if (!result.success) throw new Error("We couldn't read your saved settings. Your data hasn't been changed. Contact support before reinstalling.");
  return result.data;
}
