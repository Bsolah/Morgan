import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth.js";
import { env, getPlaidConfig, isPlaidConfigured } from "../config.js";
import { getDb } from "../lib/db.js";
import { getMetaIntegrationForStore } from "../lib/meta-integration-service.js";
import {
  createPlaidLinkTokenForStore,
  disconnectPlaidIntegration,
  exchangePlaidPublicTokenForStore,
  getPlaidIntegrationForStore,
  plaidConfig,
} from "../lib/plaid-integration-service.js";
import { getQuickBooksIntegrationForStore } from "../lib/quickbooks-integration-service.js";
import { getGoogleAdsIntegrationForStore } from "../lib/google-ads-integration-service.js";
import { getXeroIntegrationForStore } from "../lib/xero-integration-service.js";
import { syncPlaidTransactionsForStore } from "../lib/plaid-transaction-sync-service.js";

const exchangePublicTokenSchema = z.object({
  public_token: z.string().min(1),
});

function storeIdFromAuth(request: { auth?: { store_ids: string[] } }): string | null {
  return request.auth?.store_ids[0] ?? null;
}

export async function plaidIntegrationRoutes(app: FastifyInstance) {
  app.post("/api/v1/integrations/plaid/link-token", { preHandler: requireAuth }, async (request, reply) => {
    if (!isPlaidConfigured()) {
      return reply.status(503).send({ error: "Plaid is not configured", code: "not_configured" });
    }

    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    try {
      const config = plaidConfig(getPlaidConfig());
      return await createPlaidLinkTokenForStore(db, storeId, config);
    } catch (error) {
      request.log.error(error, "Failed to create Plaid link token");
      return reply.status(502).send({ error: "Could not create Plaid link token", code: "link_token_failed" });
    }
  });

  app.post(
    "/api/v1/integrations/plaid/exchange-public-token",
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!isPlaidConfigured()) {
        return reply.status(503).send({ error: "Plaid is not configured", code: "not_configured" });
      }

      const storeId = storeIdFromAuth(request);
      if (!storeId) {
        return reply.status(400).send({ error: "No store in session" });
      }

      const parsed = exchangePublicTokenSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid public token", code: "invalid_public_token" });
      }

      const db = getDb();
      if (!db) {
        return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
      }

      try {
        const config = plaidConfig(getPlaidConfig());
        const status = await exchangePlaidPublicTokenForStore(
          db,
          storeId,
          parsed.data.public_token,
          config,
          env.ENCRYPTION_KEY,
        );

        if (isPlaidConfigured()) {
          void syncPlaidTransactionsForStore(db, storeId, config).catch((error) => {
            request.log.error(error, "Initial Plaid transaction sync failed");
          });
        }

        return { status };
      } catch (error) {
        request.log.error(error, "Plaid public token exchange failed");
        const message = error instanceof Error ? error.message : "exchange_failed";
        if (message === "no_eligible_accounts") {
          return reply.status(400).send({
            error: "No eligible checking or savings account was found.",
            code: "no_eligible_accounts",
          });
        }
        return reply.status(502).send({ error: "Could not connect bank account", code: "exchange_failed" });
      }
    },
  );

  app.get("/api/v1/integrations/plaid", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    return getPlaidIntegrationForStore(db, storeId);
  });

  app.post("/api/v1/integrations/plaid/disconnect", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    if (!isPlaidConfigured()) {
      return reply.status(503).send({ error: "Plaid is not configured", code: "not_configured" });
    }

    const config = plaidConfig(getPlaidConfig());
    const status = await disconnectPlaidIntegration(db, storeId, config, env.ENCRYPTION_KEY);
    return { status };
  });
}

export async function registerIntegrationsHub(app: FastifyInstance) {
  app.get("/api/v1/integrations/hub", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    const [meta, plaid, quickbooks, googleAds, xero] = await Promise.all([
      getMetaIntegrationForStore(db, storeId),
      getPlaidIntegrationForStore(db, storeId),
      getQuickBooksIntegrationForStore(db, storeId),
      getGoogleAdsIntegrationForStore(db, storeId),
      getXeroIntegrationForStore(db, storeId),
    ]);

    return { integrations: [meta, plaid, quickbooks, googleAds, xero] };
  });
}
