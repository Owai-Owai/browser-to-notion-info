import { connectionSchema, failureSchema, type Connection, type Failure } from "../../shared/schema";
import { z } from "zod";
import { serviceURL, usesLocalService } from "../lib/service-config";

export const SERVICE_URL = serviceURL;
export class ServiceError extends Error {
  constructor(public failure: Failure) { super(failure.message); }
}

export async function serviceRequest<T>(path: string, body: unknown, schema: z.ZodType<T>, connection?: Connection): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${SERVICE_URL}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json", ...(connection ? { Authorization: `Bearer ${connection.token}` } : {}) },
      body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
    });
  } catch { throw new ServiceError({ code: "offline", message: usesLocalService ? "Start the local connection service, then try again. Your pending bookmarks are retained." : "Couldn't reach the connection service. Check your internet connection and try again. Your pending bookmarks are retained." }); }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const failure = failureSchema.safeParse(data);
    throw new ServiceError(failure.success ? failure.data : { code: "service", message: "The connection service could not complete the request." });
  }
  return schema.parse(data);
}

export function asFailure(error: unknown): Failure {
  if (error instanceof ServiceError) return error.failure;
  return { code: "unexpected", message: error instanceof Error ? error.message : "Something went wrong. Try again." };
}

export async function connectNotion(existingConnection?: Connection): Promise<Connection> {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = toBase64(verifierBytes);
  const challenge = toBase64(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  const { url } = await serviceRequest("/v1/auth/start", { challenge }, z.object({ url: z.string().url() }), existingConnection);
  const redirect = await chrome.identity.launchWebAuthFlow({ url, interactive: true });
  if (!redirect) throw new Error("Notion connection was cancelled. You can try again.");
  const result = new URL(redirect);
  if (result.searchParams.get("error")) throw new Error("Notion connection was cancelled or denied. Try connecting again.");
  const ticket = result.searchParams.get("ticket");
  if (!ticket) throw new Error("The connection did not finish. Please try again.");
  return serviceRequest("/v1/auth/exchange", { ticket, verifier }, connectionSchema);
}

function toBase64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); }
