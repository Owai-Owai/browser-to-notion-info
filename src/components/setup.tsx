import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Link2, ShieldCheck } from "lucide-react";
import { configuredDestinationSchema, type AppState, type Destination, type Draft, type ImportPreview } from "../../shared/schema";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Separator } from "./ui/separator";
import { FolderPicker } from "./folder-picker";
import { PropertyMapping } from "./property-mapping";
import { TemplateChoice } from "./template-choice";
import { suggestMapping } from "../lib/property-mapping";
import { isOriginalTemplateLink } from "../../shared/notion-template";
import { BusyLabel, ErrorMessage } from "./common";
import { useCommand } from "../lib/queries";
import { request } from "../lib/bridge";

const steps = ["Connect", "Destination", "Folders", "Review"];

export function Setup({ state, finish }: { state: AppState; finish: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => ({ ...state.draft, step: Math.min(state.draft.step, 3) }));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ key: string; value: ImportPreview }>();
  const [discardPending, setDiscardPending] = useState(false);
  const action = useCommand();
  const useTemplate = draft.setupMethod === "template";
  const canConnect = !useTemplate || draft.templateCopied === true;
  const destination = draft.destinations.find(item => item.id === draft.selectedDestinationId);
  const parsed = configuredDestinationSchema.safeParse(destination ? { ...destination, mapping: draft.mapping } : undefined);
  const previewKey = JSON.stringify([draft.scope, parsed.success ? parsed.data : null]);
  const previewValue = preview?.key === previewKey ? preview.value : undefined;
  const pending = state.jobs.filter(job => ["queued", "saving", "retry", "checking", "attention"].includes(job.status));
  const destinationChanged = state.destination && destination?.id !== state.destination.id;
  const templateMapped = useTemplate && !!draft.mapping.titleId && !!draft.mapping.urlId && !!draft.mapping.folderId && !!draft.mapping.dateId && !!draft.mapping.statusId && !!draft.mapping.statusValue;
  const defaultStatusName = destination?.properties.find(property => property.id === draft.mapping.statusId)?.options.find(option => option.id === draft.mapping.statusValue)?.name;
  const canContinue = draft.step === 0 ? !!state.connection && canConnect : draft.step === 1 ? parsed.success && (!draft.mapping.statusId || !!draft.mapping.statusValue) : draft.scope.mode === "all" || !!draft.scope.folderIds.length;

  useEffect(() => {
    const timer = setTimeout(() => { void request({ type: "draft", draft }).catch((error: unknown) => setError(error instanceof Error ? error.message : "Could not save setup progress.")); }, 200);
    return () => clearTimeout(timer);
  }, [draft]);

  const run = async (task: () => Promise<unknown>) => {
    setBusy(true); setError(undefined);
    try { await task(); } catch (error) { setError(error instanceof Error ? error.message : "The action could not be completed."); }
    finally { setBusy(false); }
  };
  const resolve = () => run(async () => {
    if (isOriginalTemplateLink(draft.link.trim())) throw new Error("This is the public starter template. Duplicate it into your own workspace, then open Bookmarks in your copy and paste that database's link.");
    const destinations = await request<Destination[]>({ type: "resolve", link: draft.link.trim() });
    const first = destinations[0];
    setDraft({ ...draft, destinations, selectedDestinationId: destinations.length === 1 ? first.id : "", mapping: destinations.length === 1 ? suggestMapping(first, useTemplate) : {} });
  });
  const next = () => { setError(undefined); setDraft({ ...draft, step: draft.step + 1 }); };

  return <main className="setup-panel">
    <nav aria-label="Setup progress" className="mb-10 grid grid-cols-4 gap-2">
      {steps.map((label, index) => <div key={label} aria-current={draft.step === index ? "step" : undefined} className="space-y-2"><div className={`h-1 rounded-full ${index <= draft.step ? "bg-primary" : "bg-border"}`}/><span className={`flex items-center gap-1 text-xs ${index === draft.step ? "font-medium text-foreground" : "text-muted-foreground"}`}>{index < draft.step ? <Check className="size-3" aria-hidden="true"/> : `${index + 1}.`}{label}</span></div>)}
    </nav>
    <div className="quiet-panel space-y-7">
      {draft.step === 0 && <>
        <div className="space-y-2"><span className="mb-4 flex size-11 items-center justify-center rounded-xl border bg-background font-serif text-2xl font-bold" aria-hidden="true">N</span><h1 className="section-heading">A home for your bookmarks.</h1><p className="field-help">Connect Notion once. Your new Chrome bookmarks will follow you there.</p></div>
        <TemplateChoice method={draft.setupMethod ?? "existing"} copied={draft.templateCopied === true} onMethodChange={setupMethod => setDraft({ ...draft, setupMethod, templateCopied: false, link: "", destinations: [], selectedDestinationId: "", mapping: {} })} onCopiedChange={templateCopied => setDraft({ ...draft, templateCopied })}/>
        {state.connection ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-success-muted p-4"><div className="flex items-center gap-3"><CheckCircle2 className="size-5 text-success" aria-hidden="true"/><div><p className="text-sm font-medium">Notion connected</p><p className="text-sm text-muted-foreground">{state.connection.workspaceName}</p></div></div>{useTemplate && <Button variant="outline" size="sm" disabled={busy || !canConnect} onClick={() => void run(async () => { await action.mutateAsync({ type: "connect" }); setDraft({ ...draft, step: 1 }); })}>Refresh access</Button>}</div> : <Button className="w-full" disabled={busy || !canConnect} onClick={() => void run(async () => { await action.mutateAsync({ type: "connect" }); setDraft({ ...draft, step: 1 }); })}>{busy ? <BusyLabel>Connecting…</BusyLabel> : <>Connect Notion<ArrowRight className="size-4"/></>}</Button>}
        <div className="flex gap-3 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true"/><p>Selected bookmark details pass through our connection service to your Notion database. Website content and browsing history aren't read.</p></div>
      </>}
      {draft.step === 1 && <>
        <div className="space-y-2"><h1 className="section-heading">{useTemplate ? "Connect your template copy." : "Where should they go?"}</h1><p className="field-help">{useTemplate ? "Open Bookmarks inside your own copy, then paste that database's link below." : "Paste the link to your Notion board or database."}</p></div>
        <div className="field-group"><Label htmlFor="destination-link">Notion destination link</Label><div className="flex gap-2"><div className="relative min-w-0 flex-1"><Link2 className="absolute top-3 left-3 size-4 text-muted-foreground" aria-hidden="true"/><Input id="destination-link" type="url" placeholder="https://notion.so/…" className="pl-9" value={draft.link} onChange={event => setDraft({ ...draft, link: event.target.value, destinations: [], selectedDestinationId: "" })} onKeyDown={event => { if (event.key === "Enter") void resolve(); }}/></div><Button variant="outline" disabled={!draft.link.trim() || busy} onClick={() => void resolve()}>{busy ? <BusyLabel>Checking</BusyLabel> : "Check link"}</Button></div></div>
        {draft.destinations.length > 1 && <div className="field-group"><Label htmlFor="data-source">Choose a data source</Label><Select value={draft.selectedDestinationId} onValueChange={id => { const selected = draft.destinations.find(item => item.id === id)!; setDraft({ ...draft, selectedDestinationId: id, mapping: suggestMapping(selected, useTemplate) }); }}><SelectTrigger id="data-source" className="w-full"><SelectValue placeholder="Choose a collection"/></SelectTrigger><SelectContent>{draft.destinations.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>}
        {destination && <><div className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true"/><span className="min-w-0 truncate font-medium" title={destination.name}>{destination.name}</span><span className="text-muted-foreground">found</span></div><Separator/>{templateMapped ? <div className="space-y-4"><div className="rounded-lg bg-success-muted p-4"><p className="flex items-center gap-2 text-sm font-medium text-success"><CheckCircle2 className="size-4" aria-hidden="true"/>Template fields matched</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Title, URL, folder, and bookmark date are ready. New bookmarks start in <strong className="font-medium text-foreground">{defaultStatusName}</strong>.</p></div><details><summary className="w-fit text-sm text-muted-foreground">Customize property mappings</summary><div className="mt-4"><PropertyMapping destination={destination} value={draft.mapping} onChange={mapping => setDraft({ ...draft, mapping })}/></div></details></div> : <div className="space-y-4"><div><h2 className="text-sm font-medium">{useTemplate ? "Review your template fields" : "Match your Notion properties"}</h2><p className="mt-1 field-help">{useTemplate ? "Some starter fields have changed. Choose the properties you'd like to use." : "We only use the fields you choose."}</p></div><PropertyMapping destination={destination} value={draft.mapping} onChange={mapping => setDraft({ ...draft, mapping })}/></div>}<p className="text-xs leading-relaxed text-muted-foreground">Board filters can hide a saved entry. Use an optional default status to place it in a group, or open its direct link from Activity.</p></>}
      </>}
      {draft.step === 2 && <><div className="space-y-2"><h1 className="section-heading">Choose what comes along.</h1><p className="field-help">Use your existing Chrome folders. Everything else stays in your browser.</p></div><FolderPicker value={draft.scope} onChange={scope => setDraft({ ...draft, scope })}/></>}
      {draft.step === 3 && <>
        <div className="space-y-2"><h1 className="section-heading">Ready when you are.</h1><p className="field-help">New bookmarks will save automatically after you enable sync.</p></div>
        <dl className="space-y-4 text-sm"><div className="flex items-start justify-between gap-6"><dt className="text-muted-foreground">Saving to</dt><dd className="max-w-72 text-right font-medium break-words">{destination?.name}</dd></div><div className="flex justify-between gap-6"><dt className="text-muted-foreground">From</dt><dd className="text-right">{draft.scope.mode === "all" ? "All bookmark folders" : `${draft.scope.folderIds.length} selected ${draft.scope.folderIds.length === 1 ? "folder" : "folders"}`}</dd></div></dl>
        <Separator/>
        <div className="flex items-start gap-3"><Checkbox id="existing-import" checked={draft.importExisting} onCheckedChange={checked => setDraft({ ...draft, importExisting: checked === true })}/><div className="space-y-1"><Label htmlFor="existing-import">Import my existing bookmarks too</Label><p className="field-help">Optional. You'll review the count before anything is added.</p></div></div>
        {draft.importExisting && <div className="rounded-lg border p-4">{previewValue ? <div className="space-y-2 text-sm"><p className="font-medium">{previewValue.toSave} new websites to save</p><p className="text-muted-foreground">{previewValue.alreadyPresent} already present or repeated · {previewValue.unsupported} unsupported</p></div> : <Button variant="outline" disabled={busy || !parsed.success} onClick={() => void run(async () => { if (parsed.success) setPreview({ key: previewKey, value: await request<ImportPreview>({ type: "preview", scope: draft.scope, destination: parsed.data }) }); })}>{busy ? <BusyLabel>Checking existing bookmarks…</BusyLabel> : "Preview import"}</Button>}</div>}
        {destinationChanged && pending.length > 0 && <div className="space-y-3 rounded-lg border border-warning p-4 text-sm"><p>{pending.length} pending bookmarks belong to your previous destination. Finish them first, or discard their unsent work.</p><div className="flex items-center gap-2"><Checkbox id="discard-pending" checked={discardPending} onCheckedChange={value => setDiscardPending(value === true)}/><Label htmlFor="discard-pending">Discard pending work</Label></div></div>}
        <p className="text-xs leading-relaxed text-muted-foreground">This saves a snapshot of each bookmark. Later edits and deletions in Chrome won't change entries already saved in Notion.</p>
      </>}
      <ErrorMessage error={error}/>
      {error && useTemplate && draft.step === 1 && <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(async () => { await action.mutateAsync({ type: "connect" }); })}>Refresh Notion access</Button>}
      {(draft.step > 0 || state.connection) && <div className="flex justify-between gap-3 border-t pt-5">
        <Button variant="ghost" disabled={busy} onClick={() => draft.step === 0 ? finish() : setDraft({ ...draft, step: draft.step - 1 })}><ArrowLeft className="size-4"/>{draft.step === 0 ? "Close" : "Back"}</Button>
        {draft.step < 3 ? <Button disabled={!canContinue || busy} onClick={next}>Continue<ArrowRight className="size-4"/></Button> : <Button disabled={busy || !parsed.success || (draft.importExisting && !previewValue) || (!!destinationChanged && pending.length > 0 && !discardPending)} onClick={() => void run(async () => { if (parsed.success) { await action.mutateAsync({ type: "configure", scope: draft.scope, destination: parsed.data, importExisting: draft.importExisting, discardPending }); finish(); } })}>{busy ? <BusyLabel>Enabling…</BusyLabel> : draft.importExisting ? "Enable sync and import" : "Enable sync"}</Button>}
      </div>}
    </div>
    {state.enabled && <Button variant="link" className="mt-4 text-muted-foreground" onClick={finish}>Return to settings</Button>}
    <p className="mt-6 text-center text-xs text-muted-foreground">Your Chrome bookmarks stay yours. We never change or remove them.</p>
  </main>;
}
