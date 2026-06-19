import { and, eq } from "drizzle-orm";
import { marketingAttributionRules, type Database } from "@morgan/db";
import {
  DEFAULT_ATTRIBUTION_RULES,
  DEFAULT_GOOGLE_ADS_ATTRIBUTION_RULES,
  type AttributionRule,
} from "@morgan/integrations";

export async function ensureDefaultAttributionRules(db: Database, storeId: string): Promise<void> {
  const existing = await db
    .select({ id: marketingAttributionRules.id, channel: marketingAttributionRules.channel })
    .from(marketingAttributionRules)
    .where(eq(marketingAttributionRules.storeId, storeId));

  if (existing.length === 0) {
    await db.insert(marketingAttributionRules).values(
      DEFAULT_ATTRIBUTION_RULES.map((rule, index) => ({
        storeId,
        channel: rule.channel,
        matchField: rule.match_field,
        matchType: rule.match_type,
        pattern: rule.pattern,
        enabled: rule.enabled,
        priority: index,
      })),
    );
    return;
  }

  const hasGoogleRules = existing.some((row) => row.channel === "google_ads");
  if (hasGoogleRules) return;

  const basePriority = existing.length;
  await db.insert(marketingAttributionRules).values(
    DEFAULT_GOOGLE_ADS_ATTRIBUTION_RULES.map((rule, index) => ({
      storeId,
      channel: rule.channel,
      matchField: rule.match_field,
      matchType: rule.match_type,
      pattern: rule.pattern,
      enabled: rule.enabled,
      priority: basePriority + index,
    })),
  );
}

export async function getAttributionRules(db: Database, storeId: string): Promise<AttributionRule[]> {
  await ensureDefaultAttributionRules(db, storeId);

  const rows = await db
    .select()
    .from(marketingAttributionRules)
    .where(and(eq(marketingAttributionRules.storeId, storeId), eq(marketingAttributionRules.enabled, true)))
    .orderBy(marketingAttributionRules.priority);

  return rows.map((row) => ({
    channel: row.channel,
    match_field: row.matchField as AttributionRule["match_field"],
    match_type: row.matchType as AttributionRule["match_type"],
    pattern: row.pattern,
    enabled: row.enabled,
  }));
}
