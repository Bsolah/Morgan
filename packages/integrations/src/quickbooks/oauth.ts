export const QUICKBOOKS_ACCOUNTING_SCOPE = "com.intuit.quickbooks.accounting";

export const QUICKBOOKS_OAUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "Connection failed — try again.",
  token_exchange_failed: "Connection failed — try again.",
  not_configured: "QuickBooks connection is not available right now.",
  server_error: "Connection failed — try again.",
  access_denied: "QuickBooks authorization was cancelled.",
  missing_realm: "QuickBooks did not return a company. Try connecting again.",
  company_selection_required: "Select a QuickBooks company to finish connecting.",
  reauth_required: "QuickBooks needs to be reconnected.",
};

export type QuickBooksEnvironment = "sandbox" | "production";

export type QuickBooksTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in: number;
  x_refresh_token_expires_in?: number;
};

export class QuickBooksOAuthError extends Error {
  constructor(
    message: string,
    public readonly code: keyof typeof QUICKBOOKS_OAUTH_ERROR_MESSAGES | "server_error",
    public readonly status = 400,
  ) {
    super(message);
    this.name = "QuickBooksOAuthError";
  }
}

export function getQuickBooksApiBaseUrl(environment: QuickBooksEnvironment): string {
  return environment === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";
}

export function buildQuickBooksAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: opts.scope ?? QUICKBOOKS_ACCOUNTING_SCOPE,
    state: opts.state,
  });

  return `https://appcenter.intuit.com/connect/oauth2?${params}`;
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function parseQuickBooksTokenResponse(
  res: Response,
  failureCode: keyof typeof QUICKBOOKS_OAUTH_ERROR_MESSAGES,
): Promise<QuickBooksTokenResponse> {
  const body = (await res.json().catch(() => ({}))) as QuickBooksTokenResponse & {
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !body.access_token || !body.refresh_token) {
    throw new QuickBooksOAuthError(
      body.error_description ?? body.error ?? `QuickBooks token request failed: ${res.status}`,
      failureCode,
      res.status >= 500 ? 502 : 400,
    );
  }

  return body;
}

export async function exchangeQuickBooksAuthorizationCode(opts: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<QuickBooksTokenResponse> {
  const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
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

  return parseQuickBooksTokenResponse(res, "token_exchange_failed");
}

export async function refreshQuickBooksAccessToken(opts: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<QuickBooksTokenResponse> {
  const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
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

  return parseQuickBooksTokenResponse(res, "token_exchange_failed");
}

export async function revokeQuickBooksToken(opts: {
  clientId: string;
  clientSecret: string;
  token: string;
}): Promise<void> {
  const res = await fetch("https://developer.api.intuit.com/v2/oauth2/tokens/revoke", {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(opts.clientId, opts.clientSecret),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ token: opts.token }),
  });

  if (!res.ok) {
    throw new QuickBooksOAuthError(
      `QuickBooks revoke failed: ${res.status}`,
      "server_error",
      res.status >= 500 ? 502 : 400,
    );
  }
}

export type QuickBooksCompanyInfo = {
  realmId: string;
  companyName: string;
  country?: string | null;
};

export async function fetchQuickBooksCompanyInfo(opts: {
  environment: QuickBooksEnvironment;
  accessToken: string;
  realmId: string;
}): Promise<QuickBooksCompanyInfo> {
  const baseUrl = getQuickBooksApiBaseUrl(opts.environment);
  const res = await fetch(
    `${baseUrl}/v3/company/${opts.realmId}/companyinfo/${opts.realmId}?minorversion=73`,
    {
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        Accept: "application/json",
      },
    },
  );

  const body = (await res.json().catch(() => ({}))) as {
    CompanyInfo?: {
      CompanyName?: string;
      Country?: string;
    };
    Fault?: { Error?: Array<{ Message?: string }> };
  };

  if (!res.ok || !body.CompanyInfo?.CompanyName) {
    const message =
      body.Fault?.Error?.[0]?.Message ?? `QuickBooks company info failed: ${res.status}`;
    throw new QuickBooksOAuthError(message, "server_error", res.status >= 500 ? 502 : 400);
  }

  return {
    realmId: opts.realmId,
    companyName: body.CompanyInfo.CompanyName,
    country: body.CompanyInfo.Country ?? null,
  };
}

export const QUICKBOOKS_REAUTH_INTERVAL_MS = 90 * 24 * 60 * 60 * 1000;

export function quickBooksReauthDueAt(authorizedAt: Date): Date {
  return new Date(authorizedAt.getTime() + QUICKBOOKS_REAUTH_INTERVAL_MS);
}

export function shouldPromptQuickBooksReauth(
  authorizedAt: Date | null,
  now = new Date(),
  promptWithinMs = 7 * 24 * 60 * 60 * 1000,
): boolean {
  if (!authorizedAt) return false;
  const dueAt = quickBooksReauthDueAt(authorizedAt);
  return now.getTime() >= dueAt.getTime() - promptWithinMs;
}

export function isQuickBooksReauthRequired(authorizedAt: Date | null, now = new Date()): boolean {
  if (!authorizedAt) return false;
  return now.getTime() >= quickBooksReauthDueAt(authorizedAt).getTime();
}
