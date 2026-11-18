import { ChevronDown, ArrowRight } from "lucide-react";
import type { Destination, Draft, Mapping } from "../../shared/schema";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { Button } from "./ui/button";

export function PropertyMapping({ destination, value, onChange }: { destination: Destination; value: Draft["mapping"]; onChange: (mapping: Draft["mapping"]) => void }) {
  const row = (label: string, key: keyof Mapping, types: string[], required = false) => {
    const options = destination.properties.filter(property => types.includes(property.type));
    return <div className="grid grid-cols-[1fr_auto_1.2fr] items-center gap-3">
      <Label htmlFor={`mapping-${key}`} className="text-sm font-normal">{label}</Label><ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true"/>
      <Select value={value[key] || "none"} onValueChange={id => onChange({ ...value, [key]: id === "none" ? undefined : id, ...(key === "statusId" ? { statusValue: undefined } : {}) })}>
        <SelectTrigger id={`mapping-${key}`} className="w-full"><SelectValue placeholder="Choose property"/></SelectTrigger>
        <SelectContent><SelectItem value="none">{required ? "Choose property" : "Don't include"}</SelectItem>{options.map(property => <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>)}</SelectContent>
      </Select>
    </div>;
  };
  const status = destination.properties.find(property => property.id === value.statusId);
  return <div className="space-y-4">
    <div className="space-y-3 rounded-lg border p-4">{row("Bookmark title", "titleId", ["title"], true)}{row("Website URL", "urlId", ["url"], true)}</div>
    {!destination.properties.some(property => property.type === "url") && <p className="text-sm text-destructive" role="alert">Add a URL property to this database in Notion, then check the link again.</p>}
    <Collapsible defaultOpen={!!value.folderId || !!value.dateId || !!value.statusId}>
      <CollapsibleTrigger asChild><Button variant="ghost" className="h-auto w-full justify-between px-0 py-2 text-sm text-muted-foreground">Additional fields{[value.folderId, value.dateId, value.statusId].some(Boolean) ? " · configured" : " · optional"}<ChevronDown className="size-4"/></Button></CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-3">{row("Folder path", "folderId", ["rich_text"])}{row("Bookmarked date", "dateId", ["date"])}{row("Default status", "statusId", ["status", "select"])}
        {status && <div className="field-group"><Label htmlFor="status-value">New bookmarks go to</Label><Select value={value.statusValue ?? ""} onValueChange={statusValue => onChange({ ...value, statusValue })}><SelectTrigger id="status-value" className="w-full"><SelectValue placeholder="Choose an existing value"/></SelectTrigger><SelectContent>{status.options.map(option => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent></Select></div>}
      </CollapsibleContent>
    </Collapsible>
  </div>;
}
