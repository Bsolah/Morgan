import type { FastifyInstance } from "fastify";
import { env, getPlaidConfig, isPlaidConfigured } from "../../config.js";
import { getDb } from "../../lib/db.js";
import { syncPlaidTransactionsForItem } from "../../lib/plaid-transaction-sync-service.js";
import {
  isPlaidTransactionsWebhook,
  verifyPlaidWebhook,
  type PlaidWebhookPayload,
} from "../../lib/plaid-webhook-service.js";

export async function plaidWebhookRoutes(app: FastifyInstance) {
  app.post(
    "/webhooks/plaid",
    {
      config: { rawBody: true },
    },
    async (request, reply) => {
      if (!isPlaidConfigured()) {
        return reply.status(503).send({ error: "Plaid is not configured" });
      }

      const rawBody = request.rawBody;
      if (!rawBody || !Buffer.isBuffer(rawBody)) {
        return reply.status(400).send({ error: "Raw body required" });
      }

      let payload: PlaidWebhookPayload;
      const verificationHeader = request.headers["plaid-verification"];

      if (env.PLAID_WEBHOOK_SKIP_VERIFY) {
        payload = JSON.parse(rawBody.toString("utf8")) as PlaidWebhookPayload;
      } else {
        if (typeof verificationHeader !== "string") {
          return reply.status(401).send({ error: "Missing Plaid verification header" });
        }

        try {
          const config = getPlaidConfig();
          payload = await verifyPlaidWebhook({
            verificationHeader,
            rawBody,
            clientId: config.clientId,
            secret: config.secret,
            environment: config.environment,
          });
        } catch (error) {
          request.log.warn(error, "Plaid webhook verification failed");
          return reply.status(401).send({ error: "Invalid Plaid webhook signature" });
        }
      }

      if (!isPlaidTransactionsWebhook(payload)) {
        return reply.send({ received: true, ignored: true });
      }

      const db = getDb();
      if (!db) {
        return reply.status(503).send({ error: "Database not configured" });
      }

      void syncPlaidTransactionsForItem(db, payload.item_id, getPlaidConfig()).catch((error) => {
        request.log.error(error, "Plaid webhook sync failed");
      });

      return reply.send({ received: true });
    },
  );
}
