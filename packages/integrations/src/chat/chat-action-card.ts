import type { ChatDataContext, ChatIntent, ChatSynthesisResult } from "./chat-synthesis.js";

export type ChatRecommendationContext = {
  id: string;
  title: string;
  body: string;
  category: string;
  impact_low_usd: number | null;
  impact_high_usd: number | null;
  status: string;
};

export type ChatActionCard = {
  recommendation_id: string;
  title: string;
  body: string;
  category: string;
  impact_label: string | null;
  status: "open" | "accepted" | "dismissed";
};

export type ChatSynthesisWithAction = ChatSynthesisResult & {
  action_card?: ChatActionCard | null;
};

function formatImpactLabel(low: number | null, high: number | null): string | null {
  if (low == null && high == null) return null;
  const lowValue = low ?? high ?? 0;
  const highValue = high ?? low ?? 0;
  if (Math.round(lowValue) === Math.round(highValue)) {
    return `Impact ~$${Math.round(lowValue).toLocaleString("en-US")}`;
  }
  return `Impact ~$${Math.round(lowValue).toLocaleString("en-US")}–$${Math.round(highValue).toLocaleString("en-US")}`;
}

function shouldAttachActionCard(intent: ChatIntent): boolean {
  return intent.type === "ad_campaigns" || intent.type === "profit_change";
}

export function mapRecommendationToActionCard(
  recommendation: ChatRecommendationContext,
): ChatActionCard {
  const status =
    recommendation.status === "accepted" || recommendation.status === "dismissed"
      ? recommendation.status
      : "open";

  return {
    recommendation_id: recommendation.id,
    title: recommendation.title,
    body: recommendation.body,
    category: recommendation.category,
    impact_label: formatImpactLabel(recommendation.impact_low_usd, recommendation.impact_high_usd),
    status,
  };
}

export function attachChatActionCard(
  result: ChatSynthesisResult,
  context: ChatDataContext & { topRecommendation?: ChatRecommendationContext | null },
): ChatSynthesisWithAction {
  const recommendation = context.topRecommendation;
  if (!recommendation || recommendation.status !== "active") {
    return result;
  }
  if (!shouldAttachActionCard(context.intent)) {
    return result;
  }

  return {
    ...result,
    action_card: mapRecommendationToActionCard(recommendation),
  };
}

export function buildActionAcceptedConfirmation(title: string): string {
  return `Got it — I've marked "${title}" as accepted. I'll track the outcome in your recommendations.`;
}

export function buildActionDismissedConfirmation(title: string): string {
  return `Dismissed "${title}". You can revisit it anytime from Actions.`;
}
