import { randomBytes } from "node:crypto";

type GoogleAdsOAuthState = {
  storeId: string;
  userId: string;
  orgId: string;
  platform: "mobile" | "web";
  createdAt: number;
};

const OAUTH_TTL_MS = 10 * 60 * 1000;
const oauthStates = new Map<string, GoogleAdsOAuthState>();

function prune(ttlMs: number) {
  const cutoff = Date.now() - ttlMs;
  for (const [key, value] of oauthStates) {
    if (value.createdAt < cutoff) oauthStates.delete(key);
  }
}

export function createGoogleAdsOAuthState(input: Omit<GoogleAdsOAuthState, "createdAt">): string {
  prune(OAUTH_TTL_MS);
  const state = randomBytes(16).toString("hex");
  oauthStates.set(state, { ...input, createdAt: Date.now() });
  return state;
}

export function consumeGoogleAdsOAuthState(state: string): GoogleAdsOAuthState | null {
  prune(OAUTH_TTL_MS);
  const entry = oauthStates.get(state);
  if (!entry) return null;
  oauthStates.delete(state);
  return entry;
}

export function resetGoogleAdsOAuthStores(): void {
  oauthStates.clear();
}
