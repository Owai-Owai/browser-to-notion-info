/** One origin is used for API calls, host permissions, and public support pages. */
export function serviceOrigin(value?: string, publicBuild = false): string {
  if (publicBuild && value && /YOUR_|CHANGE_ME/i.test(value)) throw new Error("Replace the example service address with the deployed HTTPS origin.");
  const url = new URL(value || "http://127.0.0.1:4318");
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("The connection service URL must be an origin without a path, credentials, or query.");
  const local = isLoopback(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:" && !publicBuild)) throw new Error("The public connection service must use HTTPS.");
  if (publicBuild && (local || !value || /(?:^|\.)(?:local|internal|invalid)$/.test(url.hostname) || /^(?:10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(url.hostname))) throw new Error("Configure a public HTTPS service URL before building the public extension.");
  return url.origin;
}

export function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost") || /^127(?:\.\d{1,3}){3}$/.test(hostname) || hostname === "[::1]";
}

/** Supabase routes a service below /functions/v1/name; permissions still use its origin. */
export function serviceBaseUrl(value?: string,publicBuild = false): string {
  const url = new URL(value || "http://127.0.0.1:4318");
  const path = url.pathname.replace(/\/$/,"");
  if (url.username || url.password || url.search || url.hash || (path && !/^\/functions\/v1\/[a-z\d_-]+$/i.test(path))) throw new Error("Use a service origin or a complete Supabase function URL without credentials or query parameters.");
  return serviceOrigin(url.origin,publicBuild)+path;
}
