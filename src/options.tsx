import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Brand, ErrorMessage, LoadingState, PreviewBanner } from "./components/common";
import { Setup } from "./components/setup";
import { SettingsContent } from "./components/settings-content";
import { Activity } from "./components/activity";
import { HelpContent } from "./components/help-content";
import { Button } from "./components/ui/button";
import { queryClient, useSyncState } from "./lib/queries";
import { openExternal } from "./lib/bridge";
import "./styles.css";

function Options() {
  const state = useSyncState();
  const [route, setRoute] = useState(location.hash.slice(1) || "settings");
  const [contentRoute, setContentRoute] = useState(route === "help" || route === "privacy" ? "settings" : route);
  const navigate = (next: string) => { location.hash = next; };
  useEffect(() => { const change = () => { const next = location.hash.slice(1) || "settings"; setRoute(next); if (next !== "help" && next !== "privacy") setContentRoute(next); }; window.addEventListener("hashchange", change); return () => window.removeEventListener("hashchange", change); }, []);
  const support = route === "help" || route === "privacy";
  const setup = !state.data?.enabled || contentRoute === "setup";
  return <div className="settings-page"><PreviewBanner/><div className="settings-shell"><header className="flex flex-wrap items-center justify-between gap-4"><Brand/>{state.data?.enabled && <nav className="flex items-center gap-1" aria-label="Extension settings"><Button variant="ghost" size="sm" aria-current={route === "settings" ? "page" : undefined} className={route === "settings" ? "bg-muted" : "text-muted-foreground"} onClick={() => navigate("settings")}>Settings</Button><Button variant="ghost" size="sm" aria-current={route.startsWith("activity") ? "page" : undefined} className={route.startsWith("activity") ? "bg-muted" : "text-muted-foreground"} onClick={() => navigate("activity")}>Activity</Button><Button variant="ghost" size="icon" aria-label="Open your Notion destination" className="size-8 text-muted-foreground" onClick={() => state.data?.destination && openExternal(state.data.destination.url)}><ExternalLink className="size-4"/></Button></nav>}</header>
      {support && <HelpContent privacy={route === "privacy"} back={() => navigate(contentRoute)}/>}
      <div hidden={support}>{state.isPending ? <LoadingState/> : state.error ? <div className="mt-8"><ErrorMessage error={state.error}/><Button variant="outline" className="mt-4" onClick={() => void state.refetch()}>Try again</Button></div> : setup ? <Setup state={state.data} finish={() => navigate("settings")}/> : contentRoute.startsWith("activity") ? <Activity key={contentRoute} state={state.data} initialFilter={new URLSearchParams(contentRoute.split("?")[1]).get("filter") ?? "all"}/> : <SettingsContent state={state.data} navigate={navigate}/>}</div>
      <footer className="mx-auto mt-8 flex max-w-2xl justify-center gap-5 pb-6 text-xs text-muted-foreground" aria-label="Support"><button className="underline underline-offset-4" aria-current={route === "help" ? "page" : undefined} onClick={() => navigate("help")}>Help</button><button className="underline underline-offset-4" aria-current={route === "privacy" ? "page" : undefined} onClick={() => navigate("privacy")}>Privacy</button></footer>
    </div></div>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><QueryClientProvider client={queryClient}><Options/></QueryClientProvider></StrictMode>);
