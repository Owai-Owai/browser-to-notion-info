import { useState } from "react";
import { ArrowUpRight, CheckCircle2, ChevronRight, Folder, Download, Unplug } from "lucide-react";
import type { AppState, ImportPreview } from "../../shared/schema";
import { Button } from "./ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { FolderPicker } from "./folder-picker";
import { BusyLabel, ErrorMessage } from "./common";
import { openExternal, request } from "../lib/bridge";
import { useCommand } from "../lib/queries";
import { UsageSharing } from "./usage-sharing";

export function SettingsContent({ state, navigate }: { state: AppState; navigate: (route: string) => void }) {
  const action = useCommand();
  const [showImport, setShowImport] = useState(false);
  const edit = async (step: number) => {
    if (!state.destination) return;
    await action.mutateAsync({ type: "draft", draft: { step, link: state.destination.url, destinations: [state.destination], selectedDestinationId: state.destination.id, mapping: state.destination.mapping, scope: state.scope, importExisting: false } });
    navigate("setup");
  };
  return <main className="mx-auto mt-12 max-w-2xl space-y-8">
    <div><h1 className="text-2xl font-semibold tracking-tight">Your bookmark connection.</h1><p className="mt-2 field-help">Set once. Let your bookmarks find their way.</p></div>
    <section className="quiet-panel space-y-6" aria-label="Notion connection">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg border font-serif text-2xl font-bold" aria-hidden="true">N</span><div><p className="text-sm font-medium">{state.connection?.workspaceName}</p><p className="mt-1 flex items-center gap-1 text-xs text-success"><CheckCircle2 className="size-3" aria-hidden="true"/>Connected to Notion</p></div></div><Button variant="outline" size="sm" disabled={action.isPending} onClick={() => action.mutate({ type: "connect" })}>Reconnect</Button></div>
      <div className="border-t pt-5"><div className="flex items-start justify-between gap-6"><div className="min-w-0"><p className="mb-1.5 text-xs text-muted-foreground">Destination</p><button className="flex max-w-full items-center gap-1.5 text-sm font-medium" onClick={() => state.destination && openExternal(state.destination.url)}><span className="truncate" title={state.destination?.name}>{state.destination?.name}</span><ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true"/></button></div><Button variant="ghost" size="sm" onClick={() => void edit(1).catch(() => undefined)}>Change<ChevronRight className="size-3"/></Button></div></div>
      <div className="flex items-start justify-between gap-6 border-t pt-5"><div><p className="mb-1.5 text-xs text-muted-foreground">Bookmark folders</p><p className="flex items-center gap-2 text-sm"><Folder className="size-4 text-muted-foreground" aria-hidden="true"/>{state.scope.mode === "all" ? "All bookmark folders" : `${state.scope.folderIds.length} selected ${state.scope.folderIds.length === 1 ? "folder" : "folders"}`}</p><p className="mt-1 text-xs text-muted-foreground">Subfolders included</p></div><Button variant="ghost" size="sm" onClick={() => void edit(2).catch(() => undefined)}>Change<ChevronRight className="size-3"/></Button></div>
      <div className="flex items-start justify-between gap-6 border-t pt-5"><div><p className="mb-1.5 text-xs text-muted-foreground">Property mappings</p><p className="text-sm">Title and URL{state.destination?.mapping.folderId ? ", folder" : ""}{state.destination?.mapping.dateId ? ", date" : ""}{state.destination?.mapping.statusId ? ", status" : ""}</p></div><Button variant="ghost" size="sm" onClick={() => void edit(1).catch(() => undefined)}>Edit<ChevronRight className="size-3"/></Button></div>
    </section>
    <section className="quiet-panel"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-sm font-medium">Bring your existing bookmarks</h2><p className="mt-1 max-w-sm field-help">Review a folder collection and save the websites you've already gathered.</p></div><Button variant="outline" size="sm" onClick={() => setShowImport(!showImport)} aria-expanded={showImport}><Download className="size-3.5"/>Import bookmarks</Button></div>{showImport && <div className="mt-6 border-t pt-6"><ImportPanel state={state} complete={() => navigate("activity")}/></div>}</section>
    <div className="flex flex-wrap items-start justify-between gap-4"><p className="max-w-md text-xs leading-relaxed text-muted-foreground">Sync saves bookmark snapshots. Changes or deletions after a successful save won't change your Notion entries.</p><Button variant="outline" size="sm" disabled={action.isPending} onClick={() => action.mutate({ type: "pause", paused: !state.paused })}>{state.paused ? "Resume sync" : "Pause sync"}</Button></div>
    <UsageSharing state={state}/>
    <ErrorMessage error={action.error}/>
    <div className="space-y-3 border-t pt-5"><details><summary className="w-fit text-xs text-muted-foreground">Activity history</summary><p className="mt-3 text-xs leading-relaxed text-muted-foreground">Clearing completed history frees local space. Pending and failed work is preserved; entries in Notion stay there.</p><Button variant="outline" size="sm" className="mt-3" disabled={action.isPending} onClick={() => action.mutate({ type: "clearHistory" })}>Clear completed history</Button></details><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="px-0 text-muted-foreground"><Unplug className="size-3.5"/>Disconnect and delete extension data</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Disconnect from Notion?</AlertDialogTitle><AlertDialogDescription>This removes your connection credentials, settings, and unsent bookmarks. Entries already saved in Notion stay there. A working connection is needed to finish deleting service records.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep connection</AlertDialogCancel><AlertDialogAction onClick={() => action.mutate({ type: "disconnect" })}>Disconnect</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
  </main>;
}

function ImportPanel({ state, complete }: { state: AppState; complete: () => void }) {
  const [scope, setScope] = useState(state.scope);
  const [preview, setPreview] = useState<ImportPreview>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const check = async () => {
    if (!state.destination) return;
    setBusy(true); setError(undefined);
    try { setPreview(await request({ type: "preview", scope, destination: state.destination })); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not check the import."); }
    finally { setBusy(false); }
  };
  const start = async () => {
    setBusy(true); setError(undefined);
    try { await request({ type: "import", scope }); complete(); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not start the import."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5"><FolderPicker value={scope} onChange={value => { setScope(value); setPreview(undefined); }}/>{preview && <div className="rounded-lg bg-muted p-4 text-sm"><p className="font-medium">{preview.toSave} new websites to save</p><p className="mt-1 text-muted-foreground">{preview.alreadyPresent} already present or repeated · {preview.unsupported} unsupported</p><p className="mt-2 text-xs text-muted-foreground">Destination: {state.destination?.name}</p></div>}<ErrorMessage error={error}/><Button disabled={busy || (scope.mode === "selected" && !scope.folderIds.length)} onClick={() => void (preview ? start() : check())}>{busy ? <BusyLabel>{preview ? "Starting…" : "Checking…"}</BusyLabel> : preview ? "Start import" : "Preview import"}</Button></div>;
}
