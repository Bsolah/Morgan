import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/inventory/inventory_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_empty_state.dart';
import '../../../shared/widgets/morgan_error_state.dart';
import '../../../shared/widgets/morgan_metric_card.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_skeleton.dart';
import '../../../shared/widgets/morgan_surface.dart';

enum _InventorySortMode { risk, revenue }

class InventoryOverviewScreen extends ConsumerStatefulWidget {
  const InventoryOverviewScreen({super.key});

  @override
  ConsumerState<InventoryOverviewScreen> createState() => _InventoryOverviewScreenState();
}

class _InventoryOverviewScreenState extends ConsumerState<InventoryOverviewScreen> {
  _InventorySortMode _sortMode = _InventorySortMode.risk;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final healthAsync = ref.watch(inventoryHealthProvider);

    return Scaffold(
      backgroundColor: p.background,
      body: SafeArea(
        child: healthAsync.when(
          loading: () => ListView(
            padding: const EdgeInsets.all(MorganSpace.screenH),
            children: const [MorganProfitSectionSkeleton(cardCount: 3)],
          ),
          error: (error, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(MorganSpace.screenH),
              child: MorganErrorState(
                error: error,
                fallbackMessage: 'Could not load inventory health.',
                onRetry: () => ref.invalidate(inventoryHealthProvider),
              ),
            ),
          ),
          data: (health) {
            if (health == null) {
              return Center(child: Text('Inventory data unavailable.', style: theme.textTheme.bodyMedium));
            }

            final sortedSkus = _sortMode == _InventorySortMode.risk
                ? sortInventorySkusByRisk(health.skus)
                : sortInventorySkusByRevenue(health.skus);

            return ListView(
              padding: const EdgeInsets.only(bottom: MorganSpace.huge),
              children: [
                MorganDetailScreenHeader(
                  title: 'Inventory',
                  subtitle: 'Trailing ${health.windowDays} days · stockout risk at a glance',
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
                              label: 'SKUs at risk',
                              value: '${health.stockoutRiskCount}',
                              subtitle: 'Under 14 days of cover',
                            ),
                          ),
                          const SizedBox(width: MorganSpace.sm),
                          Expanded(
                            child: MorganMetricCard(
                              label: 'Total SKUs',
                              value: '${health.totalSkuCount}',
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: MorganSpace.sm),
                      MorganMetricCard(
                        label: 'Avg days of cover',
                        value: health.avgDaysOfCover == null
                            ? '—'
                            : formatDaysOfStock(health.avgDaysOfCover),
                        subtitle: 'Across active catalog SKUs',
                      ),
                      const SizedBox(height: MorganSpace.xl),
                      Row(
                        children: [
                          const Expanded(child: MorganSectionHeader(title: 'SKU list')),
                          SegmentedButton<_InventorySortMode>(
                            segments: const [
                              ButtonSegment(value: _InventorySortMode.risk, label: Text('Risk')),
                              ButtonSegment(value: _InventorySortMode.revenue, label: Text('Revenue')),
                            ],
                            selected: {_sortMode},
                            onSelectionChanged: (selection) {
                              setState(() => _sortMode = selection.first);
                            },
                          ),
                        ],
                      ),
                      Text(
                        _sortMode == _InventorySortMode.risk
                            ? 'Sorted by stockout risk, then fewest days of cover.'
                            : 'Sorted by trailing gross revenue.',
                        style: theme.textTheme.labelSmall,
                      ),
                      const SizedBox(height: MorganSpace.sm),
                      if (sortedSkus.isEmpty)
                        const MorganEmptyState(
                          icon: Icons.inventory_2_outlined,
                          title: 'No SKUs to show yet',
                          message:
                              'Product catalog and sales history populate this list after sync.',
                          compact: true,
                          centered: false,
                        )
                      else
                        MorganSurface(
                          padding: EdgeInsets.zero,
                          child: Column(
                            children: [
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: MorganSpace.card,
                                  vertical: MorganSpace.sm,
                                ),
                                child: Row(
                                  children: [
                                    Expanded(flex: 3, child: Text('SKU', style: theme.textTheme.labelSmall)),
                                    Expanded(
                                      child: Text(
                                        'Days',
                                        style: theme.textTheme.labelSmall,
                                        textAlign: TextAlign.end,
                                      ),
                                    ),
                                    Expanded(
                                      child: Text(
                                        'Velocity',
                                        style: theme.textTheme.labelSmall,
                                        textAlign: TextAlign.end,
                                      ),
                                    ),
                                    const SizedBox(width: 18),
                                  ],
                                ),
                              ),
                              Divider(height: 1, color: p.borderSubtle),
                              ...sortedSkus.map((sku) {
                                final isLast = sku == sortedSkus.last;
                                return Column(
                                  children: [
                                    _InventorySkuRow(
                                      sku: sku,
                                      onTap: () =>
                                          context.push('/inventory/sku/${Uri.encodeComponent(sku.sku)}'),
                                    ),
                                    if (!isLast)
                                      Divider(height: 1, color: p.borderSubtle, indent: MorganSpace.card),
                                  ],
                                );
                              }),
                            ],
                          ),
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

class _InventorySkuRow extends StatelessWidget {
  const _InventorySkuRow({required this.sku, required this.onTap});

  final InventorySkuHealth sku;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final statusColor = _healthColor(p, sku.healthStatus);

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: MorganSpace.card,
          vertical: MorganSpace.sm,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              flex: 3,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    sku.sku,
                    style: theme.textTheme.titleSmall,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (sku.lowConfidence) ...[
                    const SizedBox(height: MorganSpace.xxs),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: MorganSpace.xs,
                        vertical: MorganSpace.xxs,
                      ),
                      decoration: BoxDecoration(
                        color: p.warning.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(MorganRadius.xs),
                      ),
                      child: Text(
                        'Low confidence',
                        style: theme.textTheme.labelSmall?.copyWith(color: p.warning),
                      ),
                    ),
                  ] else if (sku.stockoutRisk) ...[
                    const SizedBox(height: MorganSpace.xxs),
                    Text(
                      'Stockout risk',
                      style: theme.textTheme.labelSmall?.copyWith(color: statusColor),
                    ),
                  ],
                ],
              ),
            ),
            Expanded(
              child: Text(
                formatDaysOfStock(sku.daysOfStock),
                style: theme.textTheme.titleSmall?.copyWith(color: statusColor),
                textAlign: TextAlign.end,
              ),
            ),
            Expanded(
              child: Text(
                '${sku.velocityPerDay.toStringAsFixed(1)}/d',
                style: theme.textTheme.bodySmall,
                textAlign: TextAlign.end,
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: p.textMuted, size: 18),
          ],
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
