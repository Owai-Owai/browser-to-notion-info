import { z } from "zod";
import { ApiError } from "../../../shared/api-error.ts";

export interface Repository { call(action: string, payload: Record<string, unknown>): Promise<unknown> }
export const connectionSchema = z.object({ id: z.string().uuid(), encrypted_tokens: z.string(), workspace_id: z.string(), workspace_name: z.string(), token_version: z.number().int() });
export type Connection = z.infer<typeof connectionSchema>;
export const okSchema = z.object({ ok: z.literal(true) });
export const operationSchema = z.object({ state: z.enum(["writing","uncertain","rejected","saved","duplicate"]), page_id: z.string().nullable(), page_url: z.string().url().nullable() });
export const operationResultSchema = z.object({ operation: operationSchema.nullable() });

const errors: Record<string, { status: number; message: string; retryAfter?: number }> = {
  auth: { status: 401, message: "Reconnect Notion to continue." },
  expired: { status: 401, message: "This connection attempt expired. Return to the extension and reconnect." },
  rate_limit: { status: 429, message: "Too many connection attempts. Wait a few minutes.", retryAfter: 600 },
  busy: { status: 409, message: "This request is already being processed. It will retry shortly.", retryAfter: 5 },
  uncertain: { status: 409, message: "A previous save may have reached Notion. We are checking before creating another entry." },
  validation: { status: 400, message: "The request no longer matches its saved operation. Review the destination and try again." },
};
export async function rpc<T>(repository: Repository, action: string, payload: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const data = await repository.call(action,payload);
  const failure = z.object({ code: z.string() }).safeParse(data);
  if (failure.success) {
    const entry = errors[failure.data.code];
    if (!entry) throw new Error("The service returned an unexpected database result.");
    const { status, ...details } = entry;
    throw new ApiError(status, { code: failure.data.code === "expired" ? "auth" : failure.data.code, ...details });
  }
  return schema.parse(data);
}

/** Only this server-side adapter knows the Supabase service-role credential. */
export function postgresRepository(url: string, serviceKey: string, transport: typeof fetch = fetch): Repository {
  return { async call(action,payload) {
    const endpoint = `${new URL(url).origin}/rest/v1/rpc/${action === "analytics_allow" ? "bns_analytics_allow" : "bns_service"}`;
    let response: Response;
    try {
      response = await transport(endpoint, { method: "POST", headers: { apikey: serviceKey,...(serviceKey.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${serviceKey}` }), "Content-Type": "application/json" }, body: JSON.stringify({ p_action: action,p_payload: payload }), signal: AbortSignal.timeout(12_000) });
    } catch { throw new ApiError(503, { code: "service", message: "The connection database is unavailable. Your pending work is retained." }); }
    if (!response.ok) throw new ApiError(503, { code: "service", message: "The connection database could not complete the request. Your pending work is retained." });
    return response.json();
  } };
}
