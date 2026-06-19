import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { getDb } from "../lib/db.js";
import { getStoreMetrics } from "../lib/metric-snapshot-service.js";

function canAccessStore(request: { auth?: { store_ids: string[] } }, storeId: string): boolean {
  return request.auth?.store_ids.includes(storeId) ?? false;
}

export async function metricsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/stores/:store_id/metrics", { preHandler: requireAuth }, async (request, reply) => {
    const { store_id: storeId } = request.params as { store_id: string };

    if (!canAccessStore(request, storeId)) {
      return reply.status(403).send({ error: "Forbidden", code: "forbidden" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    return getStoreMetrics(db, storeId);
  });
}
