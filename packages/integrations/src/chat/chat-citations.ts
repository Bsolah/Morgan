import type { ChatDataContext, ChatCitation, ChatSynthesisResult } from "./chat-synthesis.js";

export type EnrichedChatCitation = ChatCitation & {
  source_label: string;
  query_summary: string;
  raw_values: Record<string, unknown>;
  data_as_of: string;
  is_stale: boolean;
};

const QUERY_SUMMARIES: Record<string, string> = {
  mart_orders_daily:
    "Daily order rollup from Shopify (net revenue, COGS, contribution margin) filtered by store and date range.",
  mart_ad_performance:
    "Meta ad spend and attributed revenue/POAS from connected ad accounts for the selected period.",
  mart_cash_daily:
    "Cash balance and trailing net outflows from Plaid, used to compute runway days.",
};

export function formatCitationSourceLabel(sourceTable: string): string {
  return sourceTable.replace(/^mart_/, "");
}

export function formatCitationChipDate(sourceDate: string): string {
  const parsed = new Date(`${sourceDate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return sourceDate;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parsed);
}

export function isCitationStale(dataAsOf: string, at = new Date(), staleHours = 48): boolean {
  const parsed = new Date(dataAsOf);
  if (Number.isNaN(parsed.getTime())) return false;
  return at.getTime() - parsed.getTime() > staleHours * 60 * 60 * 1000;
}

function querySummaryFor(sourceTable: string, sourceDate: string): string {
  const template = QUERY_SUMMARIES[sourceTable] ?? "Store-scoped metric query from Morgan serving tables.";
  return `${template} Data point date: ${sourceDate}.`;
}

function rawValuesForCitation(citation: ChatCitation, context: ChatDataContext): Record<string, unknown> {
  const dayPoint = context.profitSeries.find((row) => row.day === citation.source_date);

  if (citation.source_table === "mart_orders_daily") {
    if (dayPoint) {
      return {
        day: dayPoint.day,
        contribution_margin: dayPoint.contribution_margin,
        net_revenue: dayPoint.net_revenue,
        metric: citation.metric ?? "contribution_margin",
      };
    }
    return { day: citation.source_date, metric: citation.metric ?? "contribution_margin" };
  }

  if (citation.source_table === "mart_cash_daily") {
    return {
      as_of_day: citation.source_date,
      runway_days: context.runwayDays,
      metric: citation.metric ?? "runway_days",
    };
  }

  if (citation.source_table === "mart_ad_performance") {
    return {
      as_of_day: citation.source_date,
      ad_spend_7d: context.adSpend7d,
      metric: citation.metric ?? "ad_spend",
    };
  }

  return {
    as_of_day: citation.source_date,
    metric: citation.metric ?? null,
  };
}

function dataAsOfForCitation(citation: ChatCitation): string {
  return `${citation.source_date}T23:59:59.000Z`;
}

export function enrichChatCitation(
  citation: ChatCitation,
  context: ChatDataContext,
  at = new Date(),
): EnrichedChatCitation {
  const dataAsOf = dataAsOfForCitation(citation);
  return {
    ...citation,
    source_label: formatCitationSourceLabel(citation.source_table),
    query_summary: querySummaryFor(citation.source_table, citation.source_date),
    raw_values: rawValuesForCitation(citation, context),
    data_as_of: dataAsOf,
    is_stale: isCitationStale(dataAsOf, at),
  };
}

export function enrichChatSynthesisResult(
  result: ChatSynthesisResult & { scenario_raw_values?: Record<string, unknown> },
  context: ChatDataContext,
  at = new Date(),
): ChatSynthesisResult & { citations: EnrichedChatCitation[] } {
  return {
    ...result,
    citations: result.citations.map((citation) => {
      const enriched = enrichChatCitation(citation, context, at);
      if (citation.metric === "scenario_forecast" && result.scenario_raw_values) {
        return {
          ...enriched,
          raw_values: {
            ...enriched.raw_values,
            ...result.scenario_raw_values,
          },
        };
      }
      return enriched;
    }),
  };
}
