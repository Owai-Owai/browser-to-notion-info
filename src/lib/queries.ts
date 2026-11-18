import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Command, FolderNode } from "../../shared/schema";
import { getAppState, isExtension, request } from "./bridge";

export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: true } } });
export function useSyncState() {
  const client = useQueryClient();
  useEffect(() => {
    if (!isExtension) return;
    const changed = () => { void client.invalidateQueries({ queryKey: ["sync-state"] }); };
    chrome.storage.onChanged.addListener(changed);
    return () => chrome.storage.onChanged.removeListener(changed);
  }, [client]);
  return useQuery({ queryKey: ["sync-state"], queryFn: getAppState, refetchInterval: 3000 });
}
export function useFolders() { return useQuery({ queryKey: ["folders"], queryFn: () => request<FolderNode[]>({ type: "folders" }), refetchInterval: 5000 }); }
export function useCommand() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (command: Command) => request(command), onSuccess: () => client.invalidateQueries({ queryKey: ["sync-state"] }) });
}
