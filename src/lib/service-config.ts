import { isLoopback, serviceBaseUrl } from "../../shared/service-url";

export const serviceURL = serviceBaseUrl(import.meta.env.VITE_SERVICE_URL);
export const usesLocalService = isLoopback(new URL(serviceURL).hostname);
export const privacyURL = import.meta.env.VITE_PRIVACY_URL || `${serviceURL}/privacy`;
export const usageSupported = !usesLocalService;
