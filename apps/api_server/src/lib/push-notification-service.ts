import { eq } from "drizzle-orm";
import { pushDeviceTokens, type Database } from "@morgan/db";
import { env, getMobileDeepLink } from "../config.js";

export type PushNotificationResult = {
  sent: number;
  skipped: boolean;
  reason?: string;
};

export async function sendFcmToStore(
  db: Database,
  storeId: string,
  input: {
    title: string;
    body: string;
    data: Record<string, string>;
  },
): Promise<PushNotificationResult> {
  const tokens = await db
    .select({ token: pushDeviceTokens.token })
    .from(pushDeviceTokens)
    .where(eq(pushDeviceTokens.storeId, storeId));

  if (!env.FCM_SERVER_KEY) {
    return { sent: 0, skipped: true, reason: "fcm_not_configured" };
  }

  if (tokens.length === 0) {
    return { sent: 0, skipped: true, reason: "no_device_tokens" };
  }

  const sent = await sendFcmNotification(
    tokens.map((row) => row.token),
    input.title,
    input.body,
    input.data,
  );

  return { sent, skipped: false };
}

async function sendFcmNotification(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<number> {
  if (!env.FCM_SERVER_KEY || tokens.length === 0) return 0;

  const response = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      authorization: `key=${env.FCM_SERVER_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      registration_ids: tokens,
      notification: { title, body },
      data,
      priority: "high",
    }),
    signal: AbortSignal.timeout(env.FCM_SEND_TIMEOUT_MS),
  });

  if (!response.ok) return 0;

  const payload = (await response.json()) as { success?: number };
  return payload.success ?? 0;
}

export async function sendBriefUpdatedPush(
  db: Database,
  storeId: string,
  headline: string,
): Promise<PushNotificationResult> {
  const title = `Updated brief: ${headline}`;
  const deepLink = getMobileDeepLink("home");

  return sendFcmToStore(db, storeId, {
    title,
    body: headline,
    data: {
      type: "brief_updated",
      deep_link: deepLink,
    },
  });
}

export async function registerPushDeviceToken(
  db: Database,
  input: {
    storeId: string;
    userId?: string | null;
    token: string;
    platform: string;
  },
): Promise<void> {
  await db
    .insert(pushDeviceTokens)
    .values({
      storeId: input.storeId,
      userId: input.userId ?? null,
      token: input.token,
      platform: input.platform,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [pushDeviceTokens.storeId, pushDeviceTokens.token],
      set: {
        userId: input.userId ?? null,
        platform: input.platform,
        updatedAt: new Date(),
      },
    });
}
