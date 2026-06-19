import {
  extractNumericTokens,
  metricValuesWithinTolerance,
} from "../briefing/briefing.js";
import type { ChatCitation, ChatSynthesisResult } from "./chat-synthesis.js";

const BLOCKED_ANSWER =
  "I can only share figures that are tied to a verified data source. Ask about profit, cash runway, or ad spend and I'll cite the underlying table.";

const BLOCKED_FOLLOW_UPS = [
  "Why did profit drop yesterday?",
  "What is my cash runway?",
  "Which campaigns should I pause?",
];

function collectNumbers(value: unknown, out: Set<number>): void {
  if (typeof value === "number" && Number.isFinite(value)) {
    out.add(value);
    out.add(Math.round(value * 100) / 100);
    out.add(Math.round(value));
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectNumbers(item, out);
    return;
  }

  if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectNumbers(nested, out);
    }
  }
}

export function extractChatNumericClaims(text: string): number[] {
  const withoutDates = text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ");
  return extractNumericTokens(withoutDates);
}

export function buildAllowedNumbersFromCitations(citations: ChatCitation[]): number[] {
  const values = new Set<number>();

  for (const citation of citations) {
    if ("raw_values" in citation && citation.raw_values) {
      collectNumbers(citation.raw_values, values);
    }
  }

  const marginByDay: Array<{ day: string; value: number }> = [];
  const revenueByDay: Array<{ day: string; value: number }> = [];

  for (const citation of citations) {
    const raw =
      "raw_values" in citation
        ? (citation.raw_values as Record<string, unknown> | undefined)
        : undefined;
    const day = typeof raw?.day === "string" ? raw.day : citation.source_date;
    if (typeof raw?.contribution_margin === "number") {
      marginByDay.push({ day, value: raw.contribution_margin });
    }
    if (typeof raw?.net_revenue === "number") {
      revenueByDay.push({ day, value: raw.net_revenue });
    }
  }

  marginByDay.sort((left, right) => left.day.localeCompare(right.day));
  revenueByDay.sort((left, right) => left.day.localeCompare(right.day));

  for (let index = 1; index < marginByDay.length; index += 1) {
    const prior = marginByDay[index - 1]!.value;
    const current = marginByDay[index]!.value;
    if (prior === 0) continue;
    const pct = ((current - prior) / Math.abs(prior)) * 100;
    values.add(Math.round(pct * 10) / 10);
    values.add(Math.round(Math.abs(pct * 10)) / 10);
    values.add(Math.round(Math.abs(pct)));
  }

  for (let index = 1; index < revenueByDay.length; index += 1) {
    const prior = revenueByDay[index - 1]!.value;
    const current = revenueByDay[index]!.value;
    if (prior === 0) continue;
    const pct = ((current - prior) / Math.abs(prior)) * 100;
    values.add(Math.round(pct * 10) / 10);
    values.add(Math.round(Math.abs(pct * 10)) / 10);
    values.add(Math.round(Math.abs(pct)));
  }

  return [...values];
}

export function answerHasUnsupportedNumericClaims(
  answer: string,
  citations: ChatCitation[],
): boolean {
  const narrativeNumbers = extractChatNumericClaims(answer);
  if (narrativeNumbers.length === 0) return false;
  if (citations.length === 0) return true;

  const allowedNumbers = buildAllowedNumbersFromCitations(citations);
  if (allowedNumbers.length === 0) return true;

  return !metricValuesWithinTolerance(narrativeNumbers, allowedNumbers);
}

export function enforceChatCitationGuardrail(result: ChatSynthesisResult): ChatSynthesisResult {
  if (!answerHasUnsupportedNumericClaims(result.answer, result.citations)) {
    return result;
  }

  return {
    answer: BLOCKED_ANSWER,
    citations: result.citations.length > 0 ? result.citations.slice(0, 1) : [],
    confidence: "low",
    follow_ups: BLOCKED_FOLLOW_UPS,
  };
}
