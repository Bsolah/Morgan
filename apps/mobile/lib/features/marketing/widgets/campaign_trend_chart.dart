import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/marketing/marketing_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';

class CampaignTrendChart extends StatefulWidget {
  const CampaignTrendChart({
    super.key,
    required this.points,
    required this.trendDays,
  });

  final List<CampaignTrendPoint> points;
  final int trendDays;

  @override
  State<CampaignTrendChart> createState() => _CampaignTrendChartState();
}

class _CampaignTrendChartState extends State<CampaignTrendChart> {
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

    if (widget.points.every((point) => point.adSpend == 0)) {
      return SizedBox(
        height: 180,
        child: Center(
          child: Text(
            'Spend trend appears after campaign data syncs.',
            style: theme.textTheme.bodySmall,
          ),
        ),
      );
    }

    final selected = _selectedIndex != null ? widget.points[_selectedIndex!] : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (selected != null)
          Padding(
            padding: const EdgeInsets.only(bottom: MorganSpace.sm),
            child: Text(
              '${DateFormat('MMM d').format(DateTime.parse('${selected.day}T12:00:00Z'))} · '
              'Spend ${money.format(selected.adSpend)} · POAS ${formatMarketingRatio(selected.poas)}',
              style: theme.textTheme.labelMedium?.copyWith(color: p.accent),
            ),
          ),
        SizedBox(
          height: 180,
          width: double.infinity,
          child: LayoutBuilder(
            builder: (context, constraints) {
              return GestureDetector(
                onTapDown: (details) => _handleTap(details.localPosition, constraints.biggest),
                child: CustomPaint(
                  size: constraints.biggest,
                  painter: _CampaignTrendPainter(
                    points: widget.points,
                    selectedIndex: _selectedIndex,
                    spendColor: p.textMuted,
                    poasColor: p.accent,
                    poasThresholdColor: p.loss,
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: MorganSpace.sm),
        Row(
          children: [
            _LegendDot(color: p.textMuted, label: 'Spend'),
            const SizedBox(width: MorganSpace.md),
            _LegendDot(color: p.accent, label: 'POAS'),
          ],
        ),
      ],
    );
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

class _CampaignTrendPainter extends CustomPainter {
  _CampaignTrendPainter({
    required this.points,
    required this.selectedIndex,
    required this.spendColor,
    required this.poasColor,
    required this.poasThresholdColor,
  });

  final List<CampaignTrendPoint> points;
  final int? selectedIndex;
  final Color spendColor;
  final Color poasColor;
  final Color poasThresholdColor;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.isEmpty) return;

    const padding = MorganSpace.md;
    final chartWidth = size.width - padding * 2;
    final chartHeight = size.height - padding * 2;
    final maxSpend = points.map((point) => point.adSpend).reduce((a, b) => a > b ? a : b).clamp(1, double.infinity);
    final maxPoas = points
        .where((point) => point.poas != null)
        .map((point) => point.poas!)
        .fold<double>(1, (max, value) => value > max ? value : max)
        .clamp(1, double.infinity);

    final barWidth = chartWidth / points.length * 0.6;
    final step = chartWidth / (points.length - 1).clamp(1, 999);

    for (var index = 0; index < points.length; index++) {
      final point = points[index];
      final x = padding + index * step;
      final barHeight = (point.adSpend / maxSpend) * chartHeight * 0.45;
      final barRect = Rect.fromLTWH(x - barWidth / 2, padding + chartHeight - barHeight, barWidth, barHeight);
      canvas.drawRect(barRect, Paint()..color = spendColor.withValues(alpha: 0.35));

      if (point.poas != null) {
        final poasY = padding + chartHeight - (point.poas!.clamp(0, maxPoas) / maxPoas) * chartHeight;
        final poasPaint = Paint()
          ..color = point.poas! < 1 ? poasThresholdColor : poasColor
          ..strokeWidth = 2
          ..style = PaintingStyle.stroke;

        if (index > 0 && points[index - 1].poas != null) {
          final prevX = padding + (index - 1) * step;
          final prevY = padding +
              chartHeight -
              (points[index - 1].poas!.clamp(0, maxPoas) / maxPoas) * chartHeight;
          canvas.drawLine(Offset(prevX, prevY), Offset(x, poasY), poasPaint);
        }

        canvas.drawCircle(Offset(x, poasY), 3, Paint()..color = poasPaint.color);
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

    final thresholdY = padding + chartHeight - (1 / maxPoas) * chartHeight;
    canvas.drawLine(
      Offset(padding, thresholdY),
      Offset(padding + chartWidth, thresholdY),
      Paint()
        ..color = poasThresholdColor.withValues(alpha: 0.35)
        ..strokeWidth = 1,
    );
  }

  @override
  bool shouldRepaint(covariant _CampaignTrendPainter oldDelegate) {
    return oldDelegate.points != points || oldDelegate.selectedIndex != selectedIndex;
  }
}
