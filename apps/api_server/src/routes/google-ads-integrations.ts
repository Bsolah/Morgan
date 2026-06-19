import type { FastifyInstance, FastifyReply } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { integrations } from "@morgan/db";
import {
  GOOGLE_ADS_OAUTH_ERROR_MESSAGES,
  buildGoogleAdsAuthorizeUrl,
} from "@morgan/integrations";
import { requireAuth } from "../plugins/auth.js";
import {
  env,
  getGoogleAdsOAuthCallbackUrl,
  getMobileDeepLink,
  isGoogleAdsOAuthConfigured,
} from "../config.js";
import { getDb } from "../lib/db.js";
import {
  consumeGoogleAdsOAuthState,
  createGoogleAdsOAuthState,
} from "../lib/google-ads-oauth-state.js";
import {
  completeGoogleAdsOAuth,
  disconnectGoogleAdsIntegration,
  getGoogleAdsCredentials,
  getGoogleAdsIntegrationForStore,
  listGoogleAdsClientAccounts,
  listGoogleAdsManagerAccounts,
  selectGoogleAdsClientAccount,
  selectGoogleAdsManagerAccount,
} from "../lib/google-ads-integration-service.js";
import { syncGoogleAdsInsightsForStore } from "../lib/google-ads-insights-sync-service.js";

const selectManagerSchema = z.object({
  manager_customer_id: z.string().min(1),
});

const selectClientSchema = z.object({
  client_customer_id: z.string().min(1),
});

function storeIdFromAuth(request: { auth?: { store_ids: string[] } }): string | null {
  return request.auth?.store_ids[0] ?? null;
}

function redirectMobile(reply: FastifyReply, path: string, params: Record<string, string>) {
  return reply.redirect(getMobileDeepLink(path, params));
}

function redirectMobileGoogleAdsError(
  reply: FastifyReply,
  code: keyof typeof GOOGLE_ADS_OAUTH_ERROR_MESSAGES,
) {
  return redirectMobile(reply, "settings/integrations", { google_ads_error: code });
}

