import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth.js";
import { getDb } from "../lib/db.js";
import { getScenario, listScenarios, saveScenario } from "../lib/scenario-service.js";

function storeIdFromAuth(request: { auth?: { store_ids: string[] } }): string | null {
  return request.auth?.store_ids[0] ?? null;
}

const saveScenarioSchema = z.object({
  scenario_type: z.literal("ad_spend"),
  channel: z.string().min(1),
  spend_change_pct: z.number(),
  title: z.string().min(1),
  inputs: z.record(z.unknown()),
  results: z.record(z.unknown()),
  source: z.string().optional(),
  chat_message_id: z.string().uuid().optional(),
});

const scenarioParamsSchema = z.object({
  scenario_id: z.string().uuid(),
});

export async function scenariosRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/scenarios", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    const items = await listScenarios(db, storeId);
    return { items };
  });

  app.get(
    "/api/v1/scenarios/:scenario_id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const storeId = storeIdFromAuth(request);
      if (!storeId) {
        return reply.status(400).send({ error: "No store in session" });
      }

      const params = scenarioParamsSchema.safeParse(request.params ?? {});
      if (!params.success) {
        return reply.status(400).send({ error: "Invalid scenario id" });
      }

      const db = getDb();
      if (!db) {
        return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
      }

      const scenario = await getScenario(db, storeId, params.data.scenario_id);
      if (!scenario) {
        return reply.status(404).send({ error: "Scenario not found", code: "not_found" });
      }

      return scenario;
    },
  );

  app.post("/api/v1/scenarios", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const body = saveScenarioSchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.status(400).send({ error: "Invalid scenario payload" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    const scenario = await saveScenario(db, storeId, body.data);
    return reply.status(201).send({ scenario });
  });
}
