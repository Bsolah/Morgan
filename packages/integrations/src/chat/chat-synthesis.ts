import { addDays, merchantLocalDay } from "../briefing/briefing.js";

export type ChatConfidence = "high" | "medium" | "low";

export type ChatCitation = {
  source_table: string;
  source_date: string;
  metric?: string;
};

export type ChatIntent =
  | { type: "profit_change"; focus: "yesterday" | "recent" }
  | { type: "cash_runway" }
  | { type: "ad_campaigns" }
  | { type: "general" };

export type DailyProfitPoint = {
  day: string;
  contribution_margin: number;
  net_revenue: number;
};

export type ChatDataContext = {
  intent: ChatIntent;
  timezone: string;
  referenceDay: string;
  profitSeries: DailyProfitPoint[];
  runwayDays: number | null;
  adSpend7d: number | null;
  googleAdSpend7d?: number | null;
  metaPoas7d?: number | null;
  googlePoas7d?: number | null;
  avgDailyNetOutflow?: number | null;
  topRecommendation?: import("./chat-action-card.js").ChatRecommendationContext | null;
};

export type ChatSynthesisResult = {
  answer: string;
  citations: ChatCitation[];
  confidence: ChatConfidence;
  follow_ups: string[];
};

export function detectChatIntent(message: string): ChatIntent {
  const normalized = message.trim().toLowerCase();

  if (
    /profit/.test(normalized) &&
    /(drop|dropped|down|fall|fell|decrease|decline|why)/.test(normalized)
  ) {
    return { type: "profit_change", focus: /yesterday/.test(normalized) ? "yesterday" : "recent" };
  }

  if (/cash runway|runway/.test(normalized)) {
    return { type: "cash_runway" };
  }

  if (/pause|campaign|ad spend|ads/.test(normalized)) {
    return { type: "ad_campaigns" };
  }

  return { type: "general" };
}

