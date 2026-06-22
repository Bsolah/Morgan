import { addDays } from "@morgan/integrations";
import type { Database } from "@morgan/db";
import { estimateDailyRefundsUsd, type DailyRefundRow } from "@morgan/integrations";
import { getSqlAgentService } from "./sql-agent-service.js";

export async function loadRefundSpikeDailyTotals(
  _db: Database,
  storeId: string,
  referenceDay: string,
): Promise<DailyRefundRow[]> {
  const agent = await getSqlAgentService();
  if (!agent) return [];

  const startDate = addDays(referenceDay, -7);
  const result = await agent.runStandardMetricQuery("orders_daily", {
    store_id: storeId,
    start_date: startDate,
    end_date: referenceDay,
  });

  return result.rows.map((row) => ({
    day: String(row.day),
    refunds_usd: estimateDailyRefundsUsd({
      gross_revenue: Number(row.gross_revenue ?? 0),
      discounts: Number(row.discounts ?? 0),
      cogs: Number(row.cogs ?? 0),
      contribution_margin: Number(row.contribution_margin ?? 0),
    }),
  }));
}
