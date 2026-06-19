export const META_GRAPH_VERSION = "v21.0";
export const META_ADS_SCOPES = ["ads_read"] as const;

export const META_OAUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "Connection failed — try again.",
  token_exchange_failed: "Connection failed — try again.",
  not_configured: "Meta Ads connection is not available right now.",
  server_error: "Connection failed — try again.",
  access_denied: "Meta authorization was cancelled.",
  no_ad_accounts: "No Meta ad accounts were found for this Facebook account.",
  account_selection_required: "Select an ad account to finish connecting Meta Ads.",
};

export type MetaTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

export class MetaOAuthError extends Error {
  constructor(
    message: string,
    public readonly code: keyof typeof META_OAUTH_ERROR_MESSAGES | "server_error",
    public readonly status = 400,
  ) {
    super(message);
    this.name = "MetaOAuthError";
  }
}

export function buildMetaAuthorizeUrl(opts: {
  appId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.appId,
    redirect_uri: opts.redirectUri,
    state: opts.state,
    scope: META_ADS_SCOPES.join(","),
    response_type: "code",
  });

  return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params}`;
}

async function parseMetaTokenResponse(
  res: Response,
  failureCode: keyof typeof META_OAUTH_ERROR_MESSAGES,
): Promise<MetaTokenResponse> {
  const body = (await res.json().catch(() => ({}))) as MetaTokenResponse & {
    error?: { message?: string };
  };

  if (!res.ok || !body.access_token) {
    throw new MetaOAuthError(
      body.error?.message ?? `Meta token request failed: ${res.status}`,
      failureCode,
      res.status >= 500 ? 502 : 400,
    );
  }

  return body;
}

export async function exchangeAuthorizationCode(opts: {
  appId: string;
  appSecret: string;
  redirectUri: string;
  code: string;
}): Promise<MetaTokenResponse> {
  const params = new URLSearchParams({
    client_id: opts.appId,
    client_secret: opts.appSecret,
    redirect_uri: opts.redirectUri,
    code: opts.code,
  });

  const res = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${params}`,
  );

  return parseMetaTokenResponse(res, "token_exchange_failed");
}

export async function exchangeForLongLivedToken(opts: {
  appId: string;
  appSecret: string;
  shortLivedToken: string;
}): Promise<MetaTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: opts.appId,
    client_secret: opts.appSecret,
    fb_exchange_token: opts.shortLivedToken,
  });

  const res = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${params}`,
  );

  return parseMetaTokenResponse(res, "token_exchange_failed");
}

export async function refreshLongLivedToken(opts: {
  appId: string;
  appSecret: string;
  accessToken: string;
}): Promise<MetaTokenResponse> {
  return exchangeForLongLivedToken({
    appId: opts.appId,
    appSecret: opts.appSecret,
    shortLivedToken: opts.accessToken,
  });
}
