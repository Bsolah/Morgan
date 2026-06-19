import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { customerDataRequests } from "@morgan/db";
import { env } from "../config.js";
import { getDb } from "../lib/db.js";

function requireInternalKey(request: FastifyRequest, reply: FastifyReply): boolean {
  const key = request.headers["x-compliance-internal-key"];
  if (!env.COMPLIANCE_INTERNAL_KEY || key !== env.COMPLIANCE_INTERNAL_KEY) {
    reply.status(401).send({ error: "Unauthorized", code: "unauthorized" });
    return false;
  }
  return true;
}

export async function complianceRoutes(app: FastifyInstance) {
  app.get("/api/v1/compliance/exports/:request_id", async (request, reply) => {
    if (!requireInternalKey(request, reply)) return;

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    const { request_id: requestId } = request.params as { request_id: string };
    const [row] = await db
      .select()
      .from(customerDataRequests)
      .where(eq(customerDataRequests.id, requestId))
      .limit(1);

    if (!row) {
      return reply.status(404).send({ error: "Export not found", code: "not_found" });
    }

    return reply.send({
      id: row.id,
      store_id: row.storeId,
      shopify_customer_id: row.shopifyCustomerId,
      customer_email: row.customerEmail,
      data_request_id: row.dataRequestId,
      status: row.status,
      requested_at: row.requestedAt.toISOString(),
      completed_at: row.completedAt?.toISOString() ?? null,
      export: row.exportJson,
    });
  });
}
