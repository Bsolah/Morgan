import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/alerts/alert.dart';
import '../../../core/alerts/alert_visuals.dart';
import '../../../core/alerts/alerts_providers.dart';
import '../../../core/alerts/alerts_repository.dart';
import '../../../core/auth/auth_providers.dart';
import '../../../core/config/app_config.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/haptics/morgan_haptics.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_detail_app_bar.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../../../shared/widgets/morgan_surface.dart';

class AlertDetailScreen extends ConsumerStatefulWidget {
  const AlertDetailScreen({super.key, required this.alertId});

  final String alertId;

  @override
  ConsumerState<AlertDetailScreen> createState() => _AlertDetailScreenState();
}

class _AlertDetailScreenState extends ConsumerState<AlertDetailScreen> {
  bool _markingRead = false;

  Future<void> _markRead({bool popAfter = false, bool wasUnread = true}) async {
    setState(() => _markingRead = true);
    try {
      final session = await ref.read(authSessionProvider.future);
      if (session != null) {
        try {
          await AlertsRepository(session).markRead(widget.alertId);
        } catch (_) {
          if (AppConfig.canSkipSetup) {
            AlertsRepository.markReadLocally(widget.alertId);
          }
        }
      }
      ref.invalidate(alertsProvider);
      ref.invalidate(alertDetailProvider(widget.alertId));
      if (wasUnread) MorganHaptics.lightImpact();
      if (popAfter && mounted) context.pop();
    } finally {
      if (mounted) setState(() => _markingRead = false);
    }
  }

  void _openLink(String? path) {
    if (path == null || path.isEmpty) return;
    context.push(path);
  }

  String? _primaryRoute(Alert item) {
    if (item.links.recommendation != null && item.links.recommendation!.isNotEmpty) {
      return item.links.recommendation;
    }
    return switch (item.type) {
      AlertType.adWaste => item.links.marketingOverview ?? '/marketing',
      AlertType.stockoutRisk => item.links.recommendation ?? '/inventory',
      AlertType.cashCrunch => '/cash',
      AlertType.marginDrop => '/profit',
      AlertType.refundSpike => item.links.chat ?? '/chat',
      AlertType.profitLeak => item.links.recommendation ?? '/recommendations',
    };
  }

  String _primaryLabel(Alert item) => switch (item.type) {
        AlertType.adWaste => 'View Marketing Overview',
        AlertType.stockoutRisk => 'View reorder recommendation',
        AlertType.cashCrunch => 'Review cash runway',
        AlertType.marginDrop => 'Review profit dashboard',
        AlertType.refundSpike => 'Ask Morgan why',
        AlertType.profitLeak => 'View recommendation',
      };

