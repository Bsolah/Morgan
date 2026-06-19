import type { AdSpendScenarioResult } from "../forecast/ad-spend-scenario.js";
import type { ChatSynthesisResult } from "./chat-synthesis.js";

export type ScenarioSavePayload = {
  scenario_type: "ad_spend";
  channel: string;
  spend_change_pct: number;
  title: string;
  inputs: Record<string, unknown>;
  results: AdSpendScenarioResult;
};

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
