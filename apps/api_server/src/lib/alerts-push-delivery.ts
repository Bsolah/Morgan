import type { Database } from "@morgan/db";
import { getMobileDeepLink } from "../config.js";
import { env } from "../config.js";
import type { PushNotificationResult } from "./push-notification-service.js";
import { sendFcmToStore } from "./push-notification-service.js";

export async function sendAlertPush(
  db: Database,
  storeId: string,
  input: {
    alertId: string;
    title: string;
    body: string;
    severity: string;
    type: string;
  },
): Promise<PushNotificationResult> {
  if (!env.FCM_SERVER_KEY) {
    return { sent: 0, skipped: true, reason: "fcm_not_configured" };
  }

  const deepLink = getMobileDeepLink(`alerts/${input.alertId}`);

  return sendFcmToStore(db, storeId, {
    title: input.title,
    body: input.body,
    data: {
      type: "alert",
      alert_id: input.alertId,
      alert_type: input.type,
      severity: input.severity,
      deep_link: deepLink,
    },
  });
}
