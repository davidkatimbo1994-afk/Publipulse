/** Connection settings and readiness check. No imports, so it can be unit-tested directly. */
export type ApiConfig = {
  baseUrl: string;
  organizationId: string;
  accessToken: string;
  signalId: string;
  actionId: string;
};

/** A usable base URL starts with http(s):// and has a host, so a half-typed value never counts as connected. */
export function isHttpBaseUrl(value: string): boolean {
  return /^https?:\/\/[^\s/?#]+/i.test(value.trim());
}

export function isConfigReady(cfg: ApiConfig): boolean {
  return Boolean(isHttpBaseUrl(cfg.baseUrl) && cfg.organizationId.trim() && cfg.accessToken.trim());
}
