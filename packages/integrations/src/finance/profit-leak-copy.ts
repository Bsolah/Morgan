export type ProfitLeakType = "ad_waste" | "discount_bleed" | "return_drain" | "dead_stock";

export type ProfitLeakEvidence = Record<string, unknown>;

export function isProfitLeakType(value: string): value is ProfitLeakType {
  return (
    value === "ad_waste" ||
    value === "discount_bleed" ||
    value === "return_drain" ||
    value === "dead_stock"
  );
}

export function leakTypeLabel(leakType: string): string {
  switch (leakType) {
    case "ad_waste":
      return "Ad waste";
    case "discount_bleed":
      return "Discount bleed";
    case "return_drain":
      return "Return drain";
    case "dead_stock":
      return "Dead stock";
    default:
      return "Profit leak";
  }
}

export function leakTitle(leakType: string, evidence: Array<ProfitLeakEvidence> | null): string {
  const first = evidence?.[0];
  if (leakType === "ad_waste") {
    const campaign = first?.campaign;
    if (typeof campaign === "string" && campaign.length > 0) {
      return `Pause ${campaign}`;
    }
    return "Pause underperforming ad spend";
  }
  if (leakType === "discount_bleed") {
    return "Review discount strategy";
  }
  if (leakType === "return_drain") {
    const sku = first?.sku;
    if (typeof sku === "string" && sku.length > 0) {
      return `Reduce returns on ${sku}`;
    }
    return "Address high-return SKU";
  }
  if (leakType === "dead_stock") {
    const sku = first?.sku;
    const action = first?.suggested_action;
    if (typeof sku === "string" && sku.length > 0) {
      if (action === "bundle") {
        return `Bundle slow-moving ${sku}`;
      }
      return `Liquidate slow-moving ${sku}`;
    }
    return "Clear dead stock";
  }
  return "Review today's profit opportunity";
}

export function leakBody(leakType: string, evidence: Array<ProfitLeakEvidence> | null): string {
  const first = evidence?.[0];
  if (leakType === "ad_waste") {
    const poas = first?.poas;
    const spend = first?.spend_7d;
    if (typeof poas === "number" && typeof spend === "number") {
      return `This campaign spent $${Math.round(spend).toLocaleString("en-US")} over seven days with POAS ${poas.toFixed(2)}.`;
    }
    return "This campaign has spent with POAS below 1 for multiple days.";
  }
  if (leakType === "discount_bleed") {
    const currentRate = first?.discount_rate_pct;
    const priorRate = first?.prior_discount_rate_pct;
    if (typeof currentRate === "number" && typeof priorRate === "number") {
      return `Discount rate rose from ${priorRate.toFixed(1)}% to ${currentRate.toFixed(1)}% without a matching conversion lift.`;
    }
    return "Discounts are eating margin faster than revenue is growing.";
  }
  if (leakType === "return_drain") {
    const sku = first?.sku;
    const returnRate = first?.return_rate_pct;
    const categoryMean = first?.category_mean_return_rate_pct ?? first?.store_return_rate_pct;
    if (typeof sku === "string" && typeof returnRate === "number") {
      const baselineText =
        typeof categoryMean === "number" ? ` vs category avg ${categoryMean.toFixed(1)}%` : "";
      return `${sku} is returning at ${returnRate.toFixed(1)}%${baselineText}, dragging contribution margin down.`;
    }
    return "A high-return SKU is eroding contribution margin.";
  }
  if (leakType === "dead_stock") {
    const sku = first?.sku;
    const velocity = first?.velocity_30d ?? first?.velocity_per_day;
    const daysOfStock = first?.days_of_stock ?? first?.days_of_supply;
    const action = first?.suggested_action;
    if (typeof sku === "string" && typeof velocity === "number") {
      const actionText =
        action === "bundle"
          ? "Bundle it with a top seller to move units without a fire sale."
          : "Liquidate or markdown to free tied-up cash.";
      const daysText =
        typeof daysOfStock === "number"
          ? ` About ${Math.round(daysOfStock)} days of stock remain at the current pace.`
          : "";
      return `${sku} is moving at ${velocity.toFixed(2)} units/day with declining velocity.${daysText} ${actionText}`;
    }
    return "Slow-moving inventory is tying up cash and shelf space.";
  }
  return "Morgan flagged an active profit leak that deserves attention today.";
}

