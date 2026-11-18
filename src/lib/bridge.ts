import { z } from "zod";
import { appStateSchema, initialState, type AppState, type Command, type Destination, type FolderNode } from "../../shared/schema";

export const isExtension = typeof chrome !== "undefined" && !!chrome.runtime?.id;
const responseSchema = z.discriminatedUnion("ok", [z.object({ ok: z.literal(true), value: z.unknown().optional() }), z.object({ ok: z.literal(false), error: z.string() })]);

export async function request<T = void>(command: Command): Promise<T> {
  if (!isExtension) {
    if (import.meta.env.DEV) return previewRequest(command) as Promise<T>;
    throw new Error("Open Browser to Notion from Chrome's extension menu to get started.");
  }
  const response = responseSchema.parse(await chrome.runtime.sendMessage(command));
  if (!response.ok) throw new Error(response.error);
  return response.value as T;
}
export async function getAppState() { return appStateSchema.parse(await request({ type: "state" })); }
export function openOptions(route = "settings") {
  if (isExtension) void chrome.tabs.create({ url: chrome.runtime.getURL(`options.html#${route}`) });
  else window.open(`/options.html#${route}`, "_blank", "noopener,noreferrer");
}
export function openExternal(url: string) {
  const target = new URL(url);
  if (!["http:", "https:"].includes(target.protocol)) return;
  if (isExtension) void chrome.tabs.create({ url: target.href });
  else window.open(target.href, "_blank", "noopener,noreferrer");
}

export const previewFolders: FolderNode[] = [
  { id: "1", title: "Bookmarks bar", bookmarkCount: 24, children: [
    { id: "10", title: "Reading", bookmarkCount: 12, children: [{ id: "11", title: "Design", bookmarkCount: 5, children: [] }] },
    { id: "12", title: "Work", bookmarkCount: 8, children: [] },
  ] },
  { id: "2", title: "Other bookmarks", bookmarkCount: 6, children: [] },
];
const previewDestination: Destination = { id: "sample-source", name: "Reading list", url: "https://www.notion.so/example", properties: [
  { id: "title", name: "Name", type: "title", options: [] }, { id: "url", name: "URL", type: "url", options: [] },
  { id: "folder", name: "Bookmark Folder", type: "rich_text", options: [] }, { id: "date", name: "Bookmarked At", type: "date", options: [] },
  { id: "status", name: "Status", type: "status", options: [{ id: "unread", name: "To read" }, { id: "read", name: "Read" }] },
] };

/** Browser development preview is explicitly labelled and never calls Notion. */
async function previewRequest(command: Command): Promise<unknown> {
  const raw = localStorage.getItem("bns-preview");
  const state: AppState = raw ? appStateSchema.parse(JSON.parse(raw)) : initialState();
  switch (command.type) {
    case "state": return state;
    case "folders": return previewFolders;
    case "connect": state.connection = { token: "preview-only", workspaceId: "preview", workspaceName: "Personal workspace (sample)" }; break;
    case "disconnect": localStorage.removeItem("bns-preview"); return;
    case "resolve": new URL(command.link); return [previewDestination];
    case "draft": state.draft = command.draft; break;
    case "preview": return { eligible: 12, alreadyPresent: 2, unsupported: 0, toSave: 10 };
    case "configure": state.destination = command.destination; state.scope = command.scope; state.enabled = true; state.draft.step = 4; break;
    case "pause": state.paused = command.paused; break;
    case "import": return "preview-batch";
    case "cancelImport": case "retry": break;
    case "clearHistory": state.jobs = []; break;
  }
  localStorage.setItem("bns-preview", JSON.stringify(state));
}
