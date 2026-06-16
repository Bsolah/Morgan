import { createHmac } from "node:crypto";

export const SHOPIFY_OAUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "Connection failed — try again.",
  hmac_mismatch: "Connection failed — try again.",
  token_exchange_failed: "Connection failed — try again.",
  not_configured: "Shopify connection is not available right now.",
  missing_shop_email: "Could not read a contact email from your Shopify store.",
  server_error: "Connection failed — try again.",
  invalid_shop: "Enter a valid Shopify store URL (e.g. mystore.myshopify.com).",
};

export function normalizeShopInput(raw: string): string {
  let shop = raw.trim().toLowerCase();
  shop = shop.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!shop) return "";
  if (!shop.includes(".")) shop = `${shop}.myshopify.com`;
  return shop;
}

export function isValidShopDomain(shop: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop);
}

export function verifyShopifyOAuthHmac(
  query: Record<string, string>,
  clientSecret: string,
): boolean {
  const hmac = query.hmac;
  if (!hmac) return false;

  const params = Object.entries(query)
    .filter(([key]) => key !== "hmac")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const digest = createHmac("sha256", clientSecret).update(params).digest("hex");
  return digest === hmac;
}

export type ShopifyTokenResponse = {
  access_token: string;
  scope?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
};

export class ShopifyOAuthError extends Error {
  constructor(
    message: string,
    public readonly code: keyof typeof SHOPIFY_OAUTH_ERROR_MESSAGES | "server_error",
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ShopifyOAuthError";
  }
}

export async function exchangeAuthorizationCode(opts: {
  shopDomain: string;
  clientId: string;
  clientSecret: string;
  code: string;
}): Promise<ShopifyTokenResponse> {
  const res = await fetch(`https://${opts.shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      code: opts.code,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ShopifyOAuthError(
      `Shopify token exchange failed: ${res.status}`,
      "token_exchange_failed",
      res.status,
    );
  }

  return (await res.json()) as ShopifyTokenResponse;
}

export type ShopifyShopInfo = {
  name: string;
  email: string;
  shop_owner: string;
  timezone: string;
  currency: string;
  myshopify_domain: string;
};

export async function fetchShopInfo(
  shopDomain: string,
  accessToken: string,
): Promise<ShopifyShopInfo> {
  const res = await fetch(`https://${shopDomain}/admin/api/2024-10/shop.json`, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new ShopifyOAuthError(`Failed to fetch shop info: ${res.status}`, "server_error", res.status);
  }

  const json = (await res.json()) as { shop: Record<string, unknown> };
  const shop = json.shop;

  return {
    name: String(shop.name ?? shopDomain),
    email: String(shop.email ?? ""),
    shop_owner: String(shop.shop_owner ?? ""),
    timezone: String(shop.timezone ?? shop.iana_timezone ?? "UTC"),
    currency: String(shop.currency ?? "USD"),
    myshopify_domain: String(shop.myshopify_domain ?? shopDomain),
  };
}

export function buildShopifyAuthorizeUrl(opts: {
  shopDomain: string;
  clientId: string;
  scopes: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    scope: opts.scopes,
    redirect_uri: opts.redirectUri,
    state: opts.state,
  });

  return `https://${opts.shopDomain}/admin/oauth/authorize?${params.toString()}`;
}
