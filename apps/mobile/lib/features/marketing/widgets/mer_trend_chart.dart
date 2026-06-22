import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/marketing/marketing_repository.dart';
import '../../../core/metrics/metrics_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_chart_frame.dart';

class MerTrendChart extends StatefulWidget {
  const MerTrendChart({
    super.key,
    required this.points,
    required this.trendDays,
  });

  final List<MerTrendPoint> points;
  final int trendDays;

  @override
  State<MerTrendChart> createState() => _MerTrendChartState();
}

class _MerTrendChartState extends State<MerTrendChart> {
  int? _selectedIndex;

  void _handleTap(Offset localPosition, Size size) {
    if (widget.points.isEmpty) return;

    final chartWidth = size.width - MorganSpace.md * 2;
    final step = chartWidth / (widget.points.length - 1).clamp(1, 999);
    final index = ((localPosition.dx - MorganSpace.md) / step).round().clamp(0, widget.points.length - 1);

    setState(() => _selectedIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final money = NumberFormat.compactCurrency(symbol: '\$');

    if (widget.points.every((point) => point.adSpend == 0 && point.netRevenue == 0)) {
      return SizedBox(
        height: 180,
        child: Center(
          child: Text(
            'MER trend appears after ad spend and revenue sync.',
            style: theme.textTheme.bodySmall,
          ),
        ),
      );
    }

    final selected = _selectedIndex != null ? widget.points[_selectedIndex!] : null;
    final summary = selected != null
        ? '${DateFormat('MMM d').format(DateTime.parse('${selected.day}T12:00:00Z'))} · '
            'MER ${formatMerRatio(selected.mer)} · Spend ${money.format(selected.adSpend)}'
        : _defaultSummary(money);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        MorganChartFrame(
          summary: summary,
          chart: SizedBox(
            height: 180,
            width: double.infinity,
            child: LayoutBuilder(
              builder: (context, constraints) {
                return GestureDetector(
                  onTapDown: (details) => _handleTap(details.localPosition, constraints.biggest),
                  child: CustomPaint(
                    size: constraints.biggest,
                    painter: _MerTrendPainter(
                      points: widget.points,
                      selectedIndex: _selectedIndex,
                      spendColor: p.textMuted,
                      merColor: p.accent,
                    ),
                  ),
                );
              },
            ),
          ),
        ),
        const SizedBox(height: MorganSpace.sm),
        Row(
          children: [
            _LegendDot(color: p.textMuted, label: 'Spend'),
            const SizedBox(width: MorganSpace.md),
            _LegendDot(color: p.accent, label: 'MER'),
          ],
        ),
      ],
    );
  }

  String _defaultSummary(NumberFormat money) {
    if (widget.points.isEmpty) {
      return '7-day MER trend. No data yet.';
    }
    final last = widget.points.last;
    final day = DateFormat('MMM d').format(DateTime.parse('${last.day}T12:00:00Z'));
    return '7-day MER trend through $day. Latest MER ${formatMerRatio(last.mer)}, '
        'ad spend ${money.format(last.adSpend)}. Tap the chart to inspect each day.';
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: MorganSpace.xxs),
        Text(label, style: theme.textTheme.labelSmall),
      ],
    );
  }
}

class _MerTrendPainter extends CustomPainter {
  _MerTrendPainter({
    required this.points,
    required this.selectedIndex,
    required this.spendColor,
    required this.merColor,
  });

  final List<MerTrendPoint> points;
  final int? selectedIndex;
  final Color spendColor;
  final Color merColor;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.isEmpty) return;

    const padding = MorganSpace.md;
    final chartWidth = size.width - padding * 2;
    final chartHeight = size.height - padding * 2;
    final maxSpend = points.map((point) => point.adSpend).reduce((a, b) => a > b ? a : b).clamp(1, double.infinity);
    final maxMer = points
        .where((point) => point.mer != null)
        .map((point) => point.mer!)
        .fold<double>(0.25, (max, value) => value > max ? value : max)
        .clamp(0.05, double.infinity);

    final barWidth = chartWidth / points.length * 0.6;
    final step = chartWidth / (points.length - 1).clamp(1, 999);

    for (var index = 0; index < points.length; index++) {
      final point = points[index];
      final x = padding + index * step;
      final barHeight = (point.adSpend / maxSpend) * chartHeight * 0.45;
      final barRect = Rect.fromLTWH(x - barWidth / 2, padding + chartHeight - barHeight, barWidth, barHeight);
      canvas.drawRect(barRect, Paint()..color = spendColor.withValues(alpha: 0.35));

      if (point.mer != null) {
        final merY = padding + chartHeight - (point.mer!.clamp(0, maxMer) / maxMer) * chartHeight;
        final merPaint = Paint()
          ..color = merColor
          ..strokeWidth = 2
          ..style = PaintingStyle.stroke;

        if (index > 0 && points[index - 1].mer != null) {
          final prevX = padding + (index - 1) * step;
          final prevY = padding +
              chartHeight -
              (points[index - 1].mer!.clamp(0, maxMer) / maxMer) * chartHeight;
          canvas.drawLine(Offset(prevX, prevY), Offset(x, merY), merPaint);
        }

        canvas.drawCircle(Offset(x, merY), 3, Paint()..color = merColor);
      }

      if (selectedIndex == index) {
        canvas.drawLine(
          Offset(x, padding),
          Offset(x, padding + chartHeight),
          Paint()
            ..color = spendColor.withValues(alpha: 0.4)
            ..strokeWidth = 1,
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant _MerTrendPainter oldDelegate) {
    return oldDelegate.points != points || oldDelegate.selectedIndex != selectedIndex;
  }
}
