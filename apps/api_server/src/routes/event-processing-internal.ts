import type { FastifyInstance } from "fastify";
import { env } from "../config.js";
import { getEventProcessingMetrics } from "../lib/ingest-runtime.js";

export async function registerEventProcessingInternalRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/internal/events/processing-metrics", async (request, reply) => {
    const internalKey = request.headers["x-compliance-internal-key"];
    if (!env.COMPLIANCE_INTERNAL_KEY || internalKey !== env.COMPLIANCE_INTERNAL_KEY) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    const metrics = getEventProcessingMetrics();
    if (!metrics) {
      return reply.send({
        updated_at: new Date().toISOString(),
        topics: [],
        status: "runtime_not_initialized",
      });
    }

    return reply.send({
      status: "ok",
      ...metrics.snapshot(),
    });
  });
}
