import { useState } from "react";
import { ChevronDown, ChevronRight, Folder, Search } from "lucide-react";
import type { FolderNode, Scope } from "../../shared/schema";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Button } from "./ui/button";
import { useFolders } from "../lib/queries";
import { ErrorMessage } from "./common";

export function FolderPicker({ value, onChange }: { value: Scope; onChange: (scope: Scope) => void }) {
  const folders = useFolders();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string[]>(["1", "2"]);
  const allIds = (node: FolderNode): string[] => [node.id, ...node.children.flatMap(allIds)];
  const matches = (node: FolderNode): boolean => node.title.toLowerCase().includes(search.toLowerCase()) || node.children.some(matches);
  const render = (node: FolderNode, inherited: boolean, level: number) => {
    if (search && !matches(node) && !inherited) return null;
    const selected = value.folderIds.includes(node.id);
    const mixed = !selected && allIds(node).some(id => value.folderIds.includes(id));
    const open = search || expanded.includes(node.id);
    return <div key={node.id}>
      <div className="flex min-h-10 items-center gap-2 rounded-md px-2 hover:bg-muted" style={{ paddingLeft: `${level * 18 + 8}px` }}>
        {node.children.length ? <Button variant="ghost" size="icon" className="size-6 shrink-0" aria-label={`${open ? "Collapse" : "Expand"} ${node.title}`} aria-expanded={!!open} onClick={() => setExpanded(ids => ids.includes(node.id) ? ids.filter(id => id !== node.id) : [...ids, node.id])}>{open ? <ChevronDown className="size-3.5"/> : <ChevronRight className="size-3.5"/>}</Button> : <span className="size-6 shrink-0"/>}
        <Checkbox id={`folder-${node.id}`} disabled={inherited} checked={inherited || selected ? true : mixed ? "indeterminate" : false} onCheckedChange={checked => {
          const remove = new Set(allIds(node));
          onChange({ ...value, folderIds: [...value.folderIds.filter(id => !remove.has(id)), ...(checked ? [node.id] : [])] });
        }}/>
        <Folder className="size-4 shrink-0 text-muted-foreground" aria-hidden="true"/>
        <Label htmlFor={`folder-${node.id}`} className="min-w-0 flex-1 truncate text-sm font-normal" title={node.title}>{node.title}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">{node.bookmarkCount}</span>
      </div>
      {!!open && node.children.map(child => render(child, inherited || selected, level + 1))}
    </div>;
  };
  return <div className="space-y-4">
    <RadioGroup value={value.mode} onValueChange={mode => onChange({ ...value, mode: mode as Scope["mode"] })} aria-label="Bookmark folder scope" className="gap-3">
      <div className="flex items-center gap-3"><RadioGroupItem value="all" id="scope-all"/><Label htmlFor="scope-all">All bookmark folders</Label></div>
      <div className="flex items-center gap-3"><RadioGroupItem value="selected" id="scope-selected"/><Label htmlFor="scope-selected">Selected folders</Label></div>
    </RadioGroup>
    {value.mode === "selected" && <div className="overflow-hidden rounded-lg border bg-background">
      <div className="relative border-b"><Search className="absolute top-3 left-3 size-4 text-muted-foreground" aria-hidden="true"/><Input aria-label="Search bookmark folders" placeholder="Find a folder…" value={search} onChange={event => setSearch(event.target.value)} className="rounded-none border-0 pl-9 shadow-none"/></div>
      <div className="max-h-64 overflow-y-auto p-2" aria-label="Bookmark folders">
        {folders.isPending ? <p className="p-3 text-sm text-muted-foreground">Loading your folders…</p> : folders.error ? <ErrorMessage error={folders.error}/> : !folders.data?.length ? <p className="p-3 text-sm text-muted-foreground">Create a bookmark folder in Chrome, then return here.</p> : !folders.data.some(matches) ? <p className="p-3 text-sm text-muted-foreground">No matching folders. Try another name.</p> : folders.data.map(node => render(node, false, 0))}
      </div>
    </div>}
    <p className="field-help">{value.mode === "all" ? "New bookmarks in any folder will be included." : `${value.folderIds.length} selected ${value.folderIds.length === 1 ? "folder" : "folders"}. Selecting a folder includes all its subfolders.`}</p>
  </div>;
}
