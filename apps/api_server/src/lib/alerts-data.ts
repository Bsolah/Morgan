export type AlertSeverity = "info" | "warning" | "critical";

export type AlertType =
  | "margin_drop"
  | "ad_waste"
  | "stockout_risk"
  | "cash_crunch"
  | "profit_leak"
  | "refund_spike";

export type AlertLinks = {
  brief?: string;
  chat?: string;
  marketing_overview?: string;
  recommendation?: string;
};

export type AlertRecord = {
  id: string;
  store_id: string;
  severity: AlertSeverity;
  type: AlertType;
  title: string;
  body: string;
  magnitude: string;
  top_driver: string;
  links: AlertLinks;
  metric_snapshot: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type AlertsResponse = {
  alerts: AlertRecord[];
  unread_count: number;
};

export type NotificationPrefs = {
  push_daily_brief: boolean;
  push_warnings: boolean;
  push_critical: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: number;
  quiet_hours_end: number;
  weekly_email_digest: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  push_daily_brief: true,
  push_warnings: true,
  push_critical: true,
  quiet_hours_enabled: true,
  quiet_hours_start: 22,
  quiet_hours_end: 7,
  weekly_email_digest: false,
};
