import { randomBytes } from "node:crypto";

type OAuthState = {
  shop: string;
  platform: "mobile" | "web";
  createdAt: number;
  callbackUrl: string;
};

type ConnectToken = {
  userId: string;
  orgId: string;
  storeId: string;
  shopDomain: string;
  createdAt: number;
};

const OAUTH_TTL_MS = 10 * 60 * 1000;
const CONNECT_TTL_MS = 5 * 60 * 1000;

const oauthStates = new Map<string, OAuthState>();
const connectTokens = new Map<string, ConnectToken>();

function prune<T extends { createdAt: number }>(map: Map<string, T>, ttlMs: number) {
  const cutoff = Date.now() - ttlMs;
  for (const [key, value] of map) {
    if (value.createdAt < cutoff) map.delete(key);
  }
}

export function createOAuthState(input: Omit<OAuthState, "createdAt">): string {
  prune(oauthStates, OAUTH_TTL_MS);
  const state = randomBytes(16).toString("hex");
  oauthStates.set(state, { ...input, createdAt: Date.now() });
  return state;
}

export function consumeOAuthState(state: string): OAuthState | null {
  prune(oauthStates, OAUTH_TTL_MS);
  const entry = oauthStates.get(state);
  if (!entry) return null;
  oauthStates.delete(state);
  return entry;
}

export function issueConnectToken(input: Omit<ConnectToken, "createdAt">): string {
  prune(connectTokens, CONNECT_TTL_MS);
  const token = randomBytes(24).toString("hex");
  connectTokens.set(token, { ...input, createdAt: Date.now() });
  return token;
}

export function consumeConnectToken(token: string): ConnectToken | null {
  prune(connectTokens, CONNECT_TTL_MS);
  const entry = connectTokens.get(token);
  if (!entry) return null;
  connectTokens.delete(token);
  return entry;
}

/** Test helper */
export function resetOAuthStores(): void {
  oauthStates.clear();
  connectTokens.clear();
}
