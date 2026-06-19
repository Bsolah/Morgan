import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { META_ADS_SCOPES, META_OAUTH_ERROR_MESSAGES, buildMetaAuthorizeUrl } from "@morgan/integrations";
import { requireAuth } from "../plugins/auth.js";
import {
  env,
  getMetaOAuthCallbackUrl,
  getMobileDeepLink,
  isMetaOAuthConfigured,
} from "../config.js";
import { getDb } from "../lib/db.js";
import {
  consumeMetaOAuthState,
  createMetaOAuthState,
} from "../lib/meta-oauth-state.js";
import {
  completeMetaOAuth,
  disconnectMetaIntegration,
  getMetaIntegrationForStore,
  listMetaAdAccounts,
  selectMetaAdAccount,
} from "../lib/meta-integration-service.js";
import { syncMetaInsightsForStore } from "../lib/meta-insights-sync-service.js";

const selectAccountSchema = z.object({
  ad_account_id: z.string().min(3),
});

function storeIdFromAuth(request: { auth?: { store_ids: string[] } }): string | null {
  return request.auth?.store_ids[0] ?? null;
}

function redirectMobile(reply: FastifyReply, path: string, params: Record<string, string>) {
  return reply.redirect(getMobileDeepLink(path, params));
}

function redirectMobileMetaError(
  reply: FastifyReply,
  code: keyof typeof META_OAUTH_ERROR_MESSAGES,
) {
  return redirectMobile(reply, "integrations/meta", { meta_error: code });
}

export async function integrationsRoutes(app: FastifyInstance) {
  app.get("/api/v1/integrations/meta", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    return getMetaIntegrationForStore(db, storeId);
  });

  app.get("/api/v1/integrations/meta/oauth/start", async (request, reply) => {
    if (!isMetaOAuthConfigured()) {
      return reply.status(503).send({
        error: META_OAUTH_ERROR_MESSAGES.not_configured,
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

    const state = createMetaOAuthState({
      storeId,
      userId: auth.sub,
      orgId: auth.org_id,
      platform,
    });

    const authorizeUrl = buildMetaAuthorizeUrl({
      appId: env.META_APP_ID!,
      redirectUri: getMetaOAuthCallbackUrl(),
      state,
    });

    if (platform === "mobile") {
      return { authorize_url: authorizeUrl };
    }

    return reply.redirect(authorizeUrl);
  });

  app.get("/api/v1/integrations/meta/oauth/callback", async (request, reply) => {
    if (!isMetaOAuthConfigured()) {
      return redirectMobileMetaError(reply, "not_configured");
    }

    const query = request.query as Record<string, string>;
    const { code, state, error, error_description: errorDescription } = query;

    if (error) {
      request.log.warn({ error, errorDescription }, "Meta OAuth denied");
      return redirectMobileMetaError(reply, error === "access_denied" ? "access_denied" : "server_error");
    }

    if (!code || !state) {
      return redirectMobileMetaError(reply, "invalid_state");
    }

    const pending = consumeMetaOAuthState(state);
    if (!pending) {
      return redirectMobileMetaError(reply, "invalid_state");
    }

    const db = getDb();
    if (!db) {
      request.log.error("DATABASE_URL not configured — cannot complete Meta OAuth");
      return redirectMobileMetaError(reply, "server_error");
    }

    try {
      const result = await completeMetaOAuth(db, {
        storeId: pending.storeId,
        appId: env.META_APP_ID!,
        appSecret: env.META_APP_SECRET!,
        redirectUri: getMetaOAuthCallbackUrl(),
        code,
        scopes: META_ADS_SCOPES.join(","),
        encryptionKey: env.ENCRYPTION_KEY,
      });

      if (pending.platform === "mobile") {
        return redirectMobile(reply, "integrations/meta", {
          meta_status: result.needsAccountSelection ? "select_account" : "connected",
        });
      }

      return reply.send({
        status: result.needsAccountSelection ? "select_account" : "connected",
      });
    } catch (err) {
      request.log.error(err, "Meta OAuth callback failed");
      const codeKey =
        err instanceof Error && err.message === "no_ad_accounts"
          ? "no_ad_accounts"
          : "token_exchange_failed";
      return redirectMobileMetaError(reply, codeKey);
    }
  });

  app.get("/api/v1/integrations/meta/ad-accounts", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    const accounts = await listMetaAdAccounts(db, storeId);
    return { ad_accounts: accounts };
  });

  app.post("/api/v1/integrations/meta/ad-account", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const parsed = selectAccountSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid ad account", code: "invalid_ad_account" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    try {
      await selectMetaAdAccount(db, storeId, parsed.data.ad_account_id);
      setImmediate(() => {
        void syncMetaInsightsForStore(db, storeId).catch((error) => {
          request.log.error(error, "Meta insights sync after account selection failed");
        });
      });
      const status = await getMetaIntegrationForStore(db, storeId);
      return { status };
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid_ad_account";
      if (message === "meta_not_connected") {
        return reply.status(404).send({ error: "Meta not connected", code: message });
      }
      return reply.status(400).send({ error: "Invalid ad account", code: "invalid_ad_account" });
    }
  });

  app.post("/api/v1/integrations/meta/disconnect", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    await disconnectMetaIntegration(db, storeId, env.ENCRYPTION_KEY, env.META_APP_ID!);
    const status = await getMetaIntegrationForStore(db, storeId);
    return { status };
  });
}
