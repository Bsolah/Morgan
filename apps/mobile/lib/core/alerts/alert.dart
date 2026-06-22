enum AlertSeverity { info, warning, critical }

enum AlertSeverityFilter { all, warnings, critical }

enum AlertType { marginDrop, adWaste, stockoutRisk, cashCrunch, refundSpike, profitLeak }

class AlertLinks {
  const AlertLinks({
    this.brief,
    this.chat,
    this.marketingOverview,
    this.recommendation,
  });

  final String? brief;
  final String? chat;
  final String? marketingOverview;
  final String? recommendation;

  factory AlertLinks.fromJson(Map<String, dynamic> json) {
    return AlertLinks(
      brief: json['brief'] as String?,
      chat: json['chat'] as String?,
      marketingOverview: json['marketing_overview'] as String?,
      recommendation: json['recommendation'] as String?,
    );
  }
}

class Alert {
  const Alert({
    required this.id,
    required this.storeId,
    required this.severity,
    required this.type,
    required this.title,
    required this.body,
    required this.magnitude,
    required this.topDriver,
    required this.links,
    required this.createdAt,
    this.readAt,
    this.metricSnapshot,
  });

  final String id;
  final String storeId;
  final AlertSeverity severity;
  final AlertType type;
  final String title;
  final String body;
  final String magnitude;
  final String topDriver;
  final AlertLinks links;
  final DateTime createdAt;
  final DateTime? readAt;
  final Map<String, dynamic>? metricSnapshot;

  bool get isUnread => readAt == null;

  factory Alert.fromJson(Map<String, dynamic> json) {
    return Alert(
      id: json['id'] as String,
      storeId: json['store_id'] as String,
      severity: AlertSeverity.values.byName(json['severity'] as String),
      type: _typeFromApi(json['type'] as String),
      title: json['title'] as String,
      body: json['body'] as String,
      magnitude: json['magnitude'] as String,
      topDriver: json['top_driver'] as String,
      links: AlertLinks.fromJson(json['links'] as Map<String, dynamic>),
      createdAt: DateTime.parse(json['created_at'] as String),
      readAt: json['read_at'] == null ? null : DateTime.parse(json['read_at'] as String),
      metricSnapshot: json['metric_snapshot'] as Map<String, dynamic>?,
    );
  }

  static AlertType _typeFromApi(String value) => switch (value) {
        'margin_drop' => AlertType.marginDrop,
        'ad_waste' => AlertType.adWaste,
        'stockout_risk' => AlertType.stockoutRisk,
        'cash_crunch' => AlertType.cashCrunch,
        'refund_spike' => AlertType.refundSpike,
        'profit_leak' => AlertType.profitLeak,
        _ => AlertType.marginDrop,
      };
}

class AlertsFeed {
  const AlertsFeed({required this.alerts, required this.unreadCount});

  final List<Alert> alerts;
  final int unreadCount;

  factory AlertsFeed.fromJson(Map<String, dynamic> json) {
    final items = (json['alerts'] as List<dynamic>)
        .map((item) => Alert.fromJson(item as Map<String, dynamic>))
        .toList();
    return AlertsFeed(
      alerts: items,
      unreadCount: json['unread_count'] as int,
    );
  }

  static AlertsFeed empty() => const AlertsFeed(alerts: [], unreadCount: 0);

  List<Alert> filtered(AlertSeverityFilter filter) {
    return alerts.where((alert) {
      return switch (filter) {
        AlertSeverityFilter.all => true,
        AlertSeverityFilter.warnings => alert.severity == AlertSeverity.warning,
        AlertSeverityFilter.critical => alert.severity == AlertSeverity.critical,
      };
    }).toList();
  }

  List<Alert> sortedFiltered(AlertSeverityFilter filter) {
    final items = filtered(filter);
    return [...items]..sort((a, b) {
        final severity = _severityRank(a.severity).compareTo(_severityRank(b.severity));
        if (severity != 0) return severity;
        return b.createdAt.compareTo(a.createdAt);
      });
  }
}

int _severityRank(AlertSeverity severity) => switch (severity) {
      AlertSeverity.critical => 0,
      AlertSeverity.warning => 1,
      AlertSeverity.info => 2,
    };

String formatAlertRelativeTime(DateTime createdAt) {
  final diff = DateTime.now().difference(createdAt);
  if (diff.inMinutes < 1) return 'Just now';
  if (diff.inHours < 1) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays == 1) return 'Yesterday';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  return 'Today';
}
