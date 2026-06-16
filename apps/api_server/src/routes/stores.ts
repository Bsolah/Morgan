import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { getDb } from "../lib/db.js";
import { getStoreSyncStatus } from "../lib/sync-status.js";

export async function storeRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/stores/:storeId/sync/status",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { storeId } = request.params as { storeId: string };

      if (!request.auth!.store_ids.includes(storeId)) {
        return reply.status(403).send({ error: "Access denied for this store" });
      }

      const db = getDb();
      if (!db) {
        return reply.status(503).send({ error: "Database unavailable" });
      }

      const status = await getStoreSyncStatus(db, storeId);
      if (!status) {
        return reply.status(404).send({ error: "Store not found" });
      }

      return reply.send(status);
    },
  );
}
