import { commandSchema } from "../../shared/schema";
import { handleCommand, pump, reconcile } from "./engine";

const initialize = async () => {
  await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  await chrome.alarms.create("bookmark-sync", { periodInMinutes: 0.5 });
  await reconcile(); await pump();
};
const run = () => {
  void reconcile().then(pump).catch(reportError);
  // Fast path while this worker is awake; the persistent alarm is the recovery path.
  setTimeout(() => { void pump().catch(reportError); }, 2200);
};

async function reportError(error: unknown) {
  console.error("Bookmark sync needs attention:", error instanceof Error ? error.name : "Unknown error");
  await chrome.storage.session.set({ workerError: error instanceof Error ? error.message : "Bookmark syncing needs attention. Check your connection and local storage." });
  await chrome.action.setBadgeText({ text: "!" });
  await chrome.action.setTitle({ title: "Browser to Notion: open Activity to check syncing" });
}

chrome.runtime.onInstalled.addListener(() => { void initialize().catch(reportError); });
chrome.runtime.onStartup.addListener(() => { void initialize().catch(reportError); });
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === "bookmark-sync") run(); });
chrome.bookmarks.onCreated.addListener(run);
chrome.bookmarks.onMoved.addListener(run);
chrome.bookmarks.onChanged.addListener(run);
chrome.bookmarks.onRemoved.addListener(run);
chrome.bookmarks.onImportEnded.addListener(run);

chrome.runtime.onMessage.addListener((raw: unknown, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return false;
  const command = commandSchema.safeParse(raw);
  if (!command.success) { respond({ ok: false, error: "The request is invalid. Reload the extension and try again." }); return false; }
  void handleCommand(command.data).then(value => {
    respond({ ok: true, value });
    if (!["state", "folders", "draft", "resolve", "preview"].includes(command.data.type)) run();
  }).catch((error: unknown) => respond({ ok: false, error: error instanceof Error ? error.message : "The action could not be completed." }));
  return true;
});
