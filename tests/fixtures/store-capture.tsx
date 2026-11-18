// Development-only image fixture: real UI components with fictional, local data.
// This entry is not included in the extension build and never contacts Notion.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { initialState, type ConfiguredDestination } from "../../shared/schema";
import { Activity } from "../../src/components/activity";
import { Brand } from "../../src/components/common";
import { SettingsContent } from "../../src/components/settings-content";
import { Setup } from "../../src/components/setup";
import { Button } from "../../src/components/ui/button";
import { queryClient } from "../../src/lib/queries";
import "../../src/styles.css";

if (!import.meta.env.DEV) throw new Error("Store captures are available only in development.");

const destination: ConfiguredDestination = {
  id: "store-capture-destination", name: "Reading list", url: "https://www.notion.so/example-reading-list",
  mapping: { titleId: "title", urlId: "url", folderId: "folder", dateId: "date", statusId: "status", statusValue: "unread" },
  properties: [
    { id: "title", name: "Name", type: "title", options: [] },
    { id: "url", name: "URL", type: "url", options: [] },
    { id: "folder", name: "Bookmark Folder", type: "rich_text", options: [] },
    { id: "date", name: "Bookmarked At", type: "date", options: [] },
    { id: "status", name: "Status", type: "select", options: [{ id: "unread", name: "To read" }] },
  ],
};
const state = initialState();
state.enabled = true;
state.connection = { token: "local-store-capture", workspaceId: "fictional", workspaceName: "Personal workspace" };
state.destination = destination;
state.scope = { mode: "selected", folderIds: ["10"] };
state.draft = { ...state.draft, step: 2, setupMethod: "existing", scope: state.scope, destinations: [destination], selectedDestinationId: destination.id, mapping: destination.mapping };
state.jobs = [
  ["Chrome extension docs", "https://developer.chrome.com/docs/extensions/", "saved"],
  ["Notion API guide", "https://developers.notion.com/", "saved"],
  ["Web accessibility basics", "https://www.w3.org/WAI/fundamentals/accessibility-intro/", "duplicate"],
].map(([title, url, status], index) => ({
  id: crypto.randomUUID(), bookmark: { id: String(index), title, url, folderPath: "Bookmarks bar / Reading", dateAdded: Date.now() - 300_000 },
  destination, scope: state.scope, status: status as "saved" | "duplicate", attempts: 1,
  createdAt: Date.now() - 300_000, updatedAt: Date.now() - (3 - index) * 60_000, retryAt: 0,
  result: { status: status as "saved" | "duplicate", pageId: `fictional-${index}`, pageUrl: `https://www.notion.so/example-entry-${index}` },
}));
localStorage.setItem("bns-preview", JSON.stringify(state));

function StoreCapture() {
  const [screen, setScreen] = useState(new URLSearchParams(location.search).get("screen") || "activity");
  return <div className="settings-page"><div className="settings-shell">
    <header className="flex flex-wrap items-center justify-between gap-4"><Brand/><nav className="flex items-center gap-1" aria-label="Extension settings">
      {["settings", "activity"].map(route => <Button key={route} variant="ghost" size="sm" className={screen === route ? "bg-muted" : "text-muted-foreground"} onClick={() => setScreen(route)}>{route === "settings" ? "Settings" : "Activity"}</Button>)}
      <Button variant="ghost" size="icon" aria-label="Open your Notion destination" className="size-8 text-muted-foreground"><ExternalLink className="size-4"/></Button>
    </nav></header>
    {screen === "folders" ? <Setup state={state} finish={() => setScreen("settings")}/> : screen === "settings" ? <SettingsContent state={state} navigate={setScreen}/> : <Activity state={state}/>}
    <footer className="mx-auto mt-8 flex max-w-2xl justify-center gap-5 pb-6 text-xs text-muted-foreground" aria-label="Support"><span className="underline underline-offset-4">Help</span><span className="underline underline-offset-4">Privacy</span></footer>
  </div></div>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><StoreCapture/></QueryClientProvider>);
