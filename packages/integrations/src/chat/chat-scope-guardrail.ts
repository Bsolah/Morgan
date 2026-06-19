import type { ChatSynthesisResult } from "./chat-synthesis.js";

export type OutOfScopeCategory = "tax" | "legal" | "investment";

export const OUT_OF_SCOPE_REFUSAL_ANSWER =
  "I can't provide tax/legal advice. I can show you the underlying profit data.";

const REDIRECT_FOLLOW_UPS: Record<OutOfScopeCategory, string[]> = {
  tax: ["What was my profit last month?", "Show my contribution margin trend"],
  legal: ["What is my cash runway?", "Why did profit drop yesterday?"],
  investment: ["What is my cash runway?", "Which campaigns should I pause?"],
};

const IN_SCOPE_METRIC_PATTERNS = [
  /\b(profit|margin|runway|cash flow|revenue|poas|roas|mer|ad spend|campaign|contribution|refund|sku|stockout|inventory level)\b/,
  /\b(pause|underperform|brief|payout|orders_daily)\b/,
  /\b(what if|what happens if|scenario|project|forecast)\b/,
  /\bhow much\b.*\b(collected|remitted|spent|earned)\b/,
];

const TAX_ADVICE_PATTERNS = [
  /\b(file|filing|pay)\b.*\b(tax return|taxes|quarterly)\b/,
  /\btax(es)?\b.*\b(filing|advice|planning|strategy|return|deduction|write[- ]?off|evasion|avoidance)\b/,
  /\b(irs|1099|schedule c|form 1040)\b/,
  /\b(minimize|reduce|lower|avoid)\b.*\btaxes\b/,
  /\bwhat can i (deduct|write off)\b/,
  /\bhow (?:do|can) i (?:file|claim|deduct)\b/,
  /\bsales tax return\b/,
  /\btax(?:able)? income reporting\b/,
];

const LEGAL_ADVICE_PATTERNS = [
  /\b(llc|s-corp|s corp|c-corp|c corp|incorporation|incorporate)\b/,
  /\blegal (?:structure|advice|entity)\b/,
  /\bentity (?:structure|formation|type)\b/,
  /\b(should i form|which entity|offshore structure)\b/,
  /\b(trademark|contract lawyer|litigation|sue my supplier)\b/,
  /\bregister (?:an? )?(?:llc|corporation|company)\b/,
];

const INVESTMENT_ADVICE_PATTERNS = [
  /\b(invest in|buy|purchase)\b.*\b(stocks?|bitcoin|crypto|ethereum|etf|etfs|bonds|securities|mutual funds?|index funds?)\b/,
  /\binvest\b.*\bin\b.*\b(stocks?|bitcoin|crypto|ethereum|etf|etfs|bonds|securities)\b/,
  /\bshould i invest\b.*\b(money|profits|cash|revenue)\b/,
  /\binvestment advice\b/,
  /\b(should i buy|recommend)\b.*\b(stocks?|bitcoin|crypto|etf|etfs|bonds)\b/,
  /\bportfolio allocation\b/,
  /\bwhere should i (?:invest|put) (?:my )?(?:money|profits)\b/,
  /\b(?:put|invest) (?:my )?(?:profits|cash) in(?:to)?\b.*\b(stocks?|crypto|market|bitcoin|etf|etfs)\b/,
];

function matchesAny(patterns: RegExp[], text: string): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function isInScopeStoreFinanceQuestion(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return false;

  if (matchesAny(TAX_ADVICE_PATTERNS, normalized)) return false;
  if (matchesAny(LEGAL_ADVICE_PATTERNS, normalized)) return false;
  if (matchesAny(INVESTMENT_ADVICE_PATTERNS, normalized)) return false;

  return matchesAny(IN_SCOPE_METRIC_PATTERNS, normalized);
}

export function isTaxAdviceRequest(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (/(how much|what|show).*(sales tax|tax collected)/.test(normalized)) {
    return false;
  }
  return matchesAny(TAX_ADVICE_PATTERNS, normalized);
}

export function isLegalAdviceRequest(message: string): boolean {
  return matchesAny(LEGAL_ADVICE_PATTERNS, message.trim().toLowerCase());
}

export function isInvestmentAdviceRequest(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (/\binvest in (?:more )?(?:inventory|stock units|units|sku)\b/.test(normalized)) {
    return false;
  }
  return matchesAny(INVESTMENT_ADVICE_PATTERNS, normalized);
}

export function detectOutOfScopeChatRequest(message: string): OutOfScopeCategory | null {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return null;

  if (isInScopeStoreFinanceQuestion(normalized)) return null;
  if (isTaxAdviceRequest(normalized)) return "tax";
  if (isLegalAdviceRequest(normalized)) return "legal";
  if (isInvestmentAdviceRequest(normalized)) return "investment";

  return null;
}

export function buildOutOfScopeChatRefusal(category: OutOfScopeCategory): ChatSynthesisResult {
  return {
    answer: OUT_OF_SCOPE_REFUSAL_ANSWER,
    citations: [],
    confidence: "high",
    follow_ups: REDIRECT_FOLLOW_UPS[category],
  };
}

export function enforceChatScopeGuardrail(
  message: string,
  result: ChatSynthesisResult,
): ChatSynthesisResult {
  const category = detectOutOfScopeChatRequest(message);
  if (!category) return result;
  return buildOutOfScopeChatRefusal(category);
}
