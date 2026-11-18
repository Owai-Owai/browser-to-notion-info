import type { AppState } from "../../shared/schema";
import { useCommand } from "../lib/queries";
import { openExternal } from "../lib/bridge";
import { privacyURL, usageSupported } from "../lib/service-config";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { ErrorMessage } from "./common";

export function UsageSharing({ state }: { state: AppState }) {
  const action = useCommand();
  if (!usageSupported) return null;
  return <div className="space-y-3">
    <div className="flex items-start gap-3"><Checkbox id="usage-sharing" checked={state.usage.enabled} disabled={action.isPending} aria-describedby="usage-sharing-description" onCheckedChange={enabled => action.mutate({ type: "usage", enabled: enabled === true })}/><div className="space-y-1"><Label htmlFor="usage-sharing">Share optional usage data</Label><p id="usage-sharing-description" className="field-help">Help improve the extension with PostHog. Shares save outcomes and feature use under a random ID. No bookmark details or Notion content. Turn off any time.</p><button className="text-xs text-muted-foreground underline underline-offset-4" onClick={() => openExternal(privacyURL)}>Privacy policy</button></div></div>
    {state.usage.installationId && <details><summary className="w-fit text-xs text-muted-foreground">Usage data ID</summary><p className="mt-2 break-all text-xs text-muted-foreground">{state.usage.installationId}</p><p className="mt-1 text-xs text-muted-foreground">Include this ID in a request to delete previously shared usage data.</p></details>}
    <ErrorMessage error={action.error}/>
  </div>;
}
