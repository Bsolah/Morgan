import { randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import {
  chatSessions,
  emailDigestUnsubscribeTokens,
  pushDeviceTokens,
  stores,
  users,
  weeklyEmailDigestSends,
  type Database,
} from "@morgan/db";
import {
  formatMarginTrend,
  formatRunwayLabel,
  formatUsd,
  formatWeekLabel,
  merchantLocalDay,
  shouldSendWeeklyEmailDigest,
  weekStartMondayFromLocalDay,
} from "@morgan/integrations";
import { renderWeeklyDigestEmail, type WeeklyDigestEmailProps } from "@morgan/emails";
import { env, getAppPublicUrl, isResendConfigured } from "../config.js";
import { getCashRunway } from "./cash-runway-service.js";
import { getStoreNotificationPrefs, updateStoreNotificationPrefs } from "./notification-prefs-service.js";
import { getStoreMetrics, metricValue } from "./metric-snapshot-service.js";
import { listActiveProfitLeaks } from "./profit-leak-service.js";
import { getProfitOverview } from "./profit-overview-service.js";
import { getTopOpenRecommendation } from "./recommendation-service.js";
import { sendTransactionalEmail } from "./email-service.js";

export type WeeklyDigestSendResult = {
  sent: boolean;
  skipped: boolean;
  reason?: string;
  week_start?: string;
};

export async function getLastWeeklyDigestWeekStart(
  db: Database,
  storeId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ weekStart: weeklyEmailDigestSends.weekStart })
    .from(weeklyEmailDigestSends)
    .where(eq(weeklyEmailDigestSends.storeId, storeId))
    .orderBy(desc(weeklyEmailDigestSends.weekStart))
    .limit(1);

  return row?.weekStart ?? null;
}

export async function resolveStoreRecipientEmail(
  db: Database,
  storeId: string,
): Promise<string | null> {
  const [tokenRow] = await db
    .select({ email: users.email })
    .from(pushDeviceTokens)
    .innerJoin(users, eq(users.id, pushDeviceTokens.userId))
    .where(eq(pushDeviceTokens.storeId, storeId))
    .orderBy(desc(pushDeviceTokens.updatedAt))
    .limit(1);

  if (tokenRow?.email) return tokenRow.email;

  const [sessionRow] = await db
    .select({ email: users.email })
    .from(chatSessions)
    .innerJoin(users, eq(users.id, chatSessions.userId))
    .where(eq(chatSessions.storeId, storeId))
    .orderBy(desc(chatSessions.updatedAt))
    .limit(1);

  return sessionRow?.email ?? null;
}

export async function ensureEmailDigestUnsubscribeToken(
  db: Database,
  storeId: string,
): Promise<string> {
  const [existing] = await db
    .select({ token: emailDigestUnsubscribeTokens.token })
    .from(emailDigestUnsubscribeTokens)
    .where(eq(emailDigestUnsubscribeTokens.storeId, storeId))
    .limit(1);

  if (existing?.token) return existing.token;

  const token = randomBytes(32).toString("hex");
  await db.insert(emailDigestUnsubscribeTokens).values({ storeId, token });
  return token;
}

export function buildUnsubscribeUrl(token: string): string {
  const base = getAppPublicUrl().replace(/\/$/, "");
  return `${base}/api/v1/notifications/unsubscribe?token=${encodeURIComponent(token)}`;
}

export async function buildWeeklyDigestEmailProps(
  db: Database,
  storeId: string,
  input: {
    shopName: string;
    timezone: string;
    weekStart: string;
    unsubscribeUrl: string;
  },
): Promise<WeeklyDigestEmailProps> {
  const [metrics, overview, leaks, recommendation, runway] = await Promise.all([
    getStoreMetrics(db, storeId),
    getProfitOverview(db, storeId, 7),
    listActiveProfitLeaks(db, storeId),
    getTopOpenRecommendation(db, storeId),
    getCashRunway(db, storeId),
  ]);

  const weekProfit = metricValue(metrics.metrics, "contribution_margin_7d") ?? 0;
  const topLeak = leaks.items[0] ?? null;

  return {
    shopName: input.shopName,
    weekLabel: formatWeekLabel(input.weekStart, input.timezone),
    weekProfitTotal: formatUsd(weekProfit),
    marginTrend: formatMarginTrend({
      currentMarginPct: overview.current_margin_pct,
      marginDeltaPct: overview.margin_delta_pct,
    }),
    topLeakTitle: topLeak?.title ?? null,
    topLeakBody: topLeak?.leak_label ?? null,
    topLeakAmount:
      topLeak?.amount_at_risk_usd != null ? formatUsd(topLeak.amount_at_risk_usd) : null,
    topRecommendationTitle: recommendation?.title ?? null,
    topRecommendationBody: recommendation?.body ?? null,
    runwayLabel: formatRunwayLabel({
      bankConnected: runway.bank_connected,
      runwayDays: runway.runway_days,
      runwayStatus: runway.runway_status,
      message: runway.message,
    }),
    unsubscribeUrl: input.unsubscribeUrl,
    physicalAddress: env.MORGAN_POSTAL_ADDRESS,
  };
}

