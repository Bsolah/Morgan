import { and, desc, eq, sql } from "drizzle-orm";
import { profitLeaks, type Database } from "@morgan/db";
import { formatLeakEvidenceRows, leakBody, leakTitle, leakTypeLabel } from "@morgan/integrations";

export type ProfitLeakListItemView = {
  id: string;
  leak_type: string;
  leak_label: string;
  severity: string;
  amount_at_risk_usd: number | null;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ProfitLeakListView = {
  store_id: string;
  last_scan_at: string | null;
  items: ProfitLeakListItemView[];
};

export type ProfitLeakDetailView = {
  id: string;
  leak_type: string;
  leak_label: string;
  severity: string;
  status: string;
  amount_at_risk_usd: number | null;
  title: string;
  body: string;
  evidence: Array<Record<string, unknown>> | null;
  evidence_rows: Array<{ label: string; value: string }>;
  recommendation_id: string;
  created_at: string;
  updated_at: string;
};

function toAmount(value: unknown): number | null {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : null;
}

export async function listActiveProfitLeaks(db: Database, storeId: string): Promise<ProfitLeakListView> {
  const items = await db
    .select()
    .from(profitLeaks)
    .where(and(eq(profitLeaks.storeId, storeId), eq(profitLeaks.status, "active")))
    .orderBy(desc(profitLeaks.amountAtRiskUsd))
    .limit(20);

  const [scanRow] = await db
    .select({ last_scan_at: sql<string | null>`max(${profitLeaks.updatedAt})` })
    .from(profitLeaks)
    .where(eq(profitLeaks.storeId, storeId))
    .limit(1);

  return {
    store_id: storeId,
    last_scan_at: scanRow?.last_scan_at ? new Date(scanRow.last_scan_at).toISOString() : null,
    items: items.map((row) => ({
      id: row.id,
      leak_type: row.leakType,
      leak_label: leakTypeLabel(row.leakType),
      severity: row.severity,
      amount_at_risk_usd: toAmount(row.amountAtRiskUsd),
      title: leakTitle(row.leakType, row.evidence ?? null),
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    })),
  };
}

export async function getProfitLeakDetail(
  db: Database,
  storeId: string,
  leakId: string,
): Promise<ProfitLeakDetailView | null> {
  const [row] = await db
    .select()
    .from(profitLeaks)
    .where(and(eq(profitLeaks.id, leakId), eq(profitLeaks.storeId, storeId)))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    leak_type: row.leakType,
    leak_label: leakTypeLabel(row.leakType),
    severity: row.severity,
    status: row.status,
    amount_at_risk_usd: toAmount(row.amountAtRiskUsd),
    title: leakTitle(row.leakType, row.evidence ?? null),
    body: leakBody(row.leakType, row.evidence ?? null),
    evidence: row.evidence ?? null,
    evidence_rows: formatLeakEvidenceRows(row.leakType, row.evidence ?? null),
    recommendation_id: row.id,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

