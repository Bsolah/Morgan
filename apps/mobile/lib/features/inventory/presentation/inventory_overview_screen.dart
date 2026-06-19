import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/inventory/inventory_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_metric_card.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_surface.dart';

class InventoryOverviewScreen extends ConsumerWidget {
  const InventoryOverviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final healthAsync = ref.watch(inventoryHealthProvider);
    final money = NumberFormat.simpleCurrency();

    return Scaffold(
      backgroundColor: p.background,
      body: SafeArea(
        child: healthAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) => Center(
            child: Text('Could not load inventory health.', style: theme.textTheme.bodyMedium),
          ),
          data: (health) {
            if (health == null) {
              return Center(child: Text('Inventory data unavailable.', style: theme.textTheme.bodyMedium));
            }

            return ListView(
              padding: const EdgeInsets.only(bottom: MorganSpace.huge),
              children: [
                MorganScreenHeader(
                  title: 'Inventory',
                  subtitle: 'Trailing ${health.windowDays} days · top SKUs by revenue',
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: MorganMetricCard(
                              label: 'Stockout risk',
                              value: '${health.stockoutRiskCount}',
                              subtitle: 'SKUs under 14 days',
                            ),
                          ),
                          const SizedBox(width: MorganSpace.sm),
                          Expanded(
                            child: MorganMetricCard(
                              label: 'Overstocked',
                              value: '${health.overstockCount}',
                              subtitle: 'SKUs over 90 days',
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: MorganSpace.sm),
                      MorganMetricCard(
                        label: 'Cash tied in overstock',
                        value: money.format(health.overstockValueUsd),
                      ),
                      const SizedBox(height: MorganSpace.xl),
                      const MorganSectionHeader(title: 'Top SKUs by revenue'),
                      const SizedBox(height: MorganSpace.sm),
                      if (health.skus.isEmpty)
                        Text(
                          'SKU inventory appears after product catalog and order history sync.',
                          style: theme.textTheme.bodySmall,
                        )
                      else
                        ...health.skus.map((sku) {
                          return Padding(
                            padding: const EdgeInsets.only(bottom: MorganSpace.sm),
                            child: _InventorySkuTile(
                              sku: sku,
                              onTap: () => context.push('/inventory/sku/${Uri.encodeComponent(sku.sku)}'),
                            ),
                          );
                        }),
                      const SizedBox(height: MorganSpace.md),
                      Text(
                        'Red <7d · Yellow 7–14d · Green >14d supply',
                        style: theme.textTheme.labelSmall,
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
}

class _InventorySkuTile extends StatelessWidget {
  const _InventorySkuTile({required this.sku, required this.onTap});

  final InventorySkuHealth sku;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final money = NumberFormat.simpleCurrency();
    final statusColor = _healthColor(p, sku.healthStatus);

    return GestureDetector(
      onTap: onTap,
      child: MorganSurface(
        child: Row(
          children: [
            Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(color: statusColor, shape: BoxShape.circle),
            ),
            const SizedBox(width: MorganSpace.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(sku.sku, style: theme.textTheme.titleSmall),
                  const SizedBox(height: MorganSpace.xxs),
                  Text(
                    '${formatDaysOfStock(sku.daysOfStock)} supply · ${sku.availableUnits} on hand · ${sku.velocityPerDay.toStringAsFixed(1)}/day',
                    style: theme.textTheme.bodySmall,
                  ),
                  if (sku.stockoutRisk || sku.overstock) ...[
                    const SizedBox(height: MorganSpace.xxs),
                    Text(
                      sku.stockoutRisk ? 'Stockout risk' : 'Overstock',
                      style: theme.textTheme.labelSmall?.copyWith(color: statusColor),
                    ),
                  ],
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(money.format(sku.grossRevenue), style: theme.textTheme.titleSmall),
                const SizedBox(height: MorganSpace.xxs),
                Icon(Icons.chevron_right_rounded, color: p.textMuted, size: 20),
              ],
            ),
          ],
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
