import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/alerts/alert.dart';
import '../../../core/alerts/alerts_providers.dart';
import '../../../core/alerts/alerts_repository.dart';
import '../../../core/auth/auth_providers.dart';
import '../../../core/config/app_config.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
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

  Future<void> _markRead() async {
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
    } finally {
      if (mounted) setState(() => _markingRead = false);
    }
  }

  void _openLink(String? path) {
    if (path == null || path.isEmpty) return;
    context.go(path);
  }

  List<Widget> _detailFields(Alert item, TextTheme theme) {
    if (item.type == AlertType.adWaste) {
      final snapshot = item.metricSnapshot;
      final campaignName = snapshot?['campaign_name'] as String? ?? item.title;
      final spend = snapshot?['spend_7d_usd'];
      final poas = snapshot?['poas_7d'];

      return [
        Text('Campaign', style: theme.labelLarge),
        const SizedBox(height: MorganSpace.xxs),
        Text(campaignName, style: theme.bodyLarge),
        const SizedBox(height: MorganSpace.md),
        Text('7-day spend', style: theme.labelLarge),
        const SizedBox(height: MorganSpace.xxs),
        Text(
          spend is num ? '\$${spend.round()}' : item.magnitude,
          style: theme.bodyLarge,
        ),
        const SizedBox(height: MorganSpace.md),
        Text('POAS', style: theme.labelLarge),
        const SizedBox(height: MorganSpace.xxs),
        Text(
          poas is num ? poas.toStringAsFixed(2) : item.magnitude,
          style: theme.bodyLarge,
        ),
        const SizedBox(height: MorganSpace.md),
        Text('Suggested action', style: theme.labelLarge),
        const SizedBox(height: MorganSpace.xxs),
        Text(item.topDriver, style: theme.bodyLarge),
        const SizedBox(height: MorganSpace.md),
        Text('Summary', style: theme.labelLarge),
        const SizedBox(height: MorganSpace.xxs),
        Text(item.body, style: theme.bodyMedium),
      ];
    }

    if (item.type == AlertType.stockoutRisk) {
      final snapshot = item.metricSnapshot;
      final skuName = snapshot?['sku_name'] as String? ?? item.title;
      final days = snapshot?['days_of_stock'];
      final leadTime = snapshot?['lead_time_days'];

      return [
        Text('SKU', style: theme.labelLarge),
        const SizedBox(height: MorganSpace.xxs),
        Text(skuName, style: theme.bodyLarge),
        const SizedBox(height: MorganSpace.md),
        Text('Days remaining', style: theme.labelLarge),
        const SizedBox(height: MorganSpace.xxs),
        Text(
          days is num ? '~${days.round()} days' : item.magnitude,
          style: theme.bodyLarge,
        ),
        if (leadTime is num) ...[
          const SizedBox(height: MorganSpace.md),
          Text('Supplier lead time', style: theme.labelLarge),
          const SizedBox(height: MorganSpace.xxs),
          Text('${leadTime.round()} days', style: theme.bodyLarge),
        ],
        const SizedBox(height: MorganSpace.md),
        Text('Summary', style: theme.labelLarge),
        const SizedBox(height: MorganSpace.xxs),
        Text(item.body, style: theme.bodyMedium),
      ];
    }

    if (item.type == AlertType.cashCrunch) {
      final snapshot = item.metricSnapshot;
      final balance = snapshot?['cash_balance_usd'];
      final burn = snapshot?['daily_burn_usd'];
      final actions = snapshot?['suggested_actions'];

      return [
        Text('Balance', style: theme.labelLarge),
        const SizedBox(height: MorganSpace.xxs),
        Text(
          balance is num ? '\$${balance.round()}' : item.magnitude,
          style: theme.bodyLarge,
        ),
        const SizedBox(height: MorganSpace.md),
        Text('Daily burn', style: theme.labelLarge),
        const SizedBox(height: MorganSpace.xxs),
        Text(
          burn is num ? '\$${burn.round()}/day' : item.magnitude,
          style: theme.bodyLarge,
        ),
        const SizedBox(height: MorganSpace.md),
        Text('Runway', style: theme.labelLarge),
        const SizedBox(height: MorganSpace.xxs),
        Text(item.magnitude, style: theme.bodyLarge),
        const SizedBox(height: MorganSpace.md),
        Text('Suggested actions', style: theme.labelLarge),
        const SizedBox(height: MorganSpace.xxs),
        if (actions is List)
          ...actions.map(
            (action) => Padding(
              padding: const EdgeInsets.only(bottom: MorganSpace.xxs),
              child: Text('• $action', style: theme.bodyMedium),
            ),
          )
        else
          Text(item.topDriver, style: theme.bodyMedium),
        const SizedBox(height: MorganSpace.md),
        Text('Summary', style: theme.labelLarge),
        const SizedBox(height: MorganSpace.xxs),
        Text(item.body, style: theme.bodyMedium),
      ];
    }

    return [
      Text('Magnitude', style: theme.labelLarge),
      const SizedBox(height: MorganSpace.xxs),
      Text(item.magnitude, style: theme.bodyLarge),
      const SizedBox(height: MorganSpace.md),
      Text('Top driver', style: theme.labelLarge),
      const SizedBox(height: MorganSpace.xxs),
      Text(item.topDriver, style: theme.bodyLarge),
      const SizedBox(height: MorganSpace.md),
      Text('Summary', style: theme.labelLarge),
      const SizedBox(height: MorganSpace.xxs),
      Text(item.body, style: theme.bodyMedium),
    ];
  }

  List<Widget> _actionButtons(Alert item) {
    if (item.type == AlertType.adWaste) {
      return [
        MorganPrimaryButton(
          label: 'View Marketing Overview',
          onPressed: () => _openLink(item.links.marketingOverview),
        ),
        const SizedBox(height: MorganSpace.sm),
        OutlinedButton(
          onPressed: () => _openLink(item.links.recommendation),
          child: const Text('View recommendation'),
        ),
      ];
    }

    if (item.type == AlertType.stockoutRisk) {
      return [
        MorganPrimaryButton(
          label: 'View reorder recommendation',
          onPressed: () => _openLink(item.links.recommendation),
        ),
      ];
    }

    return [
      MorganPrimaryButton(
        label: 'View daily brief',
        onPressed: () => _openLink(item.links.brief),
      ),
      const SizedBox(height: MorganSpace.sm),
      OutlinedButton(
        onPressed: () => _openLink(item.links.chat),
        child: const Text('Ask Morgan why'),
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final alert = ref.watch(alertDetailProvider(widget.alertId));

    return Scaffold(
      backgroundColor: p.background,
      appBar: AppBar(
        backgroundColor: p.background,
        elevation: 0,
        title: const Text('Alert'),
      ),
      body: alert.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: Text('Could not load alert', style: theme.textTheme.bodyLarge),
        ),
        data: (item) {
          final (Color accent, Color bg, IconData icon) = switch (item.severity) {
            AlertSeverity.critical => (p.loss, p.lossMuted, Icons.error_outline_rounded),
            AlertSeverity.warning => (p.warning, p.goldMuted, Icons.warning_amber_rounded),
            AlertSeverity.info => (p.accent, p.accentMuted, Icons.info_outline_rounded),
          };

          return Column(
            children: [
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(
                    MorganSpace.screenH,
                    MorganSpace.sm,
                    MorganSpace.screenH,
                    MorganSpace.huge,
                  ),
                  children: [
                    MorganSurface(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: bg,
                              borderRadius: BorderRadius.circular(MorganRadius.xs),
                            ),
                            child: Icon(icon, size: 20, color: accent),
                          ),
                          const SizedBox(width: MorganSpace.md),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(item.title, style: theme.textTheme.titleLarge),
                                const SizedBox(height: MorganSpace.xxs),
                                Text(
                                  formatAlertRelativeTime(item.createdAt),
                                  style: theme.textTheme.bodySmall,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: MorganSpace.md),
                    MorganSurface(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: _detailFields(item, theme.textTheme),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.fromLTRB(
                  MorganSpace.screenH,
                  MorganSpace.sm,
                  MorganSpace.screenH,
                  MorganSpace.lg,
                ),
                decoration: BoxDecoration(
                  color: p.background,
                  border: Border(top: BorderSide(color: p.borderSubtle)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    ..._actionButtons(item),
                    if (item.isUnread) ...[
                      const SizedBox(height: MorganSpace.sm),
                      TextButton(
                        onPressed: _markingRead ? null : _markRead,
                        child: _markingRead
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Text('Mark as read'),
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
