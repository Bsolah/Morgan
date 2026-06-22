import 'package:dio/dio.dart';

import '../auth/auth_session.dart';
import '../config/app_config.dart';
import 'alert.dart';

class AlertsRepository {
  AlertsRepository(this._session);

  final AuthSession _session;

  Dio get _dio => Dio(
        BaseOptions(
          baseUrl: AppConfig.apiBaseUrl,
          headers: {'Authorization': 'Bearer ${_session.accessToken}'},
        ),
      );

  Future<AlertsFeed> fetchAlerts() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/stores/${_session.storeId}/alerts',
    );
    return AlertsFeed.fromJson(response.data!);
  }

  Future<Alert> fetchDetail(String alertId) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/stores/${_session.storeId}/alerts/$alertId',
    );
    return Alert.fromJson(response.data!);
  }

  Future<Alert> markRead(String alertId) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/v1/stores/${_session.storeId}/alerts/$alertId/read',
    );
    return Alert.fromJson(response.data!);
  }

  static final Set<String> _localReadIds = {};

  static void markReadLocally(String id) {
    _localReadIds.add(id);
  }

  static AlertsFeed devFallback() {
    final marginCreated = DateTime.now().subtract(const Duration(hours: 2));
    final adWasteCreated = DateTime.now().subtract(const Duration(hours: 5));
    final stockoutCreated = DateTime.now().subtract(const Duration(hours: 8));
    final cashCreated = DateTime.now().subtract(const Duration(hours: 1));
    const marginId = 'alert-margin-dev-001';
    const adWasteId = 'alert-ad-waste-dev-001';
    const stockoutId = 'alert-stockout-dev-001';
    const cashId = 'alert-cash-dev-001';

    final marginAlert = Alert(
      id: marginId,
      storeId: 'dev-local-store',
      severity: AlertSeverity.warning,
      type: AlertType.marginDrop,
      title: 'Margin down 14%',
      body:
          '14% below 7-day average (38.2% vs 44.4%). Top driver: Refunds increased \$380 vs 7-day average. Review your daily brief or ask Morgan why.',
      magnitude: '14% below 7-day average (38.2% vs 44.4%)',
      topDriver: 'Refunds increased \$380 vs 7-day average',
      links: const AlertLinks(
        brief: '/home',
        chat: '/chat?starter=Why%20did%20margin%20drop%3F',
      ),
      createdAt: marginCreated,
      readAt: _localReadIds.contains(marginId) ? DateTime.now() : null,
    );

    final adWasteAlert = Alert(
      id: adWasteId,
      storeId: 'dev-local-store',
      severity: AlertSeverity.warning,
      type: AlertType.adWaste,
      title: 'Retargeting BOF burning cash',
      body:
          'Retargeting BOF has POAS 0.72 over the last 7 days (\$1,800 spend). Pause campaign or cut daily budget by 50%.',
      magnitude: 'POAS 0.72 · 7d spend \$1,800',
      topDriver: 'Pause campaign or cut daily budget by 50%',
      links: const AlertLinks(
        marketingOverview: '/marketing?campaign=meta_retargeting_bof',
        recommendation: '/recommendations/rec-001',
      ),
      metricSnapshot: const {
        'campaign_id': 'meta_retargeting_bof',
        'campaign_name': 'Retargeting BOF',
        'poas_7d': 0.72,
        'spend_7d_usd': 1800,
        'recommendation_id': 'rec-001',
        'suggested_action': 'Pause campaign or cut daily budget by 50%',
      },
      createdAt: adWasteCreated,
      readAt: _localReadIds.contains(adWasteId) ? DateTime.now() : null,
    );

    final stockoutAlert = Alert(
      id: stockoutId,
      storeId: 'dev-local-store',
      severity: AlertSeverity.warning,
      type: AlertType.stockoutRisk,
      title: 'Stockout risk: Blue Tee (M)',
      body:
          'Blue Tee (M) has 6 days remaining at current velocity (10-day supplier lead time). Reorder now to avoid lost sales.',
      magnitude: '~6 days remaining',
      topDriver: 'Below 13-day reorder window (lead time + 3 days)',
      links: const AlertLinks(
        recommendation: '/recommendations/rec-002',
      ),
      metricSnapshot: const {
        'sku_id': 'sku_blue_tee_m',
        'sku_name': 'Blue Tee (M)',
        'days_of_stock': 6,
        'lead_time_days': 10,
        'reorder_threshold_days': 13,
        'recommendation_id': 'rec-002',
      },
      createdAt: stockoutCreated,
      readAt: _localReadIds.contains(stockoutId) ? DateTime.now() : null,
    );

    final cashAlert = Alert(
      id: cashId,
      storeId: 'dev-local-store',
      severity: AlertSeverity.critical,
      type: AlertType.cashCrunch,
      title: 'Cash crunch: 5 days runway',
      body:
          'Balance \$4,100 at \$820/day burn (5 days runway). Suggested actions: Pause discretionary ad spend; Review payables due this week; Ask Morgan for cash levers.',
      magnitude: '5 days runway',
      topDriver: 'Pause discretionary ad spend',
      links: const AlertLinks(
        brief: '/home',
        chat: '/chat?starter=How%20can%20I%20extend%20cash%20runway%3F',
      ),
      metricSnapshot: const {
        'cash_balance_usd': 4100,
        'daily_burn_usd': 820,
        'runway_days': 5,
        'suggested_actions': [
          'Pause discretionary ad spend',
          'Review payables due this week',
          'Ask Morgan for cash levers',
        ],
      },
      createdAt: cashCreated,
      readAt: _localReadIds.contains(cashId) ? DateTime.now() : null,
    );

    final alerts = [marginAlert, adWasteAlert, stockoutAlert, cashAlert]
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

    return AlertsFeed(
      alerts: alerts,
      unreadCount: alerts.where((alert) => alert.isUnread).length,
    );
  }

  static Alert? devDetailFallback(String id) {
    final feed = devFallback();
    for (final alert in feed.alerts) {
      if (alert.id == id) return alert;
    }
    return null;
  }
}
