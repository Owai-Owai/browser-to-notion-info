import { z } from "zod";
import { configuredDestinationSchema, destinationSchema, initialState, pendingStatuses, terminalStatuses, syncResultSchema, type AppState, type Bookmark, type Command, type ConfiguredDestination, type Scope } from "../../shared/schema";
import { flattenBookmarks, folderTree, normalizeUrl } from "../lib/bookmarks";
import { asFailure, connectNotion, serviceRequest } from "./service";
import { readState, updateState } from "./store";

let pumping = false;
const active = (state: AppState) => state.jobs.filter(job => pendingStatuses.includes(job.status) || job.status === "attention");

function enqueue(state: AppState, bookmark: Bookmark, destination: ConfiguredDestination, batchId?: string, scope: Scope = state.scope) {
  if (!batchId && state.jobs.some(job => job.bookmark.id === bookmark.id && job.destination.id === destination.id && job.status !== "cancelled")) return;
  if (state.jobs.length >= 15_000) throw new Error("Activity storage is full. Existing records are safe. Clear completed history before adding more bookmarks.");
  const supported = normalizeUrl(bookmark.url);
  state.jobs.push({
    id: crypto.randomUUID(), bookmark, destination, batchId, scope,
    status: supported ? "queued" : "skipped", createdAt: Date.now(), updatedAt: Date.now(),
    attempts: 0, retryAt: Date.now() + (batchId ? 0 : 2000),
    ...(!supported ? { error: { code: "unsupported", message: "Only HTTP and HTTPS website bookmarks can be saved." } } : {}),
  });
}

/** Reconcile snapshots, not only events: missed changes are recovered on restart. */
export async function reconcile() {
  const tree = await chrome.bookmarks.getTree();
  await updateState(state => {
    if (!state.enabled || !state.destination || !state.connection) return;
    const snapshots = flattenBookmarks(tree, state.scope);
    const scopeSnapshots = new Map<string, Map<string, ReturnType<typeof flattenBookmarks>[number]>>();
    for (const item of snapshots) {
      if (item.eligible && state.baseline[item.bookmark.id] !== true) enqueue(state, item.bookmark, state.destination);
    }
    for (const job of state.jobs) {
      if (!["queued", "retry"].includes(job.status) || job.attempts > 0) continue;
      const scope = job.batchId ? job.scope : state.scope;
      const scopeKey = JSON.stringify(scope);
      if (!scopeSnapshots.has(scopeKey)) scopeSnapshots.set(scopeKey, new Map(flattenBookmarks(tree, scope).map(item => [item.bookmark.id, item])));
      const item = scopeSnapshots.get(scopeKey)!.get(job.bookmark.id);
      if (!item?.eligible) { job.status = "cancelled"; job.updatedAt = Date.now(); }
      else job.bookmark = item.bookmark;
    }
    state.baseline = Object.fromEntries(snapshots.map(item => [item.bookmark.id, item.eligible]));
    state.lastReconciledAt = Date.now();
  });
  await updateBadge();
}

export async function updateBadge() {
  const state = await readState();
  const failures = state.jobs.filter(job => job.status === "attention" || job.status === "checking").length;
  const pending = state.jobs.filter(job => pendingStatuses.includes(job.status)).length;
  await chrome.action.setBadgeText({ text: state.lastError || failures ? "!" : state.paused ? "Ⅱ" : pending ? String(Math.min(pending, 99)) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: failures || state.lastError ? "#86591d" : "#315d45" });
}

/** A durable saving record and server operation ID survive either process restarting. */
export async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    for (let processed = 0; processed < 8; processed++) {
      const selection = await updateState(state => {
        if (!state.enabled || state.paused || !state.connection) return;
        if (state.jobs.some(job => job.status === "attention" && ["auth", "destination", "schema"].includes(job.error?.code ?? ""))) return;
        const job = state.jobs.find(item => ["queued", "retry", "saving", "checking"].includes(item.status) && item.retryAt <= Date.now());
        if (!job) return;
        job.status = "saving"; job.attempts++; job.updatedAt = Date.now(); job.retryAt = Date.now() + 60_000;
        return { job: structuredClone(job), connection: state.connection };
      });
      if (!selection) break;
      const { job, connection } = selection;
      try {
        const result = await serviceRequest("/v1/sync", { operationId: job.id, bookmark: job.bookmark, destination: job.destination }, syncResultSchema, connection);
        await updateState(state => {
          const item = state.jobs.find(item => item.id === job.id);
          if (item) { item.result = result; item.status = result.status; item.error = undefined; item.updatedAt = Date.now(); }
          state.lastError = undefined;
        });
      } catch (error) {
        const failure = asFailure(error);
        await updateState(state => {
          const item = state.jobs.find(item => item.id === job.id);
          if (!item) return;
          const retryable = ["offline", "rate_limit", "temporary", "busy", "service"].includes(failure.code);
          item.status = failure.code === "uncertain" ? "checking" : retryable && item.attempts < 8 ? "retry" : "attention";
          item.error = failure; item.updatedAt = Date.now();
          item.retryAt = Date.now() + Math.max((failure.retryAfter ?? 0) * 1000, Math.min(3600_000, 30_000 * 2 ** Math.min(item.attempts - 1, 6)) + Math.random() * 5000);
        });
        if (["offline", "auth", "rate_limit", "temporary", "busy"].includes(failure.code)) break;
      }
      await updateBadge();
    }
  } finally {
    pumping = false; await updateBadge();
    const state = await readState();
    if (state.enabled && !state.paused && state.jobs.some(job => ["queued", "retry"].includes(job.status) && job.retryAt <= Date.now()) && !state.jobs.some(job => job.status === "attention" && ["auth", "destination", "schema"].includes(job.error?.code ?? ""))) setTimeout(() => { void pump().catch(() => undefined); }, 1000);
  }
}

