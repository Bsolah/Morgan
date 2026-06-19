export const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";

export const GOOGLE_ADS_OAUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "Connection failed — try again.",
  token_exchange_failed: "Connection failed — try again.",
  not_configured: "Google Ads connection is not available right now.",
  server_error: "Connection failed — try again.",
  access_denied: "Google authorization was cancelled.",
  no_accounts: "No Google Ads accounts were found for this Google account.",
  manager_selection_required: "Select a manager account to finish connecting Google Ads.",
  client_selection_required: "Select a client account to finish connecting Google Ads.",
};

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

export class GoogleAdsOAuthError extends Error {
  constructor(
    message: string,
    public readonly code: keyof typeof GOOGLE_ADS_OAUTH_ERROR_MESSAGES | "server_error",
    public readonly status = 400,
  ) {
    super(message);
    this.name = "GoogleAdsOAuthError";
  }
}

export function buildGoogleAdsAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: GOOGLE_ADS_SCOPE,
    state: opts.state,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function parseGoogleTokenResponse(
  res: Response,
  failureCode: keyof typeof GOOGLE_ADS_OAUTH_ERROR_MESSAGES,
): Promise<GoogleTokenResponse> {
  const body = (await res.json().catch(() => ({}))) as GoogleTokenResponse & {
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !body.access_token) {
    throw new GoogleAdsOAuthError(
      body.error_description ?? body.error ?? `Google token request failed: ${res.status}`,
      failureCode,
      res.status >= 500 ? 502 : 400,
    );
  }

  return body;
}

export async function exchangeGoogleAuthorizationCode(opts: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<GoogleTokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: opts.code,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      redirect_uri: opts.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  return parseGoogleTokenResponse(res, "token_exchange_failed");
}

export async function refreshGoogleAccessToken(opts: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<GoogleTokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      refresh_token: opts.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  return parseGoogleTokenResponse(res, "token_exchange_failed");
}

export async function revokeGoogleToken(token: string): Promise<void> {
  const res = await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!res.ok) {
    throw new GoogleAdsOAuthError(`Google token revoke failed: ${res.status}`, "server_error", res.status);
  }
}
