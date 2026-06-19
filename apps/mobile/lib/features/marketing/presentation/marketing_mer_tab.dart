import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/marketing/marketing_repository.dart';
import '../../../core/metrics/metrics_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_metric_card.dart';
import '../../../shared/widgets/morgan_surface.dart';
import '../widgets/mer_trend_chart.dart';

class MarketingMerTab extends ConsumerWidget {
  const MarketingMerTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final merAsync = ref.watch(marketingMerProvider);
    final money = NumberFormat.compactCurrency(symbol: '\$');

    return merAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, __) => Text('Could not load MER data.', style: theme.textTheme.bodySmall),
      data: (mer) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _MetricWithTooltip(
              label: 'Blended MER',
              value: formatMerRatio(mer.blendedMer),
              tooltip: mer.merTooltip,
            ),
            const SizedBox(height: MorganSpace.sm),
            MorganMetricCard(
              label: 'Net revenue',
              value: NumberFormat.simpleCurrency().format(mer.netRevenue),
              subtitle: 'Trailing ${mer.windowDays} days',
            ),
            const SizedBox(height: MorganSpace.xl),
            Text('CHANNEL SPLIT', style: theme.textTheme.labelMedium),
            const SizedBox(height: MorganSpace.sm),
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
                        Expanded(flex: 2, child: Text('Channel', style: theme.textTheme.labelSmall)),
                        Expanded(
                          child: Text('Spend', style: theme.textTheme.labelSmall, textAlign: TextAlign.end),
                        ),
                        Expanded(
                          child: Text('MER', style: theme.textTheme.labelSmall, textAlign: TextAlign.end),
                        ),
                      ],
                    ),
                  ),
                  Divider(height: 1, color: p.borderSubtle),
                  ...mer.channels.map((channel) {
                    final isLast = channel == mer.channels.last;
                    return Column(
                      children: [
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: MorganSpace.card,
                            vertical: MorganSpace.sm,
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                flex: 2,
                                child: Text(channel.label, style: theme.textTheme.titleSmall),
                              ),
                              Expanded(
                                child: Text(
                                  money.format(channel.adSpend),
                                  style: theme.textTheme.bodySmall,
                                  textAlign: TextAlign.end,
                                ),
                              ),
                              Expanded(
                                child: Text(
                                  formatMerRatio(channel.mer),
                                  style: theme.textTheme.titleSmall,
                                  textAlign: TextAlign.end,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (!isLast) Divider(height: 1, color: p.borderSubtle, indent: MorganSpace.card),
                      ],
                    );
                  }),
                ],
              ),
            ),
            const SizedBox(height: MorganSpace.xl),
            Text('${mer.trendDays}-DAY MER TREND', style: theme.textTheme.labelMedium),
            const SizedBox(height: MorganSpace.sm),
            MorganSurface(
              child: MerTrendChart(points: mer.trend, trendDays: mer.trendDays),
            ),
          ],
        );
      },
    );
  }
}

class _MetricWithTooltip extends StatelessWidget {
  const _MetricWithTooltip({
    required this.label,
    required this.value,
    required this.tooltip,
  });

  final String label;
  final String value;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return MorganSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(label.toUpperCase(), style: theme.textTheme.labelMedium),
              const SizedBox(width: MorganSpace.xxs),
              Tooltip(
                message: tooltip,
                triggerMode: TooltipTriggerMode.tap,
                child: Icon(Icons.info_outline, size: 16, color: p.textMuted),
              ),
            ],
          ),
          const SizedBox(height: MorganSpace.sm),
          Text(value, style: theme.textTheme.headlineMedium),
        ],
      ),
    );
  }
}
