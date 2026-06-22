enum FinanceRecalculationStatus {
  idle,
  scheduled,
  inProgress,
  completed;

  static FinanceRecalculationStatus fromApi(String value) => switch (value) {
        'scheduled' => FinanceRecalculationStatus.scheduled,
        'in_progress' => FinanceRecalculationStatus.inProgress,
        'completed' => FinanceRecalculationStatus.completed,
        _ => FinanceRecalculationStatus.idle,
      };

  bool get isActive =>
      this == FinanceRecalculationStatus.scheduled || this == FinanceRecalculationStatus.inProgress;
}

class FinanceRecalculation {
  const FinanceRecalculation({
    required this.status,
    this.requestedAt,
    this.startedAt,
    this.completedAt,
    this.dueBy,
  });

  final FinanceRecalculationStatus status;
  final DateTime? requestedAt;
  final DateTime? startedAt;
  final DateTime? completedAt;
  final DateTime? dueBy;

  factory FinanceRecalculation.fromJson(Map<String, dynamic> json) {
    return FinanceRecalculation(
      status: FinanceRecalculationStatus.fromApi(json['status'] as String? ?? 'idle'),
      requestedAt: json['requested_at'] != null
          ? DateTime.tryParse(json['requested_at'] as String)
          : null,
      startedAt:
          json['started_at'] != null ? DateTime.tryParse(json['started_at'] as String) : null,
      completedAt: json['completed_at'] != null
          ? DateTime.tryParse(json['completed_at'] as String)
          : null,
      dueBy: json['due_by'] != null ? DateTime.tryParse(json['due_by'] as String) : null,
    );
  }

  bool get isActive => status.isActive;
}

enum CogsMethod {
  shopify,
  manualPct,
  qbo,
  xero;

  String get apiValue => switch (this) {
        CogsMethod.shopify => 'shopify',
        CogsMethod.manualPct => 'manual_pct',
        CogsMethod.qbo => 'qbo',
        CogsMethod.xero => 'xero',
      };

  static CogsMethod fromApi(String value) => switch (value) {
        'shopify' => CogsMethod.shopify,
        'manual_pct' => CogsMethod.manualPct,
        'qbo' => CogsMethod.qbo,
        'xero' => CogsMethod.xero,
        _ => CogsMethod.shopify,
      };

  String get label => switch (this) {
        CogsMethod.shopify => 'Shopify unit cost',
        CogsMethod.manualPct => 'Manual %',
        CogsMethod.qbo => 'QuickBooks',
        CogsMethod.xero => 'Xero',
      };

  String get description => switch (this) {
        CogsMethod.shopify =>
          'Uses the cost per item you set in Shopify inventory. Best if you already maintain unit costs in Shopify.',
        CogsMethod.manualPct =>
          'Applies one cost percentage to your product revenue. Good when you know your average margin but do not track unit costs.',
        CogsMethod.qbo =>
          'Pulls COGS from QuickBooks purchase and bill data. Connect QuickBooks first to unlock this method.',
        CogsMethod.xero =>
          'Pulls COGS from Xero invoices and bank transactions. Connect Xero first to unlock this method.',
      };
}

class FinanceConfig {
  const FinanceConfig({
    required this.cogsMethod,
    this.manualCogsPct,
    required this.targetContributionMarginPct,
    required this.quickbooksConnected,
    required this.xeroConnected,
    required this.recalculation,
  });

  final CogsMethod cogsMethod;
  final double? manualCogsPct;
  final double targetContributionMarginPct;
  final bool quickbooksConnected;
  final bool xeroConnected;
  final FinanceRecalculation recalculation;

  factory FinanceConfig.fromJson(Map<String, dynamic> json) {
    return FinanceConfig(
      cogsMethod: CogsMethod.fromApi(json['cogs_method'] as String),
      manualCogsPct: (json['manual_cogs_pct'] as num?)?.toDouble(),
      targetContributionMarginPct:
          (json['target_contribution_margin_pct'] as num?)?.toDouble() ?? 40,
      quickbooksConnected: json['quickbooks_connected'] as bool? ?? false,
      xeroConnected: json['xero_connected'] as bool? ?? false,
      recalculation: FinanceRecalculation.fromJson(
        Map<String, dynamic>.from(json['recalculation'] as Map? ?? {}),
      ),
    );
  }

  String get subtitle => switch (cogsMethod) {
        CogsMethod.shopify => 'Shopify unit cost',
        CogsMethod.manualPct => 'Manual ${manualCogsPct?.toStringAsFixed(0) ?? '—'}%',
        CogsMethod.qbo => 'QuickBooks',
        CogsMethod.xero => 'Xero',
      };

  String get settingsSubtitle {
    if (recalculation.status == FinanceRecalculationStatus.inProgress) {
      return 'Updating margins…';
    }
    if (recalculation.status == FinanceRecalculationStatus.scheduled) {
      return 'Margin update queued…';
    }
    return subtitle;
  }

  String get targetMarginSettingsSubtitle =>
      'Target ${targetContributionMarginPct.toStringAsFixed(0)}%';
}

class UpdateFinanceConfigRequest {
  const UpdateFinanceConfigRequest({
    required this.cogsMethod,
    this.manualCogsPct,
  });

  final CogsMethod cogsMethod;
  final double? manualCogsPct;

  Map<String, dynamic> toJson() => {
        'cogs_method': cogsMethod.apiValue,
        if (cogsMethod == CogsMethod.manualPct) 'manual_cogs_pct': manualCogsPct,
      };
}

class UpdateTargetMarginRequest {
  const UpdateTargetMarginRequest({required this.targetContributionMarginPct});

  final double targetContributionMarginPct;

  Map<String, dynamic> toJson() => {
        'target_contribution_margin_pct': targetContributionMarginPct,
      };
}

String? validateTargetMarginPct(double? value) {
  if (value == null) return 'Enter a target margin percentage';
  if (value < 0 || value > 100) return 'Target margin must be between 0 and 100';
  return null;
}