export async function googleAdsIntegrationRoutes(app: FastifyInstance) {
  app.get("/api/v1/integrations/google-ads", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    return getGoogleAdsIntegrationForStore(db, storeId);
  });

  app.get("/api/v1/integrations/google-ads/oauth/start", async (request, reply) => {
    if (!isGoogleAdsOAuthConfigured()) {
      return reply.status(503).send({
        error: GOOGLE_ADS_OAUTH_ERROR_MESSAGES.not_configured,
        code: "not_configured",
      });
    }

    const query = request.query as { platform?: string };
    const platform = query.platform === "mobile" ? "mobile" : "web";

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Missing or invalid Authorization header" });
    }

    const { verifyToken } = await import("../lib/jwt.js");
    let auth;
    try {
      auth = await verifyToken(authHeader.slice("Bearer ".length));
    } catch {
      return reply.status(401).send({ error: "Invalid or expired token" });
    }

    const storeId = auth.store_ids[0];
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const state = createGoogleAdsOAuthState({
      storeId,
      userId: auth.sub,
      orgId: auth.org_id,
      platform,
    });

    const authorizeUrl = buildGoogleAdsAuthorizeUrl({
      clientId: env.GOOGLE_ADS_CLIENT_ID!,
      redirectUri: getGoogleAdsOAuthCallbackUrl(),
      state,
    });

    if (platform === "mobile") {
      return { authorize_url: authorizeUrl };
    }

    return reply.redirect(authorizeUrl);
  });

  app.get("/api/v1/integrations/google-ads/oauth/callback", async (request, reply) => {
    if (!isGoogleAdsOAuthConfigured()) {
      return redirectMobileGoogleAdsError(reply, "not_configured");
    }

    const query = request.query as Record<string, string>;
    const { code, state, error } = query;

    if (error) {
      request.log.warn({ error }, "Google Ads OAuth denied");
      return redirectMobileGoogleAdsError(
        reply,
        error === "access_denied" ? "access_denied" : "server_error",
      );
    }

    if (!code || !state) {
      return redirectMobileGoogleAdsError(reply, "invalid_state");
    }

    const oauthState = consumeGoogleAdsOAuthState(state);
    if (!oauthState) {
      return redirectMobileGoogleAdsError(reply, "invalid_state");
    }

    const db = getDb();
    if (!db) {
      return redirectMobileGoogleAdsError(reply, "server_error");
    }

    try {
      const result = await completeGoogleAdsOAuth(db, {
        storeId: oauthState.storeId,
        clientId: env.GOOGLE_ADS_CLIENT_ID!,
        clientSecret: env.GOOGLE_ADS_CLIENT_SECRET!,
        redirectUri: getGoogleAdsOAuthCallbackUrl(),
        code,
        developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN!,
        encryptionKey: env.ENCRYPTION_KEY,
      });

      if (!result.needsManagerSelection && !result.needsClientSelection) {
        setImmediate(() => {
          void syncGoogleAdsInsightsForStore(db, oauthState.storeId).catch((syncError) => {
            request.log.error(syncError, "Google Ads backfill after OAuth failed");
          });
        });
      }

      const status = result.needsManagerSelection
        ? "select_manager"
        : result.needsClientSelection
          ? "select_client"
          : "connected";

      return redirectMobile(reply, "settings/integrations", { google_ads_status: status });
    } catch (callbackError) {
      request.log.error(callbackError, "Google Ads OAuth callback failed");
      const message = callbackError instanceof Error ? callbackError.message : "token_exchange_failed";
      const codeKey =
        message === "no_accounts"
          ? "no_accounts"
          : message === "missing_refresh_token"
            ? "token_exchange_failed"
            : "token_exchange_failed";
      return redirectMobileGoogleAdsError(reply, codeKey);
    }
  });

  app.get(
    "/api/v1/integrations/google-ads/manager-accounts",
    { preHandler: requireAuth },
    async (request, reply) => {
      const storeId = storeIdFromAuth(request);
      if (!storeId) {
        return reply.status(400).send({ error: "No store in session" });
      }

      const db = getDb();
      if (!db) {
        return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
      }

      const managerAccounts = await listGoogleAdsManagerAccounts(db, storeId);
      return { manager_accounts: managerAccounts };
    },
  );

  app.get(
    "/api/v1/integrations/google-ads/client-accounts",
    { preHandler: requireAuth },
    async (request, reply) => {
      const storeId = storeIdFromAuth(request);
      if (!storeId) {
        return reply.status(400).send({ error: "No store in session" });
      }

      const db = getDb();
      if (!db) {
        return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
      }

      const clientAccounts = await listGoogleAdsClientAccounts(db, storeId);
      return { client_accounts: clientAccounts };
    },
  );

  app.post(
    "/api/v1/integrations/google-ads/manager-account",
    { preHandler: requireAuth },
    async (request, reply) => {
      const storeId = storeIdFromAuth(request);
      if (!storeId) {
        return reply.status(400).send({ error: "No store in session" });
      }

      const parsed = selectManagerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid manager account", code: "invalid_manager" });
      }

      const db = getDb();
      if (!db) {
        return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
      }

      try {
        const [integration] = await db
          .select({ id: integrations.id })
          .from(integrations)
          .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "google_ads")))
          .limit(1);

        if (!integration) {
          return reply.status(404).send({ error: "Google Ads not connected", code: "not_connected" });
        }

        const credentials = await getGoogleAdsCredentials(db, integration.id, env.ENCRYPTION_KEY);

        const result = await selectGoogleAdsManagerAccount(
          db,
          storeId,
          parsed.data.manager_customer_id,
          credentials?.access_token && env.GOOGLE_ADS_DEVELOPER_TOKEN
            ? {
                accessToken: credentials.access_token,
                developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN,
              }
            : undefined,
        );

        if (!result.needsClientSelection) {
          setImmediate(() => {
            void syncGoogleAdsInsightsForStore(db, storeId).catch((error) => {
              request.log.error(error, "Google Ads backfill after manager selection failed");
            });
          });
        }

        const status = await getGoogleAdsIntegrationForStore(db, storeId);
        return { status, next_step: result.needsClientSelection ? "select_client" : "connected" };
      } catch (error) {
        const message = error instanceof Error ? error.message : "invalid_manager";
        if (message === "invalid_manager_account") {
          return reply.status(404).send({ error: "Manager account not found", code: message });
        }
        return reply.status(400).send({ error: "Invalid manager account", code: "invalid_manager" });
      }
    },
  );

  app.post(
    "/api/v1/integrations/google-ads/client-account",
    { preHandler: requireAuth },
    async (request, reply) => {
      const storeId = storeIdFromAuth(request);
      if (!storeId) {
        return reply.status(400).send({ error: "No store in session" });
      }

      const parsed = selectClientSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid client account", code: "invalid_client" });
      }

      const db = getDb();
      if (!db) {
        return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
      }

      try {
        await selectGoogleAdsClientAccount(db, storeId, parsed.data.client_customer_id);
        setImmediate(() => {
          void syncGoogleAdsInsightsForStore(db, storeId).catch((error) => {
            request.log.error(error, "Google Ads backfill after client selection failed");
          });
        });
        const status = await getGoogleAdsIntegrationForStore(db, storeId);
        return { status };
      } catch (error) {
        const message = error instanceof Error ? error.message : "invalid_client";
        if (message === "invalid_client_account") {
          return reply.status(404).send({ error: "Client account not found", code: message });
        }
        return reply.status(400).send({ error: "Invalid client account", code: "invalid_client" });
      }
    },
  );

  app.post(
    "/api/v1/integrations/google-ads/disconnect",
    { preHandler: requireAuth },
    async (request, reply) => {
      const storeId = storeIdFromAuth(request);
      if (!storeId) {
        return reply.status(400).send({ error: "No store in session" });
      }

      const db = getDb();
      if (!db) {
        return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
      }

      const status = await disconnectGoogleAdsIntegration(db, storeId, {
        clientId: env.GOOGLE_ADS_CLIENT_ID!,
        clientSecret: env.GOOGLE_ADS_CLIENT_SECRET!,
        encryptionKey: env.ENCRYPTION_KEY,
      });

      return { status };
    },
  );
}
