import { getDb } from "./db.js";
import { refreshQuickBooksTokens } from "./quickbooks-integration-service.js";
import { env } from "../config.js";

let interval: NodeJS.Timeout | null = null;
let running = false;

export function startQuickBooksTokenRefreshRunner(): void {
  if (interval) return;

  const tick = async () => {
    if (running) return;
    if (!env.INTUIT_CLIENT_ID || !env.INTUIT_CLIENT_SECRET) return;

    const db = getDb();
    if (!db) return;

    running = true;
    try {
      await refreshQuickBooksTokens(db, {
        encryptionKey: env.ENCRYPTION_KEY,
        clientId: env.INTUIT_CLIENT_ID,
        clientSecret: env.INTUIT_CLIENT_SECRET,
        refreshWithinMs: env.INTUIT_TOKEN_REFRESH_WITHIN_MS,
        reauthPromptWithinMs: env.INTUIT_REAUTH_PROMPT_WITHIN_MS,
      });
    } finally {
      running = false;
    }
  };

  void tick();
  interval = setInterval(() => {
    void tick();
  }, env.INTUIT_TOKEN_REFRESH_INTERVAL_MS);
}

export function stopQuickBooksTokenRefreshRunner(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