  List<Widget> _detailFields(Alert item, TextTheme theme, MorganPalette p) {
    if (item.type == AlertType.adWaste) {
      final snapshot = item.metricSnapshot;
      final campaignName = snapshot?['campaign_name'] as String? ?? item.title;
      final spend = snapshot?['spend_7d_usd'];
      final poas = snapshot?['poas_7d'];

      return [
        _DetailRow(label: 'Campaign', value: campaignName, theme: theme),
        _DetailRow(
          label: '7-day spend',
          value: spend is num ? '\$${spend.round()}' : item.magnitude,
          theme: theme,
        ),
        _DetailRow(
          label: 'POAS',
          value: poas is num ? poas.toStringAsFixed(2) : item.magnitude,
          theme: theme,
        ),
        _DetailRow(label: 'Suggested action', value: item.topDriver, theme: theme),
        _DetailRow(label: 'Summary', value: item.body, theme: theme, multiline: true),
      ];
    }

    if (item.type == AlertType.stockoutRisk) {
      final snapshot = item.metricSnapshot;
      final skuName = snapshot?['sku_name'] as String? ?? item.title;
      final days = snapshot?['days_of_stock'];
      final leadTime = snapshot?['lead_time_days'];

      return [
        _DetailRow(label: 'SKU', value: skuName, theme: theme),
        _DetailRow(
          label: 'Days remaining',
          value: days is num ? '~${days.round()} days' : item.magnitude,
          theme: theme,
        ),
        if (leadTime is num)
          _DetailRow(label: 'Supplier lead time', value: '${leadTime.round()} days', theme: theme),
        _DetailRow(label: 'Summary', value: item.body, theme: theme, multiline: true),
      ];
    }

    if (item.type == AlertType.cashCrunch) {
      final snapshot = item.metricSnapshot;
      final balance = snapshot?['cash_balance_usd'];
      final burn = snapshot?['daily_burn_usd'];
      final actions = snapshot?['suggested_actions'];

      return [
        _DetailRow(
          label: 'Balance',
          value: balance is num ? '\$${balance.round()}' : item.magnitude,
          theme: theme,
        ),
        _DetailRow(
          label: 'Daily burn',
          value: burn is num ? '\$${burn.round()}/day' : item.magnitude,
          theme: theme,
        ),
        _DetailRow(label: 'Runway', value: item.magnitude, theme: theme),
        if (actions is List)
          ...actions.map(
            (action) => Padding(
              padding: const EdgeInsets.only(bottom: MorganSpace.xxs),
              child: Text('• $action', style: theme.bodyMedium),
            ),
          )
        else
          _DetailRow(label: 'Suggested action', value: item.topDriver, theme: theme),
        _DetailRow(label: 'Summary', value: item.body, theme: theme, multiline: true),
      ];
    }

    return [
      _DetailRow(label: 'Magnitude', value: item.magnitude, theme: theme),
      _DetailRow(label: 'Top driver', value: item.topDriver, theme: theme),
      _DetailRow(label: 'Summary', value: item.body, theme: theme, multiline: true),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final alert = ref.watch(alertDetailProvider(widget.alertId));

    return Scaffold(
      backgroundColor: p.background,
      appBar: const MorganDetailAppBar(title: 'Alert', fallbackRoute: '/alerts'),
      body: alert.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: Text('Could not load alert', style: theme.textTheme.bodyLarge),
        ),
        data: (item) {
          final (stripeColor, stripeBg) = alertSeverityAccent(p, item.severity);
          final primaryRoute = _primaryRoute(item);

          return Column(
            children: [
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(
                    MorganSpace.screenH,
                    MorganSpace.sm,
                    MorganSpace.screenH,
                    MorganSpace.lg,
                  ),
                  children: [
                    MorganSurface(
                      padding: EdgeInsets.zero,
                      child: IntrinsicHeight(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Container(
                              width: 4,
                              decoration: BoxDecoration(
                                color: stripeColor,
                                borderRadius: const BorderRadius.horizontal(
                                  left: Radius.circular(MorganRadius.md),
                                ),
                              ),
                            ),
                            Expanded(
                              child: Padding(
                                padding: const EdgeInsets.all(MorganSpace.card),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Container(
                                          width: 40,
                                          height: 40,
                                          decoration: BoxDecoration(
                                            color: stripeBg,
                                            borderRadius: BorderRadius.circular(MorganRadius.xs),
                                          ),
                                          child: Icon(
                                            alertTypeIcon(item.type),
                                            size: 20,
                                            color: stripeColor,
                                          ),
                                        ),
                                        const SizedBox(width: MorganSpace.sm),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                alertTypeLabel(item.type),
                                                style: theme.textTheme.labelMedium?.copyWith(
                                                  color: stripeColor,
                                                ),
                                              ),
                                              Text(item.title, style: theme.textTheme.titleLarge),
                                              Text(
                                                formatAlertRelativeTime(item.createdAt),
                                                style: theme.textTheme.bodySmall,
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: MorganSpace.md),
                                    Text(
                                      item.magnitude,
                                      style: theme.textTheme.headlineSmall?.copyWith(
                                        color: stripeColor,
                                      ),
                                    ),
                                    const SizedBox(height: MorganSpace.sm),
                                    Text(
                                      item.topDriver,
                                      style: theme.textTheme.titleSmall,
                                    ),
                                    const SizedBox(height: MorganSpace.sm),
                                    Text(
                                      item.body,
                                      maxLines: 3,
                                      overflow: TextOverflow.ellipsis,
                                      style: theme.textTheme.bodyMedium,
                                    ),
                                    if (primaryRoute != null) ...[
                                      const SizedBox(height: MorganSpace.md),
                                      MorganPrimaryButton(
                                        label: _primaryLabel(item),
                                        onPressed: () => _openLink(primaryRoute),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: MorganSpace.md),
                    MorganSurface(
                      padding: EdgeInsets.zero,
                      child: Theme(
                        data: theme.copyWith(dividerColor: Colors.transparent),
                        child: ExpansionTile(
                          tilePadding: const EdgeInsets.symmetric(horizontal: MorganSpace.card),
                          title: Text('Details', style: theme.textTheme.titleSmall),
                          children: [
                            Padding(
                              padding: const EdgeInsets.fromLTRB(
                                MorganSpace.card,
                                0,
                                MorganSpace.card,
                                MorganSpace.card,
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: _detailFields(item, theme.textTheme, p),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: EdgeInsets.fromLTRB(
                  MorganSpace.screenH,
                  MorganSpace.sm,
                  MorganSpace.screenH,
                  MorganSpace.lg + MediaQuery.paddingOf(context).bottom,
                ),
                decoration: BoxDecoration(
                  color: p.background,
                  border: Border(top: BorderSide(color: p.borderSubtle)),
                ),
                child: Row(
                  children: [
                    if (item.isUnread)
                      Expanded(
                        child: TextButton(
                          onPressed: _markingRead ? null : () => _markRead(),
                          child: _markingRead
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Text('Mark read'),
                        ),
                      ),
                    if (item.isUnread) const SizedBox(width: MorganSpace.sm),
                    Expanded(
                      child: TextButton(
                        onPressed: _markingRead
                            ? null
                            : () => _markRead(popAfter: true),
                        child: const Text('Dismiss'),
                      ),
                    ),
                    if (item.links.chat != null) ...[
                      const SizedBox(width: MorganSpace.sm),
                      Expanded(
                        flex: 2,
                        child: OutlinedButton(
                          onPressed: () => _openLink(item.links.chat),
                          child: const Text('Ask Morgan'),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    required this.value,
    required this.theme,
    this.multiline = false,
  });

  final String label;
  final String value;
  final TextTheme theme;
  final bool multiline;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: MorganSpace.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: theme.labelLarge),
          const SizedBox(height: MorganSpace.xxs),
          Text(
            value,
            style: multiline ? theme.bodyMedium : theme.bodyLarge,
          ),
        ],
      ),
    );
  }
}
