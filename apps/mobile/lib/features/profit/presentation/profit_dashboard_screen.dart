import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/profit/profit_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_metric_card.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_surface.dart';
import 'margin_trend_chart.dart';
import 'margin_drivers_sheet.dart';
import 'profit_leaks_section.dart';
import 'pricing_suggestions_section.dart';
import 'revenue_forecast_section.dart';
import 'profit_day_summary_sheet.dart';
import '../widgets/margin_target_progress.dart';

class ProfitDashboardScreen extends ConsumerWidget {
  const ProfitDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final overviewAsync = ref.watch(profitOverviewProvider);
    final rankingAsync = ref.watch(profitSkuRankingProvider);

    return Scaffold(
      backgroundColor: p.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.only(bottom: MorganSpace.huge),
          children: [
            overviewAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(MorganSpace.screenH),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (_, __) => Padding(
                padding: const EdgeInsets.all(MorganSpace.screenH),
                child: Text('Could not load profit overview.', style: theme.textTheme.bodyMedium),
              ),
              data: (overview) {
                if (overview == null) {
                  return const MorganScreenHeader(
                    title: 'Profit Overview',
                    subtitle: 'Contribution margin and SKU economics',
                  );
                }

                final deltaTrend = overview.marginDeltaPct == null
                    ? null
                    : overview.marginDeltaPct! >= 0
                        ? MetricTrend.up
                        : MetricTrend.down;

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    MorganScreenHeader(
                      title: 'Profit Overview',
                      subtitle: 'Trailing ${overview.windowDays} days through ${overview.referenceDay}',
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
                                  label: 'Contribution margin',
                                  value: formatMarginPct(overview.currentMarginPct),
                                  delta: formatMarginDelta(overview.marginDeltaPct),
                                  trend: deltaTrend,
                                  subtitle: 'Target ${overview.targetMarginPct.toStringAsFixed(0)}%',
                                  onTap: () => MarginDriversSheet.show(
                                    context,
                                    windowDays: overview.windowDays,
                                  ),
                                ),
                              ),
                              if (overview.belowTarget) ...[
                                const SizedBox(width: MorganSpace.sm),
                                _BelowTargetBadge(targetMarginPct: overview.targetMarginPct),
                              ],
                            ],
                          ),
                          const SizedBox(height: MorganSpace.sm),
                          MarginTargetProgress(
                            currentMarginPct: overview.currentMarginPct,
                            targetMarginPct: overview.targetMarginPct,
                            belowTarget: overview.belowTarget,
                          ),
                          const SizedBox(height: MorganSpace.sm),
                          MorganMetricCard(
                            label: 'Active profit leaks',
                            value: overview.activeLeakCount.toString(),
                            subtitle: overview.amountAtRiskUsd > 0
                                ? '\$${overview.amountAtRiskUsd} at risk'
                                : 'Scanned daily after mart refresh',
                            onTap: () {},
                          ),
                          const SizedBox(height: MorganSpace.lg),
                          MorganSurface(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('30-DAY MARGIN TREND', style: theme.textTheme.labelMedium),
                                const SizedBox(height: MorganSpace.md),
                                MarginTrendChart(
                                  points: overview.trend,
                                  targetMarginPct: overview.targetMarginPct,
                                  onPointSelected: (point) => ProfitDaySummarySheet.show(context, point.day),
                                ),
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
            const SizedBox(height: MorganSpace.xl),
            const RevenueForecastSection(),
            const SizedBox(height: MorganSpace.xl),
            const PricingSuggestionsSection(),
            const SizedBox(height: MorganSpace.xl),
            const ProfitLeaksSection(),
            const SizedBox(height: MorganSpace.xl),
            rankingAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (_, __) => Padding(
                padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                child: Text('Could not load SKU profit data.', style: theme.textTheme.bodyMedium),
              ),
              data: (response) {
                if (response == null || response.skus.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const MorganSectionHeader(title: 'Profit by SKU'),
                        Text(
                          'SKU economics appear after order history is synced and warehouse marts refresh.',
                          style: theme.textTheme.bodyMedium,
                        ),
                      ],
                    ),
                  );
                }

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const MorganSectionHeader(title: 'Profit by SKU'),
                          Text(
                            'Trailing ${response.windowDays} days · ranked by contribution profit',
                            style: theme.textTheme.bodySmall,
                          ),
                          const SizedBox(height: MorganSpace.sm),
                          Column(
                            children: response.skus.map((sku) {
                              return Padding(
                                padding: const EdgeInsets.only(bottom: MorganSpace.sm),
                                child: _SkuRankingTile(
                                  sku: sku,
                                  onTap: () => context.push('/profit/sku/${Uri.encodeComponent(sku.sku)}'),
                                ),
                              );
                            }).toList(),
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _BelowTargetBadge extends StatelessWidget {
  const _BelowTargetBadge({required this.targetMarginPct});

  final double targetMarginPct;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: MorganSpace.sm, vertical: MorganSpace.sm),
      decoration: BoxDecoration(
        color: p.warning.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(MorganRadius.sm),
        border: Border.all(color: p.warning.withValues(alpha: 0.35)),
      ),
      child: Column(
        children: [
          Icon(Icons.warning_amber_rounded, color: p.warning, size: 20),
          const SizedBox(height: MorganSpace.xxs),
          Text(
            'Below\n${targetMarginPct.toStringAsFixed(0)}%',
            textAlign: TextAlign.center,
            style: theme.textTheme.labelSmall?.copyWith(color: p.warning),
          ),
        ],
      ),
    );
  }
}

class _SkuRankingTile extends StatelessWidget {
  const _SkuRankingTile({required this.sku, required this.onTap});

  final SkuProfitSummary sku;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final marginColor = sku.contributionMargin >= 0 ? p.profit : p.loss;

    return GestureDetector(
      onTap: onTap,
      child: MorganSurface(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(sku.sku, style: theme.textTheme.titleSmall),
                ),
                if (sku.lowConfidence)
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
              ],
            ),
            const SizedBox(height: MorganSpace.xs),
            Text(
              formatProfitCurrency(sku.contributionMargin),
              style: theme.textTheme.headlineSmall?.copyWith(color: marginColor),
            ),
            const SizedBox(height: MorganSpace.xxs),
            Text(
              '${sku.ordersCount} orders · ${formatVelocity(sku.velocityPerDay)} · ${formatReturnRate(sku.returnRate)} returns',
              style: theme.textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}
