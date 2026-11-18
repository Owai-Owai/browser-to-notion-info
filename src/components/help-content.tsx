import { ArrowUpRight, ArrowLeft } from "lucide-react";
import { notionTemplate } from "../../shared/notion-template";
import { Button } from "./ui/button";
import { openExternal } from "../lib/bridge";
import { privacyURL, usesLocalService } from "../lib/service-config";

/** Task-focused help is available before connecting, without crowding setup. */
export function HelpContent({ privacy = false, back }: { privacy?: boolean; back: () => void }) {
  return <main className="mx-auto mt-12 max-w-2xl space-y-6">
    <Button variant="ghost" size="sm" className="-ml-3 text-muted-foreground" onClick={back}><ArrowLeft className="size-4"/>Back</Button>
    <div><h1 className="text-2xl font-semibold tracking-tight">{privacy ? "Your data, explained." : "A little help getting started."}</h1><p className="mt-2 field-help">{privacy ? "Bookmark details are used to save the websites you choose to Notion." : "Connect your collection once, then bookmark as usual."}</p></div>
    {privacy ? <section className="quiet-panel space-y-5 text-sm leading-relaxed" aria-label="Privacy information">
      <div><h2 className="font-medium">What is used</h2><p className="mt-1 text-muted-foreground">Bookmark titles, URLs, selected folder paths, and bookmark dates. Your extension settings, connection session, and save activity are stored in your Chrome profile.</p></div>
      <div><h2 className="font-medium">Where it goes</h2><p className="mt-1 text-muted-foreground">Selected bookmark details pass through {usesLocalService ? "the connection service on your computer" : "our hosted connection service"} to the Notion database you authorize. The service stores encrypted Notion credentials and save identifiers to reconnect and prevent duplicate saves. Website content and browsing history aren't read.</p></div>
      {!usesLocalService && <div><h2 className="font-medium">Optional usage sharing</h2><p className="mt-1 text-muted-foreground">Off by default. If you opt in, PostHog receives save outcomes and feature events under a random installation ID, without bookmark details or Notion content. No session recordings or automatic interaction capture. Turn it off in Settings to clear unsent events and stop collection. Previously shared data remains; copy your Usage data ID before disconnecting and contact support to request deletion.</p></div>}
      <div><h2 className="font-medium">Your controls</h2><p className="mt-1 text-muted-foreground">Choose which folders sync, pause at any time, clear completed activity, or disconnect and delete extension data in Settings. Entries already saved in Notion remain under your control there.</p></div>
      <div><h2 className="font-medium">Retention</h2><p className="mt-1 text-muted-foreground">Completed activity in Chrome expires after 30 days; pending work remains. Service credentials and save records expire after 90 days without use. Disconnecting removes active service records when the connection is available. Backup retention is described in the published privacy policy.</p></div>
      {!usesLocalService && <Button variant="outline" onClick={() => openExternal(privacyURL)}>Read the privacy policy<ArrowUpRight className="size-3.5"/></Button>}
    </section> : <section className="quiet-panel divide-y" aria-label="Common questions">
      <details className="pb-4" open><summary className="text-sm font-medium">How do I set up my database?</summary><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Use the starter template for a ready-made collection. Duplicate it into your workspace, connect Notion, then paste the Bookmarks database link from your copy.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => openExternal(notionTemplate.url)}>Open starter template<ArrowUpRight className="size-3.5"/></Button></details>
      <details className="py-4"><summary className="text-sm font-medium">Why can't Notion find my database?</summary><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Reconnect Notion and select the database or its parent page in the access picker. For a linked board, open the source database and copy its link. Always use your own template copy.</p></details>
      <details className="py-4"><summary className="text-sm font-medium">Will this import all my bookmarks?</summary><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Sync starts with new bookmarks in the folders you choose. Importing existing bookmarks is optional, and you can review the count before starting.</p></details>
      <details className="py-4"><summary className="text-sm font-medium">What happens when a save is waiting?</summary><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Your queue stays in Chrome until the connection is available. Keep Chrome open for sync to run. Open Activity to review any bookmark that needs attention.</p>{usesLocalService && <p className="mt-2 text-sm text-muted-foreground">For this local installation, start the local connection service, then try again.</p>}</details>
      <details className="pt-4"><summary className="text-sm font-medium">Can I change or remove saved entries?</summary><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Manage saved entries in Notion. Editing or deleting a Chrome bookmark won't change a snapshot that's already saved.</p></details>
    </section>}
  </main>;
}
