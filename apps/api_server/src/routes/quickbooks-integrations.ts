import type { FastifyInstance, FastifyReply } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { integrations } from "@morgan/db";
import {
  QUICKBOOKS_OAUTH_ERROR_MESSAGES,
  buildQuickBooksAuthorizeUrl,
} from "@morgan/integrations";
import { requireAuth } from "../plugins/auth.js";
import {
  env,
  getMobileDeepLink,
  getQuickBooksOAuthCallbackUrl,
  isQuickBooksOAuthConfigured,
} from "../config.js";
import { getDb } from "../lib/db.js";
import {
  consumeQuickBooksOAuthState,
  createQuickBooksOAuthState,
} from "../lib/quickbooks-oauth-state.js";
import {
  completeQuickBooksOAuth,
  disconnectQuickBooksIntegration,
  getQuickBooksIntegrationForStore,
  listQuickBooksCompanies,
  selectQuickBooksCompany,
} from "../lib/quickbooks-integration-service.js";
import {
  listQuickBooksAccountMappings,
  updateQuickBooksAccountMappings,
} from "../lib/quickbooks-account-mapping-service.js";

const selectCompanySchema = z.object({
  realm_id: z.string().min(1),
});

const updateAccountMappingsSchema = z.object({
  mappings: z.array(
    z.object({
      qbo_account_id: z.string().min(1),
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

function redirectMobileQuickBooksError(
  reply: FastifyReply,
  code: keyof typeof QUICKBOOKS_OAUTH_ERROR_MESSAGES,
) {
  return redirectMobile(reply, "settings/integrations", { qb_error: code });
}

export async function quickbooksIntegrationRoutes(app: FastifyInstance) {
  app.get("/api/v1/integrations/quickbooks", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    return getQuickBooksIntegrationForStore(db, storeId);
  });

  app.get("/api/v1/integrations/quickbooks/oauth/start", async (request, reply) => {
    if (!isQuickBooksOAuthConfigured()) {
      return reply.status(503).send({
        error: QUICKBOOKS_OAUTH_ERROR_MESSAGES.not_configured,
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

    const state = createQuickBooksOAuthState({
      storeId,
      userId: auth.sub,
      orgId: auth.org_id,
      platform,
    });

    const authorizeUrl = buildQuickBooksAuthorizeUrl({
      clientId: env.INTUIT_CLIENT_ID!,
      redirectUri: getQuickBooksOAuthCallbackUrl(),
      state,
    });

    if (platform === "mobile") {
      return { authorize_url: authorizeUrl };
    }

    return reply.redirect(authorizeUrl);
  });

  app.get("/api/v1/integrations/quickbooks/oauth/callback", async (request, reply) => {
    if (!isQuickBooksOAuthConfigured()) {
      return redirectMobileQuickBooksError(reply, "not_configured");
    }

    const query = request.query as Record<string, string>;
    const { code, state, realmId, error, error_description: errorDescription } = query;

    if (error) {
      request.log.warn({ error, errorDescription }, "QuickBooks OAuth denied");
      return redirectMobileQuickBooksError(
        reply,
        error === "access_denied" ? "access_denied" : "server_error",
      );
    }

    if (!code || !state || !realmId) {
      return redirectMobileQuickBooksError(reply, !realmId ? "missing_realm" : "invalid_state");
    }

    const oauthState = consumeQuickBooksOAuthState(state);
    if (!oauthState) {
      return redirectMobileQuickBooksError(reply, "invalid_state");
    }

    const db = getDb();
    if (!db) {
      return redirectMobileQuickBooksError(reply, "server_error");
    }

    try {
      const result = await completeQuickBooksOAuth(db, {
        storeId: oauthState.storeId,
        clientId: env.INTUIT_CLIENT_ID!,
        clientSecret: env.INTUIT_CLIENT_SECRET!,
        redirectUri: getQuickBooksOAuthCallbackUrl(),
        code,
        realmId,
        environment: env.INTUIT_ENV,
        encryptionKey: env.ENCRYPTION_KEY,
      });

      const status = result.needsCompanySelection ? "select_company" : "connected";
      return redirectMobile(reply, "settings/integrations", { qb_status: status });
    } catch (callbackError) {
      request.log.error(callbackError, "QuickBooks OAuth callback failed");
      return redirectMobileQuickBooksError(reply, "token_exchange_failed");
    }
  });

  app.get(
    "/api/v1/integrations/quickbooks/companies",
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

      const companies = await listQuickBooksCompanies(db, storeId);
      return { companies };
    },
  );

  app.post(
    "/api/v1/integrations/quickbooks/company",
    { preHandler: requireAuth },
    async (request, reply) => {
      const storeId = storeIdFromAuth(request);
      if (!storeId) {
        return reply.status(400).send({ error: "No store in session" });
      }

      const parsed = selectCompanySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid company selection", code: "invalid_company" });
      }

      const db = getDb();
      if (!db) {
        return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
      }

      try {
        const status = await selectQuickBooksCompany(
          db,
          storeId,
          parsed.data.realm_id,
          env.ENCRYPTION_KEY,
        );
        return { status };
      } catch (error) {
        const message = error instanceof Error ? error.message : "selection_failed";
        if (message === "company_not_found") {
          return reply.status(404).send({ error: "Company not found", code: "company_not_found" });
        }
        return reply.status(502).send({ error: "Could not select company", code: "selection_failed" });
      }
    },
  );

  app.get(
    "/api/v1/integrations/quickbooks/account-mappings",
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

      const mappings = await listQuickBooksAccountMappings(db, storeId);
      return { mappings };
    },
  );

  app.put(
    "/api/v1/integrations/quickbooks/account-mappings",
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
        .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "quickbooks")))
        .limit(1);

      if (!integration) {
        return reply.status(404).send({ error: "QuickBooks is not connected", code: "not_connected" });
      }

      try {
        const mappings = await updateQuickBooksAccountMappings(
          db,
          storeId,
          integration.id,
          parsed.data.mappings,
        );

        setImmediate(() => {
          void import("../lib/quickbooks-sync-service.js").then(({ syncQuickBooksBooksForStore }) =>
            syncQuickBooksBooksForStore(db, storeId).catch(() => undefined),
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

  app.post(
    "/api/v1/integrations/quickbooks/disconnect",
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

      if (!isQuickBooksOAuthConfigured()) {
        return reply.status(503).send({ error: "QuickBooks is not configured", code: "not_configured" });
      }

      const status = await disconnectQuickBooksIntegration(db, storeId, {
        clientId: env.INTUIT_CLIENT_ID!,
        clientSecret: env.INTUIT_CLIENT_SECRET!,
        encryptionKey: env.ENCRYPTION_KEY,
      });

      return { status };
    },
  );
}
