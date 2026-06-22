import { and, eq } from "drizzle-orm";
import { profitLeaks, type Database } from "@morgan/db";
import { leakBody, leakTitle } from "@morgan/integrations";
import type { AlertRecord, AlertType } from "./alerts-data.js";
import { listStoreAlerts, newAlertId, upsertStoreAlert } from "./alerts-store.js";
import { maybeSendAlertPush } from "./alerts-push.js";

function alertTypeForLeak(leakType: string): AlertType {
  if (leakType === "ad_waste") return "ad_waste";
  return "profit_leak";
}

function formatAmountAtRisk(amount: number | null): string {
  if (amount == null || !Number.isFinite(amount)) return "$0";
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

export function buildProfitLeakAlert(
  storeId: string,
  leak: typeof profitLeaks.$inferSelect,
  now: Date = new Date(),
): AlertRecord {
  const amount = Number(leak.amountAtRiskUsd ?? 0);
  const title = leakTitle(leak.leakType, leak.evidence ?? null);
  const body = leakBody(leak.leakType, leak.evidence ?? null);
  const magnitude = `${formatAmountAtRisk(amount)} at risk`;

  return {
    id: newAlertId(),
    store_id: storeId,
    severity: leak.severity === "critical" ? "critical" : "warning",
    type: alertTypeForLeak(leak.leakType),
    title,
    body,
    magnitude,
    top_driver: title,
    links: {
      recommendation: `/recommendations/${leak.id}`,
      chat: `/chat?starter=${encodeURIComponent(`Why is ${title} a profit leak?`)}`,
    },
    metric_snapshot: {
      leak_id: leak.id,
      leak_type: leak.leakType,
      dedupe_key: leak.dedupeKey,
      amount_at_risk_usd: amount,
      evidence: leak.evidence ?? null,
    },
    read_at: null,
    created_at: now.toISOString(),
  };
}

export async function createAlertsForNewProfitLeaks(
  db: Database,
  storeId: string,
  beforeDedupeKeys: Set<string>,
  now: Date = new Date(),
): Promise<number> {
  const activeLeaks = await db
    .select()
    .from(profitLeaks)
    .where(and(eq(profitLeaks.storeId, storeId), eq(profitLeaks.status, "active")));

  const newLeaks = activeLeaks.filter((leak) => !beforeDedupeKeys.has(leak.dedupeKey));
  if (newLeaks.length === 0) return 0;

  const existingAlerts = listStoreAlerts(storeId);
  let created = 0;

  for (const leak of newLeaks) {
    const existing = existingAlerts.find(
      (alert) =>
        alert.metric_snapshot.leak_id === leak.id ||
        alert.metric_snapshot.dedupe_key === leak.dedupeKey,
    );

    const alert = buildProfitLeakAlert(storeId, leak, now);
    if (existing) {
      alert.id = existing.id;
      alert.read_at = existing.read_at;
      alert.created_at = existing.created_at;
    } else {
      created += 1;
    }

    const saved = upsertStoreAlert(storeId, alert);
    await maybeSendAlertPush(db, storeId, saved, now);
  }

  return created;
}
