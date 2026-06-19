import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth.js";
import { getDb } from "../lib/db.js";
import {
  createChatSession,
  getChatSession,
  listChatMessages,
  sendChatMessageStream,
} from "../lib/chat-service.js";
import { getChatStartersForStore } from "../lib/chat-starters-service.js";

function storeIdFromAuth(request: { auth?: { store_ids: string[] } }): string | null {
  return request.auth?.store_ids[0] ?? null;
}

const sessionParamsSchema = z.object({
  session_id: z.string().uuid(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/chat/starters", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    try {
      const starters = await getChatStartersForStore(db, storeId);
      return { starters };
    } catch (error) {
      request.log.error(error, "Failed to build chat starters");
      return reply.status(503).send({ error: "Chat starters unavailable", code: "not_ready" });
    }
  });

  app.post("/api/v1/chat/sessions", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    try {
      const session = await createChatSession(db, storeId, request.auth?.sub);
      return reply.status(201).send(session);
    } catch (error) {
      request.log.error(error, "Failed to create chat session");
      return reply.status(500).send({ error: "Failed to create chat session", code: "server_error" });
    }
  });

  app.get("/api/v1/chat/sessions/:session_id/messages", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const params = sessionParamsSchema.safeParse(request.params ?? {});
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid session id" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    const session = await getChatSession(db, storeId, params.data.session_id);
    if (!session) {
      return reply.status(404).send({ error: "Chat session not found", code: "not_found" });
    }

    const messages = await listChatMessages(db, storeId, params.data.session_id);
    return { session_id: params.data.session_id, messages };
  });

  app.post(
    "/api/v1/chat/sessions/:session_id/messages",
    { preHandler: requireAuth },
    async (request, reply) => {
      const storeId = storeIdFromAuth(request);
      if (!storeId) {
        return reply.status(400).send({ error: "No store in session" });
      }

      const params = sessionParamsSchema.safeParse(request.params ?? {});
      if (!params.success) {
        return reply.status(400).send({ error: "Invalid session id" });
      }

      const body = sendMessageSchema.safeParse(request.body ?? {});
      if (!body.success) {
        return reply.status(400).send({ error: "Invalid message body" });
      }

      const db = getDb();
      if (!db) {
        return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
      }

      await sendChatMessageStream(db, storeId, params.data.session_id, body.data.content, reply);
    },
  );
}
