import type { BriefingKpiDelta } from "../briefing/briefing.js";

export type ChatStarterSource = "alert" | "brief_headline" | "brief_kpi" | "default";

export type ChatStarterAlertInput = {
  type: string;
  title: string;
  severity: "info" | "warning" | "critical";
};

export type ChatStarterInput = {
  headline?: string | null;
  kpiDeltas?: BriefingKpiDelta[];
  alerts?: ChatStarterAlertInput[];
  minCount?: number;
  maxCount?: number;
};

export type ChatStarter = {
  label: string;
  message: string;
  source: ChatStarterSource;
};

const DEFAULT_STARTERS: ChatStarter[] = [
  {
    label: "Why did profit drop?",
    message: "Why did profit drop yesterday?",
    source: "default",
  },
  {
    label: "Cash runway?",
    message: "What is my cash runway?",
    source: "default",
  },
  {
    label: "Pause ads?",
    message: "Which campaigns should I pause?",
    source: "default",
  },
];

const ALERT_STARTERS: Record<string, ChatStarter> = {
  cash_runway_critical: {
    label: "Cash runway?",
    message: "What is my cash runway?",
    source: "alert",
  },
  cash_runway_warning: {
    label: "Cash runway?",
    message: "What is my cash runway?",
    source: "alert",
  },
  payout_delay: {
    label: "Payout delays?",
    message: "Which payouts are delayed or unmatched?",
    source: "alert",
  },
  meta_token_expired: {
    label: "Ads disconnected?",
    message: "Why are my Meta ads disconnected?",
    source: "alert",
  },
};

function normalizeMessage(value: string): string {
  return value.trim().toLowerCase();
}

function pushUnique(starters: ChatStarter[], seen: Set<string>, starter: ChatStarter): void {
  const key = normalizeMessage(starter.message);
  if (seen.has(key)) return;
  seen.add(key);
  starters.push(starter);
}

function starterFromAlert(alert: ChatStarterAlertInput): ChatStarter | null {
  const mapped = ALERT_STARTERS[alert.type];
  if (mapped) return mapped;

  const title = alert.title.trim();
  if (!title) return null;

  const lower = title.toLowerCase();
  if (/margin/.test(lower) && /(down|drop|fell|declin|lower)/.test(lower)) {
    return {
      label: "Why did margin drop?",
      message: "Why did margin drop yesterday?",
      source: "alert",
    };
  }

  if (/profit/.test(lower) && /(down|drop|fell|declin|lower)/.test(lower)) {
    return {
      label: "Why did profit drop?",
      message: "Why did profit drop yesterday?",
      source: "alert",
    };
  }

  if (/(ad|campaign|poas|meta)/.test(lower) && /(burn|waste|below|pause|underperform)/.test(lower)) {
    return {
      label: "Pause ads?",
      message: "Which campaigns should I pause?",
      source: "alert",
    };
  }

  if (/runway|cash/.test(lower)) {
    return {
      label: "Cash runway?",
      message: "What is my cash runway?",
      source: "alert",
    };
  }

  return {
    label: truncateLabel(title),
    message: `Tell me more about this alert: ${title}`,
    source: "alert",
  };
}

function starterFromHeadline(headline: string): ChatStarter | null {
  const lower = headline.trim().toLowerCase();
  if (!lower || lower.includes("briefing is on the way")) return null;

  if (/margin/.test(lower) && /(down|drop|fell|declin|lower|weak|soft)/.test(lower)) {
    return {
      label: "Why did margin drop?",
      message: "Why did margin drop yesterday?",
      source: "brief_headline",
    };
  }

  if (/profit/.test(lower) && /(down|drop|fell|declin|lower|weak|soft)/.test(lower)) {
    return {
      label: "Why did profit drop?",
      message: "Why did profit drop yesterday?",
      source: "brief_headline",
    };
  }

  if (/(ad|poas|meta|campaign|spend)/.test(lower) && /(down|drop|burn|waste|lower|weak)/.test(lower)) {
    return {
      label: "Pause ads?",
      message: "Which campaigns should I pause?",
      source: "brief_headline",
    };
  }

  if (/runway|cash/.test(lower)) {
    return {
      label: "Cash runway?",
      message: "What is my cash runway?",
      source: "brief_headline",
    };
  }

  return {
    label: truncateLabel(headline),
    message: `Explain today's brief headline: ${headline.trim()}`,
    source: "brief_headline",
  };
}

function starterFromKpi(delta: BriefingKpiDelta): ChatStarter | null {
  if (delta.direction !== "down") return null;

  switch (delta.key) {
    case "contribution_margin_7d":
      return {
        label: "Why did margin drop?",
        message: "Why did margin drop yesterday?",
        source: "brief_kpi",
      };
    case "net_revenue_7d":
      return {
        label: "Why did revenue drop?",
        message: "Why did revenue drop yesterday?",
        source: "brief_kpi",
      };
    case "mer_7d":
      return {
        label: "Why is MER down?",
        message: "Why did marketing efficiency drop this week?",
        source: "brief_kpi",
      };
    case "poas_7d":
      return {
        label: "Why is POAS down?",
        message: "Why did POAS drop this week?",
        source: "brief_kpi",
      };
    default:
      return null;
  }
}

function truncateLabel(value: string, max = 42): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function severityRank(severity: ChatStarterAlertInput["severity"]): number {
  switch (severity) {
    case "critical":
      return 0;
    case "warning":
      return 1;
    default:
      return 2;
  }
}

export function generateChatStarters(input: ChatStarterInput = {}): ChatStarter[] {
  const minCount = input.minCount ?? 3;
  const maxCount = input.maxCount ?? 5;
  const starters: ChatStarter[] = [];
  const seen = new Set<string>();

  const alerts = [...(input.alerts ?? [])].sort(
    (left, right) => severityRank(left.severity) - severityRank(right.severity),
  );

  for (const alert of alerts) {
    const starter = starterFromAlert(alert);
    if (starter) pushUnique(starters, seen, starter);
  }

  if (input.headline) {
    const headlineStarter = starterFromHeadline(input.headline);
    if (headlineStarter) pushUnique(starters, seen, headlineStarter);
  }

  for (const delta of input.kpiDeltas ?? []) {
    const kpiStarter = starterFromKpi(delta);
    if (kpiStarter) pushUnique(starters, seen, kpiStarter);
  }

  for (const fallback of DEFAULT_STARTERS) {
    if (starters.length >= maxCount) break;
    pushUnique(starters, seen, fallback);
  }

  while (starters.length < minCount) {
    const fallback = DEFAULT_STARTERS[starters.length % DEFAULT_STARTERS.length]!;
    pushUnique(starters, seen, fallback);
  }

  return starters.slice(0, maxCount);
}
