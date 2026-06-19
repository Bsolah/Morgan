import type { Database } from "@morgan/db";
import { generateChatStarters, type ChatStarter } from "@morgan/integrations";
import { getDailyBrief } from "./brief-service.js";
import { listActiveStoreAlerts } from "./alert-service.js";

export async function getChatStartersForStore(db: Database, storeId: string): Promise<ChatStarter[]> {
  const [brief, alerts] = await Promise.all([
    getDailyBrief(db, storeId),
    listActiveStoreAlerts(db, storeId),
  ]);

  return generateChatStarters({
    headline: brief.has_brief ? brief.headline : null,
    kpiDeltas: brief.kpi_deltas,
    alerts: alerts.map((alert) => ({
      type: alert.type,
      title: alert.title,
      severity: alert.severity,
    })),
  });
}
