import { Bookmark, AlertCircle, ArrowUpRight, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Alert, AlertDescription } from "./ui/alert";
import { Skeleton } from "./ui/skeleton";
import { isExtension } from "../lib/bridge";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-2.5"><span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Bookmark className="size-4" aria-hidden="true" /></span><span className={compact ? "text-sm font-semibold tracking-tight" : "text-base font-semibold tracking-tight"}>Browser to Notion</span></div>;
}
export function ErrorMessage({ error }: { error?: Error | string | null }) {
  if (!error) return null;
  return <Alert variant="destructive" role="alert"><AlertCircle className="size-4" aria-hidden="true"/><AlertDescription>{typeof error === "string" ? error : error.message}</AlertDescription></Alert>;
}
export function BusyLabel({ children }: { children: React.ReactNode }) { return <><Loader2 className="size-4 animate-spin" aria-hidden="true"/>{children}</>; }
export function LoadingState() { return <div className="space-y-5 p-6" aria-label="Loading sync state" role="status"><Skeleton className="h-8 w-36"/><Skeleton className="h-16 w-full"/><Skeleton className="h-10 w-full"/></div>; }
export function PreviewBanner() {
  if (isExtension || !import.meta.env.DEV) return null;
  return <aside aria-label="Design preview" className="border-b bg-warning-muted px-4 py-2 text-center text-xs text-warning">Design preview · Sample data, no bookmarks are sent</aside>;
}
export function TextLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <Button variant="link" className="h-auto px-0 py-0 text-muted-foreground" onClick={onClick}>{children}<ArrowUpRight className="size-3" aria-hidden="true"/></Button>; }
export function relativeTime(timestamp: number) {
  const minutes = Math.floor((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hr ago`;
  return new Date(timestamp).toLocaleDateString();
}
