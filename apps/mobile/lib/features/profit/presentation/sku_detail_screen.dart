import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/profit/profit_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_metric_card.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_surface.dart';

class SkuDetailScreen extends ConsumerWidget {
  const SkuDetailScreen({super.key, required this.sku});

  final String sku;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final detail = ref.watch(profitSkuDetailProvider(sku));

    return Scaffold(
      backgroundColor: p.background,
      appBar: AppBar(
        backgroundColor: p.background,
        title: Text(sku),
      ),
      body: SafeArea(
        child: detail.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) => Center(
            child: Text('Could not load SKU detail.', style: theme.textTheme.bodyMedium),
          ),
          data: (response) {
            if (response == null) {
              return Center(
                child: Text('SKU not found.', style: theme.textTheme.bodyMedium),
              );
            }

            final summary = response.summary;

            return ListView(
              padding: const EdgeInsets.fromLTRB(
                MorganSpace.screenH,
                MorganSpace.md,
                MorganSpace.screenH,
                MorganSpace.huge,
              ),
              children: [
                if (summary.lowConfidence)
                  Padding(
                    padding: const EdgeInsets.only(bottom: MorganSpace.sm),
                    child: Text(
                      'Low confidence: fewer than 30 orders in the last ${response.windowDays} days.',
                      style: theme.textTheme.bodySmall?.copyWith(color: p.warning),
                    ),
                  ),
                Row(
                  children: [
                    Expanded(
                      child: MorganMetricCard(
                        label: 'Contribution profit',
                        value: formatProfitCurrency(summary.contributionMargin),
                        subtitle: 'Trailing ${response.windowDays} days',
                      ),
                    ),
                    const SizedBox(width: MorganSpace.sm),
                    Expanded(
                      child: MorganMetricCard(
                        label: 'Unit margin',
                        value: formatProfitCurrency(summary.unitMargin),
                        subtitle: '${summary.unitsSold} units sold',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: MorganSpace.sm),
                Row(
                  children: [
                    Expanded(
                      child: MorganMetricCard(
                        label: 'Return rate',
                        value: formatReturnRate(summary.returnRate),
                        subtitle: '${summary.ordersCount} orders',
                      ),
                    ),
                    const SizedBox(width: MorganSpace.sm),
                    Expanded(
                      child: MorganMetricCard(
                        label: 'Ad spend',
                        value: formatProfitCurrency(summary.attributedAdSpend),
                        subtitle: 'Revenue-weighted share',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: MorganSpace.xl),
                const MorganSectionHeader(title: 'Margin trend'),
                const SizedBox(height: MorganSpace.sm),
                if (response.weeklyTrend.isEmpty)
                  Text('No weekly history yet.', style: theme.textTheme.bodySmall)
                else
                  ...response.weeklyTrend.map(
                    (point) => Padding(
                      padding: const EdgeInsets.only(bottom: MorganSpace.sm),
                      child: MorganSurface(
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                DateFormat('MMM d').format(DateTime.parse(point.weekStart)),
                                style: theme.textTheme.titleSmall,
                              ),
                            ),
                            Text(
                              formatProfitCurrency(point.contributionMargin),
                              style: theme.textTheme.titleSmall?.copyWith(
                                color: point.contributionMargin >= 0 ? p.profit : p.loss,
                              ),
                            ),
                          ],
                        ),
                      ),
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
