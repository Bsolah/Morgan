import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/inventory/inventory_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_detail_app_bar.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../../../shared/widgets/morgan_secondary_button.dart';
import '../../../shared/widgets/morgan_surface.dart';
import '../widgets/inventory_velocity_trend_chart.dart';

class InventorySkuDetailScreen extends ConsumerWidget {
  const InventorySkuDetailScreen({super.key, required this.sku});

  final String sku;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final detailAsync = ref.watch(inventorySkuDetailProvider(sku));

    return Scaffold(
      backgroundColor: p.background,
      body: SafeArea(
        child: detailAsync.when(
          loading: () => Column(
            children: [
              MorganDetailAppBar(title: sku, fallbackRoute: '/inventory'),
              Expanded(child: Center(child: CircularProgressIndicator(color: p.accent))),
            ],
          ),
          error: (_, __) => Column(
            children: [
              MorganDetailAppBar(title: sku, fallbackRoute: '/inventory'),
              Expanded(
                child: Center(
                  child: Text('Could not load SKU inventory detail.', style: theme.textTheme.bodyMedium),
                ),
              ),
            ],
          ),
          data: (detail) {
            if (detail == null) {
              return Column(
                children: [
                  MorganDetailAppBar(title: sku, fallbackRoute: '/inventory'),
                  Expanded(
                    child: Center(child: Text('SKU not found.', style: theme.textTheme.bodyMedium)),
                  ),
                ],
              );
            }

            final statusColor = _healthColor(p, detail.healthStatus);
            final days = detail.daysOfStock;
            final leadTime = detail.leadTimeDays;
            final belowLeadTime = days != null && days < leadTime;

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                MorganDetailAppBar(title: detail.sku, fallbackRoute: '/inventory'),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(
                      MorganSpace.screenH,
                      MorganSpace.sm,
                      MorganSpace.screenH,
                      MorganSpace.huge,
                    ),
                    children: [
                      _RiskPill(status: detail.healthStatus),
                      if (detail.title != null) ...[
                        const SizedBox(height: MorganSpace.sm),
                        Text(detail.title!, style: theme.textTheme.bodyMedium),
                      ],
                      MorganSurface(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('DAYS OF STOCK', style: theme.textTheme.labelMedium),
                            const SizedBox(height: MorganSpace.sm),
                            Text(
                              formatDaysOfStock(days),
                              style: theme.textTheme.displaySmall?.copyWith(color: statusColor),
                            ),
                            const SizedBox(height: MorganSpace.md),
                            Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('Lead time', style: theme.textTheme.labelSmall),
                                      Text('${leadTime}d', style: theme.textTheme.titleMedium),
                                    ],
                                  ),
                                ),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('On hand', style: theme.textTheme.labelSmall),
                                      Text('${detail.availableUnits} units', style: theme.textTheme.titleMedium),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: MorganSpace.sm),
                            Text(
                              belowLeadTime
                                  ? 'Cover is below lead time — reorder before you run out.'
                                  : 'Cover exceeds lead time for now.',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: belowLeadTime ? p.warning : p.textMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (detail.reorderRecommended) ...[
                        const SizedBox(height: MorganSpace.lg),
                        MorganPrimaryButton(
                          label: 'Plan reorder',
                          onPressed: () {
                            final qty = detail.reorderQty;
                            final query = qty == null
                                ? 'sku=${Uri.encodeComponent(sku)}'
                                : 'sku=${Uri.encodeComponent(sku)}&qty=$qty';
                            context.push('/scenarios?$query');
                          },
                        ),
                      ],
                      const SizedBox(height: MorganSpace.xl),
                      Text('VELOCITY TREND', style: theme.textTheme.labelMedium),
                      const SizedBox(height: MorganSpace.sm),
                      MorganSurface(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Observed ${detail.observedVelocityPerDay?.toStringAsFixed(1) ?? detail.velocityPerDay.toStringAsFixed(1)}/day'
                              '${detail.forecastedVelocityPerDay != null ? ' · Forecast ${detail.forecastedVelocityPerDay!.toStringAsFixed(1)}/day' : ''}',
                              style: theme.textTheme.bodySmall,
                            ),
                            const SizedBox(height: MorganSpace.sm),
                            InventoryVelocityTrendChart(points: detail.velocityTrend),
                          ],
                        ),
                      ),
                      const SizedBox(height: MorganSpace.lg),
                      MorganSurface(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Safety stock', style: theme.textTheme.labelMedium),
                            const SizedBox(height: MorganSpace.xxs),
                            Text('${detail.safetyStockUnits} units', style: theme.textTheme.titleMedium),
                          ],
                        ),
                      ),
                      if (detail.reorderRecommended) ...[
                        const SizedBox(height: MorganSpace.lg),
                        MorganSurface(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('REORDER HINT', style: theme.textTheme.labelSmall),
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
                      ],
                      const SizedBox(height: MorganSpace.lg),
                      MorganSecondaryButton(
                        label: 'View profit economics',
                        onPressed: () => context.push('/profit/sku/${Uri.encodeComponent(sku)}'),
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Color _healthColor(MorganPalette p, String status) {
    return switch (status) {
      'critical' => p.loss,
      'warning' => p.warning,
      'healthy' => p.profit,
      _ => p.textMuted,
    };
  }
}

class _RiskPill extends StatelessWidget {
  const _RiskPill({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final color = switch (status) {
      'critical' => p.loss,
      'warning' => p.warning,
      'healthy' => p.profit,
      _ => p.textMuted,
    };
    final label = switch (status) {
      'critical' => 'Critical risk',
      'warning' => 'At risk',
      'healthy' => 'Healthy',
      _ => status,
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: MorganSpace.sm, vertical: MorganSpace.xxs),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(MorganRadius.pill),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        label,
        style: theme.textTheme.labelSmall?.copyWith(color: color, fontWeight: FontWeight.w600),
      ),
    );
  }
}
