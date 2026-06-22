import { desc, eq } from "drizzle-orm";
import { scenarios, type Database } from "@morgan/db";
import type { ScenarioSavePayload } from "@morgan/integrations";

export type ScenarioView = {
  id: string;
  scenario_type: string;
  title: string;
  channel: string | null;
  spend_change_pct: number | null;
  inputs: Record<string, unknown>;
  results: Record<string, unknown>;
  source: string;
  created_at: string;
};

function mapRow(row: typeof scenarios.$inferSelect): ScenarioView {
  return {
    id: row.id,
    scenario_type: row.scenarioType,
    title: row.title,
    channel: row.channel,
    spend_change_pct: row.spendChangePct ? Number(row.spendChangePct) : null,
    inputs: row.inputs ?? {},
    results: row.results ?? {},
    source: row.source,
    created_at: row.createdAt.toISOString(),
  };
}

export async function saveScenario(
  db: Database,
  storeId: string,
  payload: ScenarioSavePayload & { source?: string; chat_message_id?: string | null },
  userId?: string | null,
): Promise<ScenarioView> {
  const [row] = await db
    .insert(scenarios)
    .values({
      storeId,
      userId: userId ?? null,
      scenarioType: payload.scenario_type,
      title: payload.title,
      channel: payload.scenario_type === "ad_spend" ? payload.channel : null,
      spendChangePct:
        payload.scenario_type === "ad_spend" ? String(payload.spend_change_pct) : null,
      inputs: payload.inputs,
      results: payload.results,
      source: payload.source ?? "chat",
      chatMessageId: payload.chat_message_id ?? null,
    })
    .returning();

  return mapRow(row!);
}

export async function getScenario(
  db: Database,
  storeId: string,
  scenarioId: string,
): Promise<ScenarioView | null> {
  const [row] = await db
    .select()
    .from(scenarios)
    .where(eq(scenarios.id, scenarioId))
    .limit(1);

  if (!row || row.storeId !== storeId) return null;
  return mapRow(row);
}

export async function listScenarios(db: Database, storeId: string): Promise<ScenarioView[]> {
  const rows = await db
    .select()
    .from(scenarios)
    .where(eq(scenarios.storeId, storeId))
    .orderBy(desc(scenarios.createdAt));
  return rows.map(mapRow);
}
