import 'package:flutter/material.dart';

import '../theme/morgan_colors.dart';
import 'alert.dart';

/// US-UX-07-03 — Alert type visual language.
///
/// Maps API alert types to list/detail iconography and labels.
/// Severity stripe colours come from [alertSeverityAccent] (loss / warning / accent).
///
/// | API type        | AlertType       | Label           |
/// |-----------------|-----------------|-----------------|
/// | margin_drop     | marginDrop      | Margin drop     |
/// | ad_waste        | adWaste         | Ad waste        |
/// | stockout_risk   | stockoutRisk    | Stockout risk   |
/// | cash_crunch     | cashCrunch      | Cash crunch     |
/// | refund_spike    | refundSpike     | Refund spike    |
/// | profit_leak     | profitLeak      | Profit leak     |

IconData alertTypeIcon(AlertType type) => switch (type) {
      AlertType.marginDrop => Icons.trending_down_rounded,
      AlertType.adWaste => Icons.campaign_outlined,
      AlertType.stockoutRisk => Icons.inventory_2_outlined,
      AlertType.cashCrunch => Icons.account_balance_wallet_outlined,
      AlertType.refundSpike => Icons.replay_rounded,
      AlertType.profitLeak => Icons.water_drop_outlined,
    };

String alertTypeLabel(AlertType type) => switch (type) {
      AlertType.marginDrop => 'Margin drop',
      AlertType.adWaste => 'Ad waste',
      AlertType.stockoutRisk => 'Stockout risk',
      AlertType.cashCrunch => 'Cash crunch',
      AlertType.refundSpike => 'Refund spike',
      AlertType.profitLeak => 'Profit leak',
    };

(Color accent, Color background) alertSeverityAccent(MorganPalette p, AlertSeverity severity) =>
    switch (severity) {
      AlertSeverity.critical => (p.loss, p.lossMuted),
      AlertSeverity.warning => (p.warning, p.goldMuted),
      AlertSeverity.info => (p.accent, p.accentMuted),
    };

int alertSeverityRank(AlertSeverity severity) => switch (severity) {
      AlertSeverity.critical => 0,
      AlertSeverity.warning => 1,
      AlertSeverity.info => 2,
    };

List<Alert> sortAlertsBySeverityAndRecency(List<Alert> alerts) {
  return [...alerts]..sort((a, b) {
      final severity = alertSeverityRank(a.severity).compareTo(alertSeverityRank(b.severity));
      if (severity != 0) return severity;
      return b.createdAt.compareTo(a.createdAt);
    });
}
