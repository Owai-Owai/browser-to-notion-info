import { ArrowUpRight, Copy, Check } from "lucide-react";
import { notionTemplate } from "../../shared/notion-template";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { openExternal } from "../lib/bridge";

export type SetupMethod = "template" | "existing";

/** A starter is duplicated before OAuth so the user can grant access to their copy. */
export function TemplateChoice({ method, copied, onMethodChange, onCopiedChange }: {
  method: SetupMethod; copied: boolean;
  onMethodChange: (method: SetupMethod) => void; onCopiedChange: (copied: boolean) => void;
}) {
  return <div className="space-y-5">
    <RadioGroup value={method} onValueChange={value => onMethodChange(value as SetupMethod)} aria-label="How would you like to set up Notion?" className="gap-2">
      <Label htmlFor="method-template" className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 ${method === "template" ? "border-primary bg-success-muted/30" : ""}`}>
        <RadioGroupItem id="method-template" value="template" className="mt-0.5"/>
        <span className="min-w-0 space-y-1"><span className="flex flex-wrap items-center gap-2 text-sm font-medium">Use the Notion template<span className="rounded bg-success-muted px-1.5 py-0.5 text-[10px] font-medium text-success">Recommended</span></span><span className="block text-xs leading-relaxed font-normal text-muted-foreground">A ready-made bookmark database. No fields to create.</span></span>
      </Label>
      <Label htmlFor="method-existing" className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 ${method === "existing" ? "border-primary bg-success-muted/30" : ""}`}>
        <RadioGroupItem id="method-existing" value="existing" className="mt-0.5"/>
        <span className="space-y-1"><span className="block text-sm font-medium">Use my existing database</span><span className="block text-xs leading-relaxed font-normal text-muted-foreground">Connect a collection you've already set up.</span></span>
      </Label>
    </RadioGroup>
    {method === "template" && <div className="space-y-3 rounded-lg bg-muted p-4">
      <Button variant="outline" className="w-full bg-background" onClick={() => openExternal(notionTemplate.url)}><Copy className="size-4"/>Get the Notion template<ArrowUpRight className="size-3.5"/></Button>
      <p className="text-xs leading-relaxed text-muted-foreground">In Notion, choose <strong className="font-medium text-foreground">Duplicate</strong> at the top right and add it to your workspace. Then come back here.</p>
      <div className="flex items-start gap-2.5"><Checkbox id="template-copied" checked={copied} onCheckedChange={checked => onCopiedChange(checked === true)}/><Label htmlFor="template-copied" className="text-xs leading-relaxed font-normal">I've duplicated the template into my workspace.</Label>{copied && <Check className="size-3.5 shrink-0 text-success" aria-hidden="true"/>}</div>
    </div>}
  </div>;
}