function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function formatPct(current: number, prior: number): string {
  if (prior === 0) return current === 0 ? "0%" : "n/a";
  const pct = ((current - prior) / Math.abs(prior)) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function synthesizeChatResponse(context: ChatDataContext): ChatSynthesisResult {
  switch (context.intent.type) {
    case "profit_change":
      return synthesizeProfitChange(context);
    case "cash_runway":
      return synthesizeCashRunway(context);
    case "ad_campaigns":
      return synthesizeAdCampaigns(context);
    default:
      return synthesizeGeneral(context);
  }
}

function synthesizeProfitChange(context: ChatDataContext): ChatSynthesisResult {
  const sorted = [...context.profitSeries].sort((left, right) => left.day.localeCompare(right.day));
  const yesterday = context.referenceDay;
  const priorDay = addDays(yesterday, -1);

  const yesterdayPoint =
    sorted.find((row) => row.day === yesterday) ?? sorted.at(-1) ?? null;
  const priorPoint =
    sorted.find((row) => row.day === priorDay) ??
    (sorted.length >= 2 ? sorted.at(-2)! : null);

  if (!yesterdayPoint || !priorPoint) {
    return {
      answer:
        "I do not have enough daily profit data yet to explain yesterday's move. Once order history sync completes, I can compare contribution profit day over day.",
      citations: [
        {
          source_table: "mart_orders_daily",
          source_date: yesterday,
          metric: "contribution_margin",
        },
      ],
      confidence: "low",
      follow_ups: [
        "What is my profit trend over the last 7 days?",
        "Which campaigns should I review today?",
      ],
    };
  }

  const delta = yesterdayPoint.contribution_margin - priorPoint.contribution_margin;
  const direction = delta >= 0 ? "rose" : "fell";
  const revenueDelta = yesterdayPoint.net_revenue - priorPoint.net_revenue;

  const answer = [
    `Contribution profit ${direction} from ${formatCurrency(priorPoint.contribution_margin)} on ${priorPoint.day} to ${formatCurrency(yesterdayPoint.contribution_margin)} on ${yesterdayPoint.day} (${formatPct(yesterdayPoint.contribution_margin, priorPoint.contribution_margin)}).`,
    revenueDelta >= 0
      ? `Net revenue also increased ${formatPct(yesterdayPoint.net_revenue, priorPoint.net_revenue)}, which supported profit.`
      : `Net revenue declined ${formatPct(yesterdayPoint.net_revenue, priorPoint.net_revenue)}, which weighed on profit.`,
    context.adSpend7d != null && context.adSpend7d > 0
      ? `Meta ad spend over the last 7 days was ${formatCurrency(context.adSpend7d)} — review campaign efficiency if profit lagged revenue.`
      : "Connect Meta Ads to see how spend contributed to the change.",
  ].join(" ");

  return {
    answer,
    citations: [
      {
        source_table: "mart_orders_daily",
        source_date: yesterdayPoint.day,
        metric: "contribution_margin",
      },
      {
        source_table: "mart_orders_daily",
        source_date: priorPoint.day,
        metric: "contribution_margin",
      },
      ...(context.adSpend7d != null && context.adSpend7d > 0
        ? [
            {
              source_table: "mart_ad_performance",
              source_date: yesterdayPoint.day,
              metric: "ad_spend",
            },
          ]
        : []),
    ],
    confidence: "high",
    follow_ups: [
      "Which SKUs drove the margin change?",
      "How did Meta ad spend change yesterday?",
    ],
  };
}

function synthesizeCashRunway(context: ChatDataContext): ChatSynthesisResult {
  if (context.runwayDays == null) {
    return {
      answer:
        "Connect your bank account to calculate cash runway from live balances and trailing outflows.",
      citations: [{ source_table: "mart_cash_daily", source_date: context.referenceDay }],
      confidence: "low",
      follow_ups: ["How do I connect Plaid?", "What was yesterday's profit?"],
    };
  }

  return {
    answer: `Based on your latest cash snapshot, runway is about ${Math.round(context.runwayDays)} days at the current burn rate. Tighten discretionary spend if runway is tightening.`,
    citations: [{ source_table: "mart_cash_daily", source_date: context.referenceDay, metric: "runway_days" }],
    confidence: "high",
    follow_ups: ["Why did profit drop yesterday?", "Which payouts are unmatched?"],
  };
}

function synthesizeAdCampaigns(context: ChatDataContext): ChatSynthesisResult {
  return {
    answer:
      context.adSpend7d != null && context.adSpend7d > 0
        ? `Trailing 7-day ad spend is ${formatCurrency(context.adSpend7d)}. Open Marketing to review campaigns with POAS below 1 — those are the best pause candidates.`
        : "Connect Meta Ads so I can rank campaigns by POAS and flag underperformers to pause.",
    citations: [
      {
        source_table: "mart_ad_performance",
        source_date: context.referenceDay,
        metric: "ad_spend",
      },
    ],
    confidence: context.adSpend7d != null ? "medium" : "low",
    follow_ups: ["Why did profit drop yesterday?", "What is my cash runway?"],
  };
}

function synthesizeGeneral(context: ChatDataContext): ChatSynthesisResult {
  const latest = context.profitSeries.at(-1);
  return {
    answer: latest
      ? `I can help explain profit, cash, and ads using your store data. Latest daily contribution profit I see is ${formatCurrency(latest.contribution_margin)} on ${latest.day}. Try asking why profit moved yesterday.`
      : "I can explain profit, cash, and ad performance using your store data. Ask me why profit dropped yesterday or what your cash runway is.",
    citations: latest
      ? [{ source_table: "mart_orders_daily", source_date: latest.day, metric: "contribution_margin" }]
      : [{ source_table: "mart_orders_daily", source_date: context.referenceDay }],
    confidence: latest ? "medium" : "low",
    follow_ups: ["Why did profit drop yesterday?", "What is my cash runway?"],
  };
}

export function merchantLocalYesterday(timezone: string, at = new Date()): string {
  return addDays(merchantLocalDay(timezone, at), -1);
}
