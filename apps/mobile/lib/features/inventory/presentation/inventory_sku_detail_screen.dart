import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/inventory/inventory_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_metric_card.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../../../shared/widgets/morgan_surface.dart';

class InventorySkuDetailScreen extends ConsumerWidget {
  const InventorySkuDetailScreen({super.key, required this.sku});

  final String sku;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final detailAsync = ref.watch(inventorySkuDetailProvider(sku));
    final money = NumberFormat.simpleCurrency();

    return Scaffold(
      backgroundColor: p.background,
      appBar: AppBar(
        backgroundColor: p.background,
        foregroundColor: p.textPrimary,
        title: Text(sku),
      ),
      body: SafeArea(
        child: detailAsync.when(
          loading: () => Center(child: CircularProgressIndicator(color: p.accent)),
          error: (_, __) => Center(
            child: Text('Could not load SKU inventory detail.', style: theme.textTheme.bodyMedium),
          ),
          data: (detail) {
            if (detail == null) {
              return Center(child: Text('SKU not found.', style: theme.textTheme.bodyMedium));
            }

            final statusColor = _healthColor(p, detail.healthStatus);

            return ListView(
              padding: const EdgeInsets.fromLTRB(
                MorganSpace.screenH,
                MorganSpace.md,
                MorganSpace.screenH,
                MorganSpace.huge,
              ),
              children: [
                Row(
                  children: [
                    Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(color: statusColor, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: MorganSpace.sm),
                    Text(
                      '${formatDaysOfStock(detail.daysOfStock)} of supply remaining',
                      style: theme.textTheme.titleMedium?.copyWith(color: statusColor),
                    ),
                  ],
                ),
                if (detail.title != null) ...[
                  const SizedBox(height: MorganSpace.xs),
                  Text(detail.title!, style: theme.textTheme.bodyMedium),
                ],
                const SizedBox(height: MorganSpace.lg),
                Row(
                  children: [
                    Expanded(
                      child: MorganMetricCard(
                        label: 'On hand',
                        value: '${detail.availableUnits}',
                      ),
                    ),
                    const SizedBox(width: MorganSpace.sm),
                    Expanded(
                      child: MorganMetricCard(
                        label: 'Velocity',
                        value: '${detail.velocityPerDay.toStringAsFixed(1)}/day',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: MorganSpace.sm),
                Row(
                  children: [
                    Expanded(
                      child: MorganMetricCard(
                        label: 'Lead time',
                        value: '${detail.leadTimeDays}d',
                      ),
                    ),
                    const SizedBox(width: MorganSpace.sm),
                    Expanded(
                      child: MorganMetricCard(
                        label: 'Safety stock',
                        value: '${detail.safetyStockUnits}',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: MorganSpace.sm),
                MorganMetricCard(
                  label: '30d revenue',
                  value: money.format(detail.grossRevenue),
                ),
                if (detail.forecastUnits30d != null) ...[
                  const SizedBox(height: MorganSpace.sm),
                  MorganMetricCard(
                    label: '30d demand forecast',
                    value: '${detail.forecastUnits30d!.round()} units',
                    subtitle: detail.forecastModel == null
                        ? null
                        : 'Based on ${detail.forecastModel!.replaceAll('_', ' ')}',
                  ),
                ],
                if (detail.overstock && detail.overstockValueUsd > 0) ...[
                  const SizedBox(height: MorganSpace.lg),
                  MorganSurface(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('OVERSTOCK', style: theme.textTheme.labelSmall),
                        const SizedBox(height: MorganSpace.sm),
                        Text(
                          '~${money.format(detail.overstockValueUsd)} tied up beyond 90-day supply',
                          style: theme.textTheme.bodyLarge,
                        ),
                      ],
                    ),
                  ),
                ],
                if (detail.reorderRecommended) ...[
                  const SizedBox(height: MorganSpace.lg),
                  MorganSurface(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('REORDER RECOMMENDATION', style: theme.textTheme.labelSmall),
                        const SizedBox(height: MorganSpace.sm),
                        Text(
                          detail.recommendationTitle ?? 'Reorder recommended',
                          style: theme.textTheme.titleMedium,
                        ),
                        const SizedBox(height: MorganSpace.sm),
                        Text(detail.recommendationBody ?? '', style: theme.textTheme.bodyMedium),
                        if (detail.reorderQty != null) ...[
                          const SizedBox(height: MorganSpace.md),
                          Text(
                            'Suggested qty: ${detail.reorderQty} units',
                            style: theme.textTheme.titleSmall?.copyWith(color: p.profit),
                          ),
                        ],
                        if (detail.reorderByDay != null) ...[
                          const SizedBox(height: MorganSpace.xxs),
                          Text('Order by ${detail.reorderByDay}', style: theme.textTheme.bodySmall),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: MorganSpace.lg),
                  MorganPrimaryButton(
                    label: 'Ask Morgan about this reorder',
                    onPressed: () {
                      final prompt = detail.recommendationBody ??
                          'Should I reorder $sku? I have ${detail.availableUnits} units and ${detail.velocityPerDay.toStringAsFixed(1)}/day velocity.';
                      context.push('/chat?prompt=${Uri.encodeComponent(prompt)}');
                    },
                  ),
                ],
                const SizedBox(height: MorganSpace.lg),
                OutlinedButton(
                  onPressed: () => context.push('/profit/sku/${Uri.encodeComponent(sku)}'),
                  child: const Text('View profit economics'),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Color _healthColor(MorganPalette p, String status) {
    switch (status) {
      case 'critical':
        return p.loss;
      case 'warning':
        return p.warning;
      case 'healthy':
        return p.profit;
      default:
        return p.textMuted;
    }
  }
}
