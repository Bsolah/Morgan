export const XERO_ACCOUNTING_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "accounting.transactions",
  "accounting.settings.read",
  "accounting.reports.read",
].join(" ");

export const XERO_OAUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "Connection failed — try again.",
  token_exchange_failed: "Connection failed — try again.",
  not_configured: "Xero connection is not available right now.",
  server_error: "Connection failed — try again.",
  access_denied: "Xero authorization was cancelled.",
  missing_tenant: "Xero did not return an organisation. Try connecting again.",
  tenant_selection_required: "Select a Xero organisation to finish connecting.",
};

export type XeroTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in: number;
  id_token?: string;
};

export class XeroOAuthError extends Error {
  constructor(
    message: string,
    public readonly code: keyof typeof XERO_OAUTH_ERROR_MESSAGES | "server_error",
    public readonly status = 400,
  ) {
    super(message);
    this.name = "XeroOAuthError";
  }
}

export function buildXeroAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    scope: opts.scope ?? XERO_ACCOUNTING_SCOPES,
    state: opts.state,
  });

  return `https://login.xero.com/identity/connect/authorize?${params}`;
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function parseXeroTokenResponse(
  res: Response,
  failureCode: keyof typeof XERO_OAUTH_ERROR_MESSAGES,
): Promise<XeroTokenResponse> {
  const body = (await res.json().catch(() => ({}))) as XeroTokenResponse & {
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !body.access_token || !body.refresh_token) {
    throw new XeroOAuthError(
      body.error_description ?? body.error ?? `Xero token request failed: ${res.status}`,
      failureCode,
      res.status >= 500 ? 502 : 400,
    );
  }

  return body;
}

export async function exchangeXeroAuthorizationCode(opts: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<XeroTokenResponse> {
  const res = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(opts.clientId, opts.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: opts.code,
      redirect_uri: opts.redirectUri,
    }),
  });

  return parseXeroTokenResponse(res, "token_exchange_failed");
}

export async function refreshXeroAccessToken(opts: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<XeroTokenResponse> {
  const res = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(opts.clientId, opts.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: opts.refreshToken,
    }),
  });

  return parseXeroTokenResponse(res, "token_exchange_failed");
}

export async function revokeXeroConnection(opts: {
  accessToken: string;
  connectionId: string;
}): Promise<void> {
  const res = await fetch(`https://api.xero.com/connections/${opts.connectionId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      Accept: "application/json",
    },
  });

  if (!res.ok && res.status !== 404) {
    throw new XeroOAuthError(`Xero revoke failed: ${res.status}`, "server_error", res.status >= 500 ? 502 : 400);
  }
}

export type XeroConnection = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantType: string;
  createdDateUtc?: string;
  updatedDateUtc?: string;
};

export async function fetchXeroConnections(accessToken: string): Promise<XeroConnection[]> {
  const res = await fetch("https://api.xero.com/connections", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const body = (await res.json().catch(() => [])) as Array<Record<string, unknown>>;

  if (!res.ok) {
    throw new XeroOAuthError(`Xero connections failed: ${res.status}`, "server_error", res.status >= 500 ? 502 : 400);
  }

  if (!Array.isArray(body)) return [];

  return body
    .map((row) => ({
      id: String(row.id ?? ""),
      tenantId: String(row.tenantId ?? ""),
      tenantName: String(row.tenantName ?? "Organisation"),
      tenantType: String(row.tenantType ?? "ORGANISATION"),
      createdDateUtc: typeof row.createdDateUtc === "string" ? row.createdDateUtc : undefined,
      updatedDateUtc: typeof row.updatedDateUtc === "string" ? row.updatedDateUtc : undefined,
    }))
    .filter((row) => row.id && row.tenantId);
}

export const XERO_REAUTH_INTERVAL_MS = 90 * 24 * 60 * 60 * 1000;

export function xeroReauthDueAt(authorizedAt: Date): Date {
  return new Date(authorizedAt.getTime() + XERO_REAUTH_INTERVAL_MS);
}

export function shouldPromptXeroReauth(
  authorizedAt: Date | null,
  now = new Date(),
  promptWithinMs = 7 * 24 * 60 * 60 * 1000,
): boolean {
  if (!authorizedAt) return false;
  const dueAt = xeroReauthDueAt(authorizedAt);
  return now.getTime() >= dueAt.getTime() - promptWithinMs;
}

export function isXeroReauthRequired(authorizedAt: Date | null, now = new Date()): boolean {
  if (!authorizedAt) return false;
  return now.getTime() >= xeroReauthDueAt(authorizedAt).getTime();
}
