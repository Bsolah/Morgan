import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/profit/profit_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_detail_app_bar.dart';
import '../../../shared/widgets/morgan_metric_card.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
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
      appBar: MorganDetailAppBar(title: sku, fallbackRoute: '/profit'),
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
            final marginPct = summary.grossRevenue > 0
                ? (summary.contributionMargin / summary.grossRevenue) * 100
                : null;
            final marginColor = marginPct == null
                ? p.textMuted
                : marginPct >= 40
                    ? p.profit
                    : marginPct >= 25
                        ? p.warning
                        : p.loss;

            return ListView(
              padding: const EdgeInsets.fromLTRB(
                MorganSpace.screenH,
                MorganSpace.md,
                MorganSpace.screenH,
                MorganSpace.huge,
              ),
              children: [
                MorganSurface(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('UNIT MARGIN', style: theme.textTheme.labelMedium),
                      const SizedBox(height: MorganSpace.sm),
                      Text(
                        marginPct != null ? '${marginPct.toStringAsFixed(1)}%' : '—',
                        style: theme.textTheme.displaySmall?.copyWith(color: marginColor),
                      ),
                      const SizedBox(height: MorganSpace.xxs),
                      Text(
                        formatProfitCurrency(summary.unitMargin),
                        style: theme.textTheme.titleMedium,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: MorganSpace.md),
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
                        label: 'Velocity',
                        value: formatVelocity(summary.velocityPerDay),
                        subtitle: 'Units per day',
                      ),
                    ),
                    const SizedBox(width: MorganSpace.sm),
                    Expanded(
                      child: MorganMetricCard(
                        label: 'Return rate',
                        value: formatReturnRate(summary.returnRate),
                        subtitle: '${summary.ordersCount} orders',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: MorganSpace.sm),
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
                  MorganSurface(
                    child: Text('No weekly history yet.', style: theme.textTheme.bodySmall),
                  )
                else
                  MorganSurface(
                    child: SizedBox(
                      height: 48,
                      child: _SkuMarginSparkline(
                        values: response.weeklyTrend.map((point) => point.contributionMargin).toList(),
                      ),
                    ),
                  ),
                const SizedBox(height: MorganSpace.lg),
                MorganPrimaryButton(
                  label: 'Model price change',
                  onPressed: () => context.push('/scenarios?sku=${Uri.encodeComponent(sku)}'),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _SkuMarginSparkline extends StatelessWidget {
  const _SkuMarginSparkline({required this.values});

  final List<double> values;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;

    return CustomPaint(
      painter: _SparklinePainter(
        values: values,
        lineColor: p.accent,
        dotColor: p.profit,
      ),
      child: const SizedBox.expand(),
    );
  }
}

class _SparklinePainter extends CustomPainter {
  _SparklinePainter({
    required this.values,
    required this.lineColor,
    required this.dotColor,
  });

  final List<double> values;
  final Color lineColor;
  final Color dotColor;

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) return;

    final min = values.reduce((a, b) => a < b ? a : b);
    final max = values.reduce((a, b) => a > b ? a : b);
    final range = max - min == 0 ? 1.0 : max - min;

    final path = Path();
    for (var i = 0; i < values.length; i++) {
      final x = size.width * i / (values.length - 1);
      final y = size.height - ((values[i] - min) / range) * size.height;
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }

    canvas.drawPath(
      path,
      Paint()
        ..color = lineColor
        ..strokeWidth = 2.5
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round,
    );

    if (values.isNotEmpty) {
      final lastX = size.width * (values.length - 1) / (values.length - 1);
      final lastY = size.height - ((values.last - min) / range) * size.height;
      canvas.drawCircle(Offset(lastX, lastY), 3, Paint()..color = dotColor);
    }
  }

  @override
  bool shouldRepaint(covariant _SparklinePainter oldDelegate) =>
      oldDelegate.values != values ||
      oldDelegate.lineColor != lineColor ||
      oldDelegate.dotColor != dotColor;
}
