import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/cash/cash_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';

class CashFlowChart extends StatefulWidget {
  const CashFlowChart({
    super.key,
    required this.points,
    required this.windowDays,
  });

  final List<CashFlowPoint> points;
  final int windowDays;

  @override
  State<CashFlowChart> createState() => _CashFlowChartState();
}

class _CashFlowChartState extends State<CashFlowChart> {
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

    if (widget.points.every((point) => point.inflowsUsd == 0 && point.outflowsUsd == 0)) {
      return SizedBox(
        height: 180,
        child: Center(
          child: Text(
            'Cash flow appears after bank transactions sync.',
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
              'In ${money.format(selected.inflowsUsd)} · Out ${money.format(selected.outflowsUsd)}',
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
                  painter: _CashFlowPainter(
                    points: widget.points,
                    selectedIndex: _selectedIndex,
                    inflowColor: p.profit,
                    outflowColor: p.loss,
                    mutedColor: p.textMuted,
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: MorganSpace.sm),
        Row(
          children: [
            _LegendDot(color: p.profit, label: 'Inflows'),
            const SizedBox(width: MorganSpace.md),
            _LegendDot(color: p.loss, label: 'Outflows'),
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
      children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: MorganSpace.xxs),
        Text(label, style: theme.textTheme.labelSmall),
      ],
    );
  }
}

class _CashFlowPainter extends CustomPainter {
  _CashFlowPainter({
    required this.points,
    required this.selectedIndex,
    required this.inflowColor,
    required this.outflowColor,
    required this.mutedColor,
  });

  final List<CashFlowPoint> points;
  final int? selectedIndex;
  final Color inflowColor;
  final Color outflowColor;
  final Color mutedColor;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.isEmpty) return;

    const padding = MorganSpace.md;
    final chartWidth = size.width - padding * 2;
    final chartHeight = size.height - padding * 2;
    final maxValue = points.fold<double>(0, (max, point) {
      final dayMax = point.inflowsUsd > point.outflowsUsd ? point.inflowsUsd : point.outflowsUsd;
      return dayMax > max ? dayMax : max;
    }).clamp(1, double.infinity);

    final barGroupWidth = chartWidth / points.length;
    final barWidth = barGroupWidth * 0.28;

    for (var index = 0; index < points.length; index++) {
      final point = points[index];
      final centerX = padding + barGroupWidth * index + barGroupWidth / 2;
      final inflowHeight = (point.inflowsUsd / maxValue) * chartHeight;
      final outflowHeight = (point.outflowsUsd / maxValue) * chartHeight;

      final inflowPaint = Paint()..color = inflowColor.withValues(alpha: selectedIndex == index ? 1 : 0.75);
      final outflowPaint = Paint()..color = outflowColor.withValues(alpha: selectedIndex == index ? 1 : 0.75);

      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(centerX - barWidth - 1, padding + chartHeight - inflowHeight, barWidth, inflowHeight),
          const Radius.circular(2),
        ),
        inflowPaint,
      );

      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(centerX + 1, padding + chartHeight - outflowHeight, barWidth, outflowHeight),
          const Radius.circular(2),
        ),
        outflowPaint,
      );
    }

    final axisPaint = Paint()
      ..color = mutedColor.withValues(alpha: 0.25)
      ..strokeWidth = 1;
    canvas.drawLine(
      Offset(padding, padding + chartHeight),
      Offset(size.width - padding, padding + chartHeight),
      axisPaint,
    );
  }

  @override
  bool shouldRepaint(covariant _CashFlowPainter oldDelegate) {
    return oldDelegate.points != points || oldDelegate.selectedIndex != selectedIndex;
  }
}
