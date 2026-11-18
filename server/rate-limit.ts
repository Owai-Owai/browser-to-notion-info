import { isIP } from "node:net";
import type { IncomingMessage } from "node:http";
import { config } from "./config";

const attempts = new Map<string, { count: number; expires: number }>();

/** Only trust an address header that the configured edge overwrites or appends. */
export function allowAuthAttempt(request: IncomingMessage, now = Date.now()): boolean {
  const forwarded = request.headers[config.CLIENT_IP_HEADER];
  const forwardedAddress = typeof forwarded === "string" ? config.CLIENT_IP_HEADER === "x-forwarded-for" ? forwarded.split(",").at(-1)?.trim() : forwarded.trim() : undefined;
  const address = config.TRUST_PROXY && forwardedAddress && isIP(forwardedAddress) ? forwardedAddress : request.socket.remoteAddress || "unknown";
  for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
  const attempt = attempts.get(address) ?? { count: 0, expires: now + 10 * 60_000 };
  if (attempts.size >= 10_000 && !attempts.has(address)) return false;
  attempts.set(address, attempt);
  return ++attempt.count <= 20;
}
