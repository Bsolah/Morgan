import { getDb } from "./db.js";
import { refreshXeroTokens } from "./xero-integration-service.js";
import { env } from "../config.js";

let interval: NodeJS.Timeout | null = null;
let running = false;

export function startXeroTokenRefreshRunner(): void {
  if (interval) return;

  const tick = async () => {
    if (running) return;
    if (!env.XERO_CLIENT_ID || !env.XERO_CLIENT_SECRET) return;

    const db = getDb();
    if (!db) return;

    running = true;
    try {
      await refreshXeroTokens(db, {
        encryptionKey: env.ENCRYPTION_KEY,
        clientId: env.XERO_CLIENT_ID,
        clientSecret: env.XERO_CLIENT_SECRET,
        refreshWithinMs: env.XERO_TOKEN_REFRESH_WITHIN_MS,
        reauthPromptWithinMs: env.XERO_REAUTH_PROMPT_WITHIN_MS,
      });
    } finally {
      running = false;
    }
  };

  void tick();
  interval = setInterval(() => {
    void tick();
  }, env.XERO_TOKEN_REFRESH_INTERVAL_MS);
}

export function stopXeroTokenRefreshRunner(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
