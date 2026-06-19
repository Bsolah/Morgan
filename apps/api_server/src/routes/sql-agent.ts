import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { SqlGuardrailError, type StandardMetricQueryId } from "@morgan/warehouse";
import { requireAuth } from "../plugins/auth.js";
import { getSqlAgentService } from "../lib/sql-agent-service.js";

const metricQuerySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  query_id: z.enum(["orders_daily", "ad_performance", "sku_economics"]),
});

const customQuerySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sql: z.string().min(1),
});

export async function sqlAgentRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/v1/stores/:store_id/sql-agent/metrics", { preHandler: requireAuth }, async (request, reply) => {
    const agent = await getSqlAgentService();
    if (!agent) {
      return reply.status(503).send({ error: "SQL agent not configured", code: "sql_agent_unavailable" });
    }

    const { store_id: storeId } = request.params as { store_id: string };
    const body = metricQuerySchema.parse(request.body ?? {});

    try {
      const result = await agent.runStandardMetricQuery(body.query_id as StandardMetricQueryId, {
        store_id: storeId,
        start_date: body.start_date,
        end_date: body.end_date,
      });

      return reply.send({
        query_id: body.query_id,
        store_id: storeId,
        ...result,
      });
    } catch (error) {
      if (error instanceof SqlGuardrailError) {
        return reply.status(400).send({ error: error.message, code: error.code });
      }
      throw error;
    }
  });

  app.post("/api/v1/stores/:store_id/sql-agent/query", { preHandler: requireAuth }, async (request, reply) => {
    const agent = await getSqlAgentService();
    if (!agent) {
      return reply.status(503).send({ error: "SQL agent not configured", code: "sql_agent_unavailable" });
    }

    const { store_id: storeId } = request.params as { store_id: string };
    const body = customQuerySchema.parse(request.body ?? {});

    try {
      const result = await agent.runValidatedQuery(body.sql, {
        store_id: storeId,
        start_date: body.start_date,
        end_date: body.end_date,
      });

      return reply.send({
        store_id: storeId,
        ...result,
      });
    } catch (error) {
      if (error instanceof SqlGuardrailError) {
        return reply.status(400).send({ error: error.message, code: error.code });
      }
      throw error;
    }
  });
}