export async function handleCommand(command: Command): Promise<unknown> {
  switch (command.type) {
    case "state": {
      const state = await readState();
      const { workerError } = await chrome.storage.session.get("workerError");
      return { ...state, ...(typeof workerError === "string" ? { lastError: workerError } : {}) };
    }
    case "folders": return folderTree(await chrome.bookmarks.getTree());
    case "clearHistory": return updateState(state => { state.jobs = state.jobs.filter(job => !terminalStatuses.includes(job.status)); });
    case "draft": return updateState(state => { state.draft = command.draft; });
    case "connect": {
      const previous = await readState();
      const connection = await connectNotion(previous.connection);
      if (previous.connection && previous.connection.workspaceId !== connection.workspaceId && active(previous).length) {
        await serviceRequest("/v1/disconnect", {}, z.object({ ok: z.boolean() }), connection);
        throw new Error("Finish or cancel pending work before connecting a different workspace.");
      }
      await updateState(state => {
        state.connection = connection;
        state.jobs.filter(job => job.error?.code === "auth").forEach(job => { job.status = "queued"; job.retryAt = Date.now(); job.attempts = 0; });
      });
      if (previous.connection) await serviceRequest("/v1/disconnect", {}, z.object({ ok: z.boolean() }), previous.connection).catch(() => undefined);
      return connection;
    }
    case "disconnect": {
      const state = await readState();
      if (state.connection) await serviceRequest("/v1/disconnect", {}, z.object({ ok: z.boolean() }), state.connection);
      await updateState(state => Object.assign(state, initialState()));
      await updateBadge(); return;
    }
    case "resolve": {
      const state = await readState();
      if (!state.connection) throw new Error("Connect Notion before choosing a destination.");
      return serviceRequest("/v1/destinations", { link: command.link }, z.array(destinationSchema), state.connection);
    }
    case "preview": {
      const state = await readState();
      if (!state.connection) throw new Error("Connect Notion first.");
      const snapshots = flattenBookmarks(await chrome.bookmarks.getTree(), command.scope).filter(item => item.eligible);
      const eligible = snapshots.map(item => normalizeUrl(item.bookmark.url)).filter((url): url is string => !!url);
      const unique = [...new Set(eligible)];
      const existing = new Set<string>();
      for (let start = 0; start < unique.length; start += 50) {
        const matches = await serviceRequest("/v1/preview", { urls: unique.slice(start, start + 50), destination: command.destination }, z.object({ existing: z.array(z.string()) }), state.connection);
        matches.existing.forEach(url => existing.add(url));
      }
      return { eligible: snapshots.length, unsupported: snapshots.length - eligible.length, alreadyPresent: eligible.length - unique.length + existing.size, toSave: unique.length - existing.size };
    }
    case "configure": {
      const destination = configuredDestinationSchema.parse(command.destination);
      if (command.scope.mode === "selected" && !command.scope.folderIds.length) throw new Error("Select at least one bookmark folder.");
      const tree = await chrome.bookmarks.getTree();
      await updateState(state => {
        if (!state.connection) throw new Error("Connect Notion first.");
        const changed = state.destination && state.destination.id !== destination.id;
        if (changed && active(state).length && !command.discardPending) throw new Error("Pending bookmarks belong to the previous destination. Finish them or choose Discard pending work before changing destinations.");
        if (changed && command.discardPending) active(state).filter(job => job.status !== "saving").forEach(job => { job.status = "cancelled"; });
        if (!changed) {
          active(state).filter(job => job.destination.id === destination.id && job.status !== "saving").forEach(job => {
            job.destination = destination;
            if (job.error?.code === "schema") { job.status = "queued"; job.error = undefined; job.retryAt = Date.now(); job.attempts = 0; }
          });
        }
        const batchId = crypto.randomUUID();
        state.destination = destination; state.scope = command.scope; state.enabled = true;
        state.baseline = Object.fromEntries(flattenBookmarks(tree, command.scope).map(item => [item.bookmark.id, item.eligible]));
        state.draft.step = 4; state.lastError = undefined;
        if (command.importExisting) flattenBookmarks(tree, command.scope).filter(item => item.eligible).forEach(item => enqueue(state, item.bookmark, destination, batchId));
      });
      return;
    }
    case "import": {
      const tree = await chrome.bookmarks.getTree();
      return updateState(state => {
        if (!state.destination || !state.connection) throw new Error("Finish setup first.");
        const batchId = crypto.randomUUID();
        flattenBookmarks(tree, command.scope).filter(item => item.eligible).forEach(item => enqueue(state, item.bookmark, state.destination!, batchId, command.scope));
        return batchId;
      });
    }
    case "pause": return updateState(state => { state.paused = command.paused; });
    case "retry": return updateState(state => {
      state.jobs.filter(job => (!command.id || job.id === command.id) && ["attention", "retry", "checking"].includes(job.status)).forEach(job => { job.status = "queued"; job.retryAt = Date.now(); job.attempts = 0; });
    });
    case "cancelImport": return updateState(state => {
      state.jobs.filter(job => job.batchId === command.batchId && ["queued", "retry", "attention"].includes(job.status) && job.attempts === 0).forEach(job => { job.status = "cancelled"; job.updatedAt = Date.now(); });
    });
  }
}
