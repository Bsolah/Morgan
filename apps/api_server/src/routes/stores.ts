import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth.js";
import { getDb } from "../lib/db.js";
import { getStoreAlerts } from "../lib/alerts-service.js";
import { getStoreAlert, markAlertRead } from "../lib/alerts-store.js";
import { acceptRecommendation, dismissRecommendation } from "../lib/recommendation-actions.js";
import { getRecommendationDetail } from "../lib/recommendation-detail.js";
import { getStoreRecommendations } from "../lib/recommendations.js";
import { getStoreSyncStatus } from "../lib/sync-status.js";

const dismissSchema = z.object({
  reason: z.enum(["not_relevant", "already_done", "disagree", "other"]),
  comment: z.string().max(500).optional(),
});

export async function storeRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/stores/:storeId/recommendations",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { storeId } = request.params as { storeId: string };

      if (!request.auth!.store_ids.includes(storeId)) {
        return reply.status(403).send({ error: "Access denied for this store" });
      }

      // TODO: read from mart_recommendations when ranking pipeline lands.
      return reply.send(getStoreRecommendations(storeId));
    },
  );

  app.get(
    "/api/v1/stores/:storeId/recommendations/:recommendationId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { storeId, recommendationId } = request.params as {
        storeId: string;
        recommendationId: string;
      };

      if (!request.auth!.store_ids.includes(storeId)) {
        return reply.status(403).send({ error: "Access denied for this store" });
      }

      const detail = getRecommendationDetail(storeId, recommendationId);
      if (!detail) {
        return reply.status(404).send({ error: "Recommendation not found" });
      }

      return reply.send(detail);
    },
  );

  app.post(
    "/api/v1/stores/:storeId/recommendations/:recommendationId/accept",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { storeId, recommendationId } = request.params as {
        storeId: string;
        recommendationId: string;
      };

      if (!request.auth!.store_ids.includes(storeId)) {
        return reply.status(403).send({ error: "Access denied for this store" });
      }

      const detail = getRecommendationDetail(storeId, recommendationId);
      if (!detail) {
        return reply.status(404).send({ error: "Recommendation not found" });
      }

      const result = acceptRecommendation(storeId, recommendationId);
      return reply.send(result);
    },
  );

  app.post(
    "/api/v1/stores/:storeId/recommendations/:recommendationId/dismiss",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { storeId, recommendationId } = request.params as {
        storeId: string;
        recommendationId: string;
      };

      if (!request.auth!.store_ids.includes(storeId)) {
        return reply.status(403).send({ error: "Access denied for this store" });
      }

      const parsed = dismissSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid request" });
      }

      const detail = getRecommendationDetail(storeId, recommendationId);
      if (!detail) {
        return reply.status(404).send({ error: "Recommendation not found" });
      }

      const result = dismissRecommendation(storeId, recommendationId, {
        reason: parsed.data.reason,
        comment: parsed.data.comment,
      });
      return reply.send(result);
    },
  );

  app.get(
    "/api/v1/stores/:storeId/alerts",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { storeId } = request.params as { storeId: string };

      if (!request.auth!.store_ids.includes(storeId)) {
        return reply.status(403).send({ error: "Access denied for this store" });
      }

      return reply.send(getStoreAlerts(storeId));
    },
  );

  app.get(
    "/api/v1/stores/:storeId/alerts/:alertId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { storeId, alertId } = request.params as { storeId: string; alertId: string };

      if (!request.auth!.store_ids.includes(storeId)) {
        return reply.status(403).send({ error: "Access denied for this store" });
      }

      getStoreAlerts(storeId);
      const alert = getStoreAlert(storeId, alertId);
      if (!alert) {
        return reply.status(404).send({ error: "Alert not found" });
      }

      return reply.send(alert);
    },
  );

  app.post(
    "/api/v1/stores/:storeId/alerts/:alertId/read",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { storeId, alertId } = request.params as { storeId: string; alertId: string };

      if (!request.auth!.store_ids.includes(storeId)) {
        return reply.status(403).send({ error: "Access denied for this store" });
      }

      const updated = markAlertRead(storeId, alertId, new Date().toISOString());
      if (!updated) {
        return reply.status(404).send({ error: "Alert not found" });
      }

      return reply.send(updated);
    },
  );

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