export async function sendWeeklyEmailDigest(
  db: Database,
  storeId: string,
  options: { force?: boolean; at?: Date } = {},
): Promise<WeeklyDigestSendResult> {
  const [store] = await db
    .select({
      id: stores.id,
      shopDomain: stores.shopDomain,
      timezone: stores.timezone,
    })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);

  if (!store) {
    return { sent: false, skipped: true, reason: "store_not_found" };
  }

  const prefs = await getStoreNotificationPrefs(db, storeId);
  if (!prefs.weekly_email_digest && !options.force) {
    return { sent: false, skipped: true, reason: "weekly_email_digest_disabled" };
  }

  const timezone = store.timezone;
  const at = options.at ?? new Date();
  const localDay = merchantLocalDay(timezone, at);
  const weekStart = weekStartMondayFromLocalDay(localDay, timezone);
  const lastSentWeekStart = await getLastWeeklyDigestWeekStart(db, storeId);

  if (
    !options.force &&
    !shouldSendWeeklyEmailDigest({
      timezone,
      digestTimeLocal: env.WEEKLY_DIGEST_TIME_LOCAL,
      lastSentWeekStart,
      at,
    })
  ) {
    return { sent: false, skipped: true, reason: "not_due", week_start: weekStart };
  }

  if (lastSentWeekStart === weekStart && !options.force) {
    return { sent: false, skipped: true, reason: "already_sent", week_start: weekStart };
  }

  const recipientEmail = await resolveStoreRecipientEmail(db, storeId);
  if (!recipientEmail) {
    return { sent: false, skipped: true, reason: "no_recipient_email", week_start: weekStart };
  }

  if (!isResendConfigured()) {
    return { sent: false, skipped: true, reason: "resend_not_configured", week_start: weekStart };
  }

  const unsubscribeToken = await ensureEmailDigestUnsubscribeToken(db, storeId);
  const unsubscribeUrl = buildUnsubscribeUrl(unsubscribeToken);
  const shopName = store.shopDomain.replace(".myshopify.com", "");
  const emailProps = await buildWeeklyDigestEmailProps(db, storeId, {
    shopName,
    timezone,
    weekStart,
    unsubscribeUrl,
  });

  const rendered = await renderWeeklyDigestEmail(emailProps);
  const delivery = await sendTransactionalEmail({
    to: recipientEmail,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    listUnsubscribeUrl: unsubscribeUrl,
  });

  if (delivery.skipped) {
    return {
      sent: false,
      skipped: true,
      reason: delivery.reason ?? "send_failed",
      week_start: weekStart,
    };
  }

  await db
    .insert(weeklyEmailDigestSends)
    .values({
      storeId,
      weekStart,
      recipientEmail,
      resendMessageId: delivery.messageId ?? null,
    })
    .onConflictDoUpdate({
      target: [weeklyEmailDigestSends.storeId, weeklyEmailDigestSends.weekStart],
      set: {
        recipientEmail,
        sentAt: new Date(),
        resendMessageId: delivery.messageId ?? null,
      },
    });

  return { sent: true, skipped: false, week_start: weekStart };
}

export async function sendDueWeeklyEmailDigests(db: Database): Promise<number> {
  const storeRows = await db.select({ id: stores.id }).from(stores);
  let sent = 0;

  for (const store of storeRows) {
    const result = await sendWeeklyEmailDigest(db, store.id);
    if (result.sent) sent += 1;
  }

  return sent;
}

export async function unsubscribeStoreFromWeeklyDigest(
  db: Database,
  token: string,
): Promise<{ storeId: string | null; alreadyUnsubscribed: boolean }> {
  const [row] = await db
    .select({ storeId: emailDigestUnsubscribeTokens.storeId })
    .from(emailDigestUnsubscribeTokens)
    .where(eq(emailDigestUnsubscribeTokens.token, token))
    .limit(1);

  if (!row) return { storeId: null, alreadyUnsubscribed: false };

  const prefs = await getStoreNotificationPrefs(db, row.storeId);
  if (!prefs.weekly_email_digest) {
    return { storeId: row.storeId, alreadyUnsubscribed: true };
  }

  await updateStoreNotificationPrefs(db, row.storeId, { weekly_email_digest: false });
  return { storeId: row.storeId, alreadyUnsubscribed: false };
}
