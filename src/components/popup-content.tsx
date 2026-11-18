import { ArrowUpRight, Check, CirclePause, Clock3, Settings, WifiOff, AlertCircle, ArrowRight, Folder, Loader2 } from "lucide-react";
import { pendingStatuses, type AppState } from "../../shared/schema";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Brand, ErrorMessage, relativeTime } from "./common";
import { openExternal, openOptions } from "../lib/bridge";
import { useCommand } from "../lib/queries";
import { usesLocalService } from "../lib/service-config";

export function PopupContent({ state }: { state: AppState }) {
  const action = useCommand();
  const pending = state.jobs.filter(job => pendingStatuses.includes(job.status));
  const failures = state.jobs.filter(job => job.status === "attention" || job.status === "checking");
  const needsAttention = !!failures.length || !!state.lastError;
  const latest = [...state.jobs].reverse().find(job => job.result);
  const activeImport = [...pending].reverse().find(job => job.batchId);
  const importJobs = activeImport ? state.jobs.filter(job => job.batchId === activeImport.batchId) : [];
  const authFailure = failures.find(job => job.error?.code === "auth");
  const offline = pending.some(job => job.error?.code === "offline");
  const setup = !state.enabled || !state.destination;
  const title = setup ? "A little less copy and paste." : state.paused ? "Sync is paused" : authFailure ? "Notion needs reconnecting" : state.lastError ? "Sync needs attention" : failures.length ? `${failures.length} ${failures.length === 1 ? "bookmark needs" : "bookmarks need"} attention` : offline ? "Waiting to reconnect" : activeImport ? `Importing your bookmarks` : pending.length ? `Saving ${pending.length} ${pending.length === 1 ? "bookmark" : "bookmarks"}` : "Sync is on";
  const Icon = setup ? ArrowRight : state.paused ? CirclePause : authFailure || needsAttention ? AlertCircle : offline ? WifiOff : pending.length ? Loader2 : Check;
  const primary = setup ? "Set up sync" : state.paused ? "Resume sync" : authFailure ? "Reconnect Notion" : state.lastError ? "Review activity" : failures.length ? "Review failed" : offline ? "View queue" : activeImport ? "View import" : "Open Notion";
  const performPrimary = () => {
    if (setup) openOptions("setup");
    else if (state.paused) action.mutate({ type: "pause", paused: false });
    else if (authFailure) openOptions("settings");
    else if (needsAttention) openOptions(state.lastError ? "activity" : "activity?filter=attention");
    else if (offline || activeImport) openOptions("activity");
    else if (state.destination) openExternal(state.destination.url);
  };
  return <main className="popup-frame px-5 pt-5 pb-3">
    <header className="flex items-center justify-between"><Brand compact/><Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label="Open settings" onClick={() => openOptions()}><Settings className="size-4"/></Button></header>
    <section className="py-7" aria-live="polite">
      <div className={`mb-3 flex size-9 items-center justify-center rounded-full ${setup ? "bg-muted text-primary" : state.paused || failures.length || offline ? "bg-warning-muted text-warning" : "bg-success-muted text-success"}`}><Icon className={`size-4 ${pending.length && !offline && !setup && !failures.length && !state.paused ? "animate-spin" : ""}`} aria-hidden="true"/></div>
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{setup ? "Your Chrome bookmarks, automatically saved to your Notion collection." : state.paused ? "New bookmarks will wait here until you resume." : offline ? usesLocalService ? "Start the local connection service, then try again. Your bookmarks are waiting safely." : "Your bookmarks are waiting safely. Sync will retry when the connection is available." : failures.length ? "Your bookmarks are retained. Open Activity to see what needs fixing." : activeImport ? `${importJobs.filter(job => ["saved", "duplicate", "skipped", "cancelled"].includes(job.status)).length} of ${importJobs.length} processed. You can close this popup.` : latest ? `Last saved ${relativeTime(latest.updatedAt)}` : "Bookmark something in Chrome. We'll take it from here."}</p>
    </section>
    {!setup && state.destination && <><Separator/><section className="space-y-2 py-4"><p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Saving to</p><button onClick={() => openExternal(state.destination!.url)} className="flex w-full items-center justify-between gap-3 text-left"><span className="min-w-0 truncate text-sm font-medium" title={state.destination.name}>{state.destination.name}</span><ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true"/></button><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Folder className="size-3" aria-hidden="true"/>{state.scope.mode === "all" ? "All bookmark folders" : `${state.scope.folderIds.length} selected ${state.scope.folderIds.length === 1 ? "folder" : "folders"}, including subfolders`}</p></section></>}
    {latest && !setup && <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-muted px-3 py-2.5"><Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true"/><div className="min-w-0 flex-1"><button onClick={() => latest.result && openExternal(latest.result.pageUrl)} className="block w-full truncate text-left text-xs font-medium underline decoration-border" title={latest.bookmark.title}>{latest.bookmark.title}</button><span className="text-[11px] text-muted-foreground">{latest.status === "duplicate" ? "Already in Notion" : "Saved to Notion"}</span></div></div>}
    {!!pending.length && !setup && <button className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground" onClick={() => openOptions("activity")}><Clock3 className="size-3"/>{pending.length} waiting{failures.length ? ` · ${failures.length} need attention` : ""}</button>}
    <ErrorMessage error={action.error || state.lastError}/>
    <Button className="mt-1 w-full" disabled={action.isPending} onClick={performPrimary}>{primary}{!state.paused && <ArrowUpRight className="size-4"/>}</Button>
    {!setup && <footer className="mt-2 flex items-center justify-between"><Button variant="ghost" size="sm" className="px-0 text-xs text-muted-foreground" disabled={action.isPending} onClick={() => action.mutate({ type: "pause", paused: !state.paused })}>{state.paused ? "Resume sync" : "Pause sync"}</Button><Button variant="ghost" size="sm" className="px-0 text-xs text-muted-foreground" onClick={() => openOptions("activity")}>Activity<ArrowRight className="size-3"/></Button></footer>}
  </main>;
}
