import type { FastifyInstance, FastifyReply } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { integrations } from "@morgan/db";
import { XERO_OAUTH_ERROR_MESSAGES, buildXeroAuthorizeUrl } from "@morgan/integrations";
import { requireAuth } from "../plugins/auth.js";
import {
  env,
  getMobileDeepLink,
  getXeroOAuthCallbackUrl,
  isXeroOAuthConfigured,
} from "../config.js";
import { getDb } from "../lib/db.js";
import { consumeXeroOAuthState, createXeroOAuthState } from "../lib/xero-oauth-state.js";
import {
  completeXeroOAuth,
  disconnectXeroIntegration,
  getXeroIntegrationForStore,
  listXeroTenants,
  selectXeroTenant,
} from "../lib/xero-integration-service.js";
import {
  listXeroAccountMappings,
  updateXeroAccountMappings,
} from "../lib/xero-account-mapping-service.js";

const selectTenantSchema = z.object({
  tenant_id: z.string().min(1),
});

const updateAccountMappingsSchema = z.object({
  mappings: z.array(
    z.object({
      xero_account_id: z.string().min(1),
      morgan_category: z.enum(["cogs", "shipping", "marketing", "opex", "other", "unmapped"]),
    }),
  ),
});

function storeIdFromAuth(request: { auth?: { store_ids: string[] } }): string | null {
  return request.auth?.store_ids[0] ?? null;
}

function redirectMobile(reply: FastifyReply, path: string, params: Record<string, string>) {
  return reply.redirect(getMobileDeepLink(path, params));
}

function redirectMobileXeroError(
  reply: FastifyReply,
  code: keyof typeof XERO_OAUTH_ERROR_MESSAGES,
) {
  return redirectMobile(reply, "settings/integrations", { xero_error: code });
}

export async function xeroIntegrationRoutes(app: FastifyInstance) {
  app.get("/api/v1/integrations/xero", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    return getXeroIntegrationForStore(db, storeId);
  });

  app.get("/api/v1/integrations/xero/oauth/start", async (request, reply) => {
    if (!isXeroOAuthConfigured()) {
      return reply.status(503).send({
        error: XERO_OAUTH_ERROR_MESSAGES.not_configured,
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

    const state = createXeroOAuthState({
      storeId,
      userId: auth.sub,
      orgId: auth.org_id,
      platform,
    });

    const authorizeUrl = buildXeroAuthorizeUrl({
      clientId: env.XERO_CLIENT_ID!,
      redirectUri: getXeroOAuthCallbackUrl(),
      state,
    });

    if (platform === "mobile") {
      return { authorize_url: authorizeUrl };
    }

    return reply.redirect(authorizeUrl);
  });

  app.get("/api/v1/integrations/xero/oauth/callback", async (request, reply) => {
    if (!isXeroOAuthConfigured()) {
      return redirectMobileXeroError(reply, "not_configured");
    }

    const query = request.query as Record<string, string>;
    const { code, state, error, error_description: errorDescription } = query;

    if (error) {
      request.log.warn({ error, errorDescription }, "Xero OAuth denied");
      return redirectMobileXeroError(
        reply,
        error === "access_denied" ? "access_denied" : "server_error",
      );
    }

    if (!code || !state) {
      return redirectMobileXeroError(reply, "invalid_state");
    }

    const oauthState = consumeXeroOAuthState(state);
    if (!oauthState) {
      return redirectMobileXeroError(reply, "invalid_state");
    }

    const db = getDb();
    if (!db) {
      return redirectMobileXeroError(reply, "server_error");
    }

    try {
      const result = await completeXeroOAuth(db, {
        storeId: oauthState.storeId,
        clientId: env.XERO_CLIENT_ID!,
        clientSecret: env.XERO_CLIENT_SECRET!,
        redirectUri: getXeroOAuthCallbackUrl(),
        code,
        encryptionKey: env.ENCRYPTION_KEY,
      });

      const status = result.needsTenantSelection ? "select_tenant" : "connected";
      return redirectMobile(reply, "settings/integrations", { xero_status: status });
    } catch (callbackError) {
      request.log.error(callbackError, "Xero OAuth callback failed");
      const message = callbackError instanceof Error ? callbackError.message : "";
      if (message === "missing_tenant") {
        return redirectMobileXeroError(reply, "missing_tenant");
      }
      return redirectMobileXeroError(reply, "token_exchange_failed");
    }
  });

  app.get("/api/v1/integrations/xero/tenants", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    const tenants = await listXeroTenants(db, storeId);
    return { tenants };
  });

  app.post("/api/v1/integrations/xero/tenant", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const parsed = selectTenantSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid tenant selection", code: "invalid_tenant" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    try {
      const status = await selectXeroTenant(
        db,
        storeId,
        parsed.data.tenant_id,
        env.ENCRYPTION_KEY,
      );
      return { status };
    } catch (error) {
      const message = error instanceof Error ? error.message : "selection_failed";
      if (message === "tenant_not_found") {
        return reply.status(404).send({ error: "Tenant not found", code: "tenant_not_found" });
      }
      return reply.status(502).send({ error: "Could not select tenant", code: "selection_failed" });
    }
  });

  app.get(
    "/api/v1/integrations/xero/account-mappings",
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

      const mappings = await listXeroAccountMappings(db, storeId);
      return { mappings };
    },
  );

  app.put(
    "/api/v1/integrations/xero/account-mappings",
    { preHandler: requireAuth },
    async (request, reply) => {
      const storeId = storeIdFromAuth(request);
      if (!storeId) {
        return reply.status(400).send({ error: "No store in session" });
      }

      const parsed = updateAccountMappingsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid account mappings", code: "invalid_mappings" });
      }

      const db = getDb();
      if (!db) {
        return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
      }

      const [integration] = await db
        .select({ id: integrations.id })
        .from(integrations)
        .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "xero")))
        .limit(1);

      if (!integration) {
        return reply.status(404).send({ error: "Xero is not connected", code: "not_connected" });
      }

      try {
        const mappings = await updateXeroAccountMappings(
          db,
          storeId,
          integration.id,
          parsed.data.mappings,
        );

        setImmediate(() => {
          void import("../lib/xero-sync-service.js").then(({ syncXeroBooksForStore }) =>
            syncXeroBooksForStore(db, storeId).catch(() => undefined),
          );
        });

        return { mappings };
      } catch (error) {
        const message = error instanceof Error ? error.message : "update_failed";
        if (message === "invalid_category") {
          return reply.status(400).send({ error: "Invalid category", code: "invalid_category" });
        }
        return reply.status(502).send({ error: "Could not save mappings", code: "update_failed" });
      }
    },
  );

  app.post("/api/v1/integrations/xero/disconnect", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    const status = await disconnectXeroIntegration(db, storeId, {
      encryptionKey: env.ENCRYPTION_KEY,
    });

    return { status };
  });
}
