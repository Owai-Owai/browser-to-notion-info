import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ErrorMessage, LoadingState, PreviewBanner } from "./components/common";
import { PopupContent } from "./components/popup-content";
import { queryClient, useSyncState } from "./lib/queries";
import "./styles.css";

function Popup() {
  const state = useSyncState();
  return <><PreviewBanner/>{state.isPending ? <LoadingState/> : state.error ? <div className="popup-frame p-5"><ErrorMessage error={state.error}/></div> : <PopupContent state={state.data}/>}</>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><QueryClientProvider client={queryClient}><Popup/></QueryClientProvider></StrictMode>);