export function formatLeakEvidenceRows(
  leakType: string,
  evidence: Array<ProfitLeakEvidence> | null,
): Array<{ label: string; value: string }> {
  const first = evidence?.[0];
  if (!first) return [];

  const rows: Array<{ label: string; value: string }> = [];

  if (leakType === "ad_waste") {
    if (typeof first.campaign === "string") rows.push({ label: "Campaign", value: first.campaign });
    if (typeof first.channel === "string") rows.push({ label: "Channel", value: first.channel });
    if (typeof first.poas === "number") rows.push({ label: "POAS (7d)", value: first.poas.toFixed(2) });
    if (typeof first.spend_7d === "number") {
      rows.push({ label: "Spend (7d)", value: `$${Math.round(first.spend_7d).toLocaleString("en-US")}` });
    }
    return rows;
  }

  if (leakType === "discount_bleed") {
    if (typeof first.discount_rate_pct === "number") {
      rows.push({ label: "Discount rate", value: `${first.discount_rate_pct.toFixed(1)}%` });
    }
    if (typeof first.prior_discount_rate_pct === "number") {
      rows.push({ label: "Prior period", value: `${first.prior_discount_rate_pct.toFixed(1)}%` });
    }
    if (typeof first.discounts_usd === "number") {
      rows.push({ label: "Discounts (7d)", value: `$${Math.round(first.discounts_usd).toLocaleString("en-US")}` });
    }
    if (typeof first.affected_orders_count === "number") {
      rows.push({ label: "Affected orders", value: String(Math.round(first.affected_orders_count)) });
    }
    if (Array.isArray(first.top_discount_codes) && first.top_discount_codes.length > 0) {
      rows.push({ label: "Top codes", value: first.top_discount_codes.join(", ") });
    }
    return rows;
  }

  if (leakType === "return_drain") {
    if (typeof first.sku === "string") rows.push({ label: "SKU", value: first.sku });
    if (typeof first.return_rate_pct === "number") {
      rows.push({ label: "Return rate", value: `${first.return_rate_pct.toFixed(1)}%` });
    }
    if (typeof first.category_mean_return_rate_pct === "number") {
      rows.push({ label: "Category avg", value: `${first.category_mean_return_rate_pct.toFixed(1)}%` });
    } else if (typeof first.store_return_rate_pct === "number") {
      rows.push({ label: "Store avg", value: `${first.store_return_rate_pct.toFixed(1)}%` });
    }
    if (typeof first.returns_usd === "number") {
      rows.push({ label: "Return $", value: `$${Math.round(first.returns_usd).toLocaleString("en-US")}` });
    }
    if (typeof first.returns_count === "number") {
      rows.push({ label: "Returns", value: String(Math.round(first.returns_count)) });
    }
    if (Array.isArray(first.top_return_reasons) && first.top_return_reasons.length > 0) {
      rows.push({ label: "Top reasons", value: first.top_return_reasons.join(", ") });
    }
    if (typeof first.orders_count === "number") {
      rows.push({ label: "Orders (30d)", value: String(Math.round(first.orders_count)) });
    }
    return rows;
  }

  if (leakType === "dead_stock") {
    if (typeof first.sku === "string") rows.push({ label: "SKU", value: first.sku });
    const velocity30d = first.velocity_30d ?? first.velocity_per_day;
    if (typeof velocity30d === "number") {
      rows.push({ label: "Velocity (30d)", value: `${velocity30d.toFixed(2)}/day` });
    }
    if (typeof first.velocity_90d === "number") {
      rows.push({ label: "Velocity (90d)", value: `${first.velocity_90d.toFixed(2)}/day` });
    }
    if (typeof first.available_units === "number") {
      rows.push({ label: "On hand", value: String(Math.round(first.available_units)) });
    }
    const daysOfStock = first.days_of_stock ?? first.days_of_supply;
    if (typeof daysOfStock === "number") {
      rows.push({ label: "Days of stock", value: `${Math.round(daysOfStock)} days` });
    }
    if (typeof first.inventory_value_usd === "number") {
      rows.push({
        label: "Inventory value",
        value: `$${Math.round(first.inventory_value_usd).toLocaleString("en-US")}`,
      });
    }
    if (first.suggested_action === "bundle" || first.suggested_action === "liquidate") {
      rows.push({
        label: "Suggested action",
        value: first.suggested_action === "bundle" ? "Bundle offer" : "Liquidate",
      });
    }
    if (typeof first.units_sold === "number") {
      rows.push({ label: "Units sold (30d)", value: String(Math.round(first.units_sold)) });
    }
    return rows;
  }

  return Object.entries(first).map(([label, value]) => ({
    label: label.replace(/_/g, " "),
    value: String(value),
  }));
}
