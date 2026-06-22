import type { AdSpendScenarioResult } from "../forecast/ad-spend-scenario.js";
import type { InventoryPurchaseScenarioResult } from "../forecast/inventory-purchase-scenario.js";
import type { ChatSynthesisResult } from "./chat-synthesis.js";

export type AdSpendScenarioSavePayload = {
  scenario_type: "ad_spend";
  channel: string;
  spend_change_pct: number;
  title: string;
  inputs: Record<string, unknown>;
  results: AdSpendScenarioResult;
};

export type InventoryPurchaseScenarioSavePayload = {
  scenario_type: "inventory_purchase";
  title: string;
  inputs: Record<string, unknown>;
  results: InventoryPurchaseScenarioResult;
};

export type ScenarioSavePayload = AdSpendScenarioSavePayload | InventoryPurchaseScenarioSavePayload;

export type ChatScenarioCard = {
  title: string;
  forecast: AdSpendScenarioResult;
  save_payload: ScenarioSavePayload;
  saved: boolean;
  scenario_id: string | null;
};

export type ChatSynthesisWithScenario = ChatSynthesisResult & {
  scenario_card?: ChatScenarioCard | null;
  scenario_raw_values?: Record<string, unknown>;
};
