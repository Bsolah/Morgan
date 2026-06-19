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
    required this.quickbooksConnected,
    required this.xeroConnected,
    this.recalculationDueBy,
  });

  final CogsMethod cogsMethod;
  final double? manualCogsPct;
  final bool quickbooksConnected;
  final bool xeroConnected;
  final DateTime? recalculationDueBy;

  factory FinanceConfig.fromJson(Map<String, dynamic> json) {
    final recalc = json['recalculation'] as Map<String, dynamic>?;
    final dueByRaw = recalc?['due_by'] as String?;

    return FinanceConfig(
      cogsMethod: CogsMethod.fromApi(json['cogs_method'] as String),
      manualCogsPct: (json['manual_cogs_pct'] as num?)?.toDouble(),
      quickbooksConnected: json['quickbooks_connected'] as bool? ?? false,
      xeroConnected: json['xero_connected'] as bool? ?? false,
      recalculationDueBy: dueByRaw != null ? DateTime.tryParse(dueByRaw) : null,
    );
  }

  String get subtitle => switch (cogsMethod) {
        CogsMethod.shopify => 'Shopify unit cost',
        CogsMethod.manualPct => 'Manual ${manualCogsPct?.toStringAsFixed(0) ?? '—'}%',
        CogsMethod.qbo => 'QuickBooks',
        CogsMethod.xero => 'Xero',
      };
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
