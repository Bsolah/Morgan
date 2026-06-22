import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { getDb } from "../lib/db.js";
import { getPricingSuggestions } from "../lib/pricing-suggestions-service.js";

function storeIdFromAuth(request: { auth?: { store_ids: string[] } }): string | null {
  return request.auth?.store_ids[0] ?? null;
}

export async function pricingRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/pricing/suggestions", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    try {
      return await getPricingSuggestions(db, storeId);
    } catch (error) {
      request.log.error(error, "Failed to load pricing suggestions");
      return reply.status(503).send({ error: "Pricing suggestions unavailable", code: "not_ready" });
    }
  });
}
