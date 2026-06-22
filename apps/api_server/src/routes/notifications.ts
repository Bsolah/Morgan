import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireAuth } from "../plugins/auth.js";
import { getDb } from "../lib/db.js";
import {
  getStoreNotificationPrefs,
  updateStoreNotificationPrefs,
} from "../lib/notification-prefs-service.js";
import { registerPushDeviceToken } from "../lib/push-notification-service.js";
import { unsubscribeStoreFromWeeklyDigest } from "../lib/weekly-email-digest-service.js";

function storeIdFromAuth(request: { auth?: { store_ids: string[] } }): string | null {
  return request.auth?.store_ids[0] ?? null;
}

const deviceTokenSchema = z.object({
  token: z.string().min(10).max(512),
  platform: z.enum(["ios", "android", "unknown"]).default("unknown"),
});

const notificationPrefsPatchSchema = z
  .object({
    push_daily_brief: z.boolean().optional(),
    push_warnings: z.boolean().optional(),
    push_critical: z.boolean().optional(),
    quiet_hours_enabled: z.boolean().optional(),
    quiet_hours_start: z.number().int().min(0).max(23).optional(),
    quiet_hours_end: z.number().int().min(0).max(23).optional(),
    weekly_email_digest: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one preference field is required",
  });

export async function notificationsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/v1/notifications/device-token", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const body = deviceTokenSchema.parse(request.body ?? {});
    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    await registerPushDeviceToken(db, {
      storeId,
      userId: request.auth?.sub,
      token: body.token,
      platform: body.platform,
    });

    return reply.status(204).send();
  });

  app.get("/api/v1/notifications/preferences", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    const prefs = await getStoreNotificationPrefs(db, storeId);
    return prefs;
  });

  app.patch("/api/v1/notifications/preferences", { preHandler: requireAuth }, async (request, reply) => {
    const storeId = storeIdFromAuth(request);
    if (!storeId) {
      return reply.status(400).send({ error: "No store in session" });
    }

    const parsed = notificationPrefsPatchSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid notification preferences",
        code: "validation_error",
      });
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).send({ error: "Database not configured", code: "not_configured" });
    }

    const prefs = await updateStoreNotificationPrefs(db, storeId, parsed.data);
    return prefs;
  });

  app.get("/api/v1/notifications/unsubscribe", async (request, reply) => {
    const token = typeof request.query === "object" && request.query !== null
      ? String((request.query as { token?: string }).token ?? "")
      : "";

    if (!token || token.length < 16) {
      return reply.status(400).type("text/html").send(unsubscribeHtml("Invalid unsubscribe link."));
    }

    const db = getDb();
    if (!db) {
      return reply.status(503).type("text/html").send(unsubscribeHtml("Service temporarily unavailable."));
    }

    const result = await unsubscribeStoreFromWeeklyDigest(db, token);
    if (!result.storeId) {
      return reply.status(404).type("text/html").send(unsubscribeHtml("Unsubscribe link not found."));
    }

    const message = result.alreadyUnsubscribed
      ? "You are already unsubscribed from weekly Morgan emails."
      : "You have been unsubscribed from weekly Morgan emails.";

    return reply.status(200).type("text/html").send(unsubscribeHtml(message, true));
  });
}

function unsubscribeHtml(message: string, success = false): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Morgan email preferences</title>
    <style>
      body { font-family: Helvetica, Arial, sans-serif; background: #f5f3ee; color: #54565b; margin: 0; }
      main { max-width: 520px; margin: 48px auto; background: #fff; border: 1px solid #e2e2e6; border-radius: 12px; padding: 32px; }
      h1 { color: #003252; font-size: 24px; margin-top: 0; }
      p { line-height: 1.5; }
      .ok { color: #00b289; font-weight: 700; }
    </style>
  </head>
  <body>
    <main>
      <h1>Email preferences</h1>
      <p class="${success ? "ok" : ""}">${message}</p>
      <p>You can re-enable weekly digests any time in Morgan Settings.</p>
    </main>
  </body>
</html>`;
}
