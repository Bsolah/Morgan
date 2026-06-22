import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth.js";
import { getDb } from "../lib/db.js";
import {
  acceptRecommendation,
  dismissRecommendation,
  getRecommendation,
  listOpenRecommendations,
} from "../lib/recommendation-service.js";
import {
  buildActionAcceptedConfirmation,
  buildActionDismissedConfirmation,
} from "@morgan/integrations";

function storeIdFromAuth(request: { auth?: { store_ids: string[] } }): string | null {
  return request.auth?.store_ids[0] ?? null;
}

const recommendationParamsSchema = z.object({
  recommendation_id: z.string().uuid(),
});

export async function recommendationsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/recommendations", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    const result = await listOpenRecommendations(db, storeId);
    return result;
  });

  app.get(
    "/api/v1/recommendations/:recommendation_id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const storeId = storeIdFromAuth(request);
      if (!storeId) {
        return reply.status(400).send({ error: "No store in session" });
      }

      const params = recommendationParamsSchema.safeParse(request.params ?? {});
      if (!params.success) {
        return reply.status(400).send({ error: "Invalid recommendation id" });
      }

      const db = getDb();
      if (!db) {
        return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
      }

      const recommendation = await getRecommendation(db, storeId, params.data.recommendation_id);
      if (!recommendation) {
        return reply.status(404).send({ error: "Recommendation not found", code: "not_found" });
      }

      return recommendation;
    },
  );

  app.post(
    "/api/v1/recommendations/:recommendation_id/accept",
    { preHandler: requireAuth },
    async (request, reply) => {
      const storeId = storeIdFromAuth(request);
      if (!storeId) {
        return reply.status(400).send({ error: "No store in session" });
      }

      const params = recommendationParamsSchema.safeParse(request.params ?? {});
      if (!params.success) {
        return reply.status(400).send({ error: "Invalid recommendation id" });
      }

      const db = getDb();
      if (!db) {
        return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
      }

      const recommendation = await acceptRecommendation(db, storeId, params.data.recommendation_id);
      if (!recommendation) {
        return reply.status(404).send({ error: "Recommendation not found", code: "not_found" });
      }

      return {
        recommendation,
        confirmation_message: buildActionAcceptedConfirmation(recommendation.title),
      };
    },
  );

  app.post(
    "/api/v1/recommendations/:recommendation_id/dismiss",
    { preHandler: requireAuth },
    async (request, reply) => {
      const storeId = storeIdFromAuth(request);
      if (!storeId) {
        return reply.status(400).send({ error: "No store in session" });
      }

      const params = recommendationParamsSchema.safeParse(request.params ?? {});
      if (!params.success) {
        return reply.status(400).send({ error: "Invalid recommendation id" });
      }

      const db = getDb();
      if (!db) {
        return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
      }

      const recommendation = await dismissRecommendation(db, storeId, params.data.recommendation_id);
      if (!recommendation) {
        return reply.status(404).send({ error: "Recommendation not found", code: "not_found" });
      }

      return {
        recommendation,
        confirmation_message: buildActionDismissedConfirmation(recommendation.title),
      };
    },
  );
}
