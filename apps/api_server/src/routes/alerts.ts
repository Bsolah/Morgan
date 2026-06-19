import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { getDb } from "../lib/db.js";
import { listActiveStoreAlerts } from "../lib/alert-service.js";

function storeIdFromAuth(request: { auth?: { store_ids: string[] } }): string | null {
  return request.auth?.store_ids[0] ?? null;
}

export async function alertsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/alerts/active", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    const alerts = await listActiveStoreAlerts(db, storeId);
    return { alerts };
  });
}
