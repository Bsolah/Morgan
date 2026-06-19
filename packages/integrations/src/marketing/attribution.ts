export type AttributionRule = {
  channel: string;
  match_field: "utm_source" | "utm_medium" | "utm_campaign";
  match_type: "contains" | "equals";
  pattern: string;
  enabled: boolean;
};

export type OrderUtmParams = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
};

export const DEFAULT_META_ATTRIBUTION_RULES: AttributionRule[] = [
  {
    channel: "meta",
    match_field: "utm_source",
    match_type: "contains",
    pattern: "facebook",
    enabled: true,
  },
  {
    channel: "meta",
    match_field: "utm_source",
    match_type: "contains",
    pattern: "meta",
    enabled: true,
  },
];

export const DEFAULT_GOOGLE_ADS_ATTRIBUTION_RULES: AttributionRule[] = [
  {
    channel: "google_ads",
    match_field: "utm_source",
    match_type: "equals",
    pattern: "google",
    enabled: true,
  },
  {
    channel: "google_ads",
    match_field: "utm_source",
    match_type: "contains",
    pattern: "google",
    enabled: true,
  },
];

export const DEFAULT_ATTRIBUTION_RULES: AttributionRule[] = [
  ...DEFAULT_META_ATTRIBUTION_RULES,
  ...DEFAULT_GOOGLE_ADS_ATTRIBUTION_RULES,
];

function parseQueryParams(url: string): Record<string, string> {
  const queryIndex = url.indexOf("?");
  if (queryIndex < 0) return {};

  const params: Record<string, string> = {};
  const search = url.slice(queryIndex + 1);

  for (const part of search.split("&")) {
    const [rawKey, rawValue = ""] = part.split("=");
    if (!rawKey) continue;
    try {
      params[decodeURIComponent(rawKey).toLowerCase()] = decodeURIComponent(rawValue);
    } catch {
      params[rawKey.toLowerCase()] = rawValue;
    }
  }

  return params;
}

function normalizeUtmValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : null;
}

export function extractUtmFromOrderPayload(payload: Record<string, unknown>): OrderUtmParams {
  const fromUrl = (url: unknown): OrderUtmParams => {
    if (typeof url !== "string" || !url) return {};
    const params = parseQueryParams(url);
    return {
      utm_source: normalizeUtmValue(params.utm_source),
      utm_medium: normalizeUtmValue(params.utm_medium),
      utm_campaign: normalizeUtmValue(params.utm_campaign),
      utm_content: normalizeUtmValue(params.utm_content),
      utm_term: normalizeUtmValue(params.utm_term),
    };
  };

  let utm: OrderUtmParams = {
    ...fromUrl(payload.landing_site),
    ...fromUrl(payload.landing_site_ref),
    ...fromUrl(payload.referring_site),
  };

  const noteAttributes = payload.note_attributes;
  if (Array.isArray(noteAttributes)) {
    for (const entry of noteAttributes) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      const name = normalizeUtmValue(record.name);
      const value = normalizeUtmValue(record.value);
      if (!name || !value) continue;

      if (name === "utm_source" || name === "utm_medium" || name === "utm_campaign") {
        utm[name] = value;
      }
    }
  }

  const customerJourney = payload.customer_journey_summary ?? payload.customerJourneySummary;
  if (customerJourney && typeof customerJourney === "object") {
    const journey = customerJourney as Record<string, unknown>;
    const firstVisit = journey.first_visit ?? journey.firstVisit;
    if (firstVisit && typeof firstVisit === "object") {
      const visit = firstVisit as Record<string, unknown>;
      const utmParameters = visit.utm_parameters ?? visit.utmParameters;
      if (utmParameters && typeof utmParameters === "object") {
        const utmParams = utmParameters as Record<string, unknown>;
        utm = {
          ...utm,
          utm_source: utm.utm_source ?? normalizeUtmValue(utmParams.source),
          utm_medium: utm.utm_medium ?? normalizeUtmValue(utmParams.medium),
          utm_campaign: utm.utm_campaign ?? normalizeUtmValue(utmParams.campaign),
        };
      }
      utm = {
        ...utm,
        ...fromUrl(visit.landing_page ?? visit.landingPage),
        utm_source: utm.utm_source ?? normalizeUtmValue(visit.utm_source ?? visit.source),
        utm_medium: utm.utm_medium ?? normalizeUtmValue(visit.utm_medium ?? visit.medium),
        utm_campaign: utm.utm_campaign ?? normalizeUtmValue(visit.utm_campaign ?? visit.campaign),
      };
    }
  }

  const landingSite = payload.landing_site ?? payload.landingSite;
  if (landingSite) {
    utm = { ...utm, ...fromUrl(landingSite) };
  }

  return utm;
}

export function extractGclidFromOrderPayload(payload: Record<string, unknown>): string | null {
  const urls = [
    payload.landing_site,
    payload.landing_site_ref,
    payload.referring_site,
    payload.landingSite,
  ];

  for (const url of urls) {
    if (typeof url !== "string" || !url) continue;
    const params = parseQueryParams(url);
    const gclid = params.gclid;
    if (gclid) return gclid;
  }

  const noteAttributes = payload.note_attributes;
  if (Array.isArray(noteAttributes)) {
    for (const entry of noteAttributes) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      const name = normalizeUtmValue(record.name);
      const value = normalizeUtmValue(record.value);
      if (!name || !value) continue;
      if (name === "gclid" || name === "google_click_id") {
        return value;
      }
    }
  }

  return null;
}

export function resolveAttributionChannel(
  utm: OrderUtmParams,
  gclid: string | null,
  rules: AttributionRule[],
): string | null {
  if (gclid) return "google_ads";
  return matchAttributionChannel(utm, rules);
}

export function ruleMatchesUtm(rule: AttributionRule, utm: OrderUtmParams): boolean {
  if (!rule.enabled) return false;

  const value = utm[rule.match_field];
  if (!value) return false;

  const pattern = rule.pattern.trim().toLowerCase();
  if (!pattern) return false;

  if (rule.match_type === "equals") {
    return value === pattern;
  }

  return value.includes(pattern);
}

export function matchAttributionChannel(
  utm: OrderUtmParams,
  rules: AttributionRule[],
): string | null {
  for (const rule of rules) {
    if (ruleMatchesUtm(rule, utm)) return rule.channel;
  }
  return null;
}

export type { CogsMethod } from "../finance/contribution-margin.js";
export {
  computeContributionMargin,
  extractLineItemsForCogs,
  extractOrderDay,
  parseOrderRevenue,
} from "../finance/contribution-margin.js";
