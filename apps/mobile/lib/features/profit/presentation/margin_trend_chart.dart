import 'package:flutter/material.dart';
import 'package:intl/intl.dart' hide TextDirection;

import '../../../core/profit/profit_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_chart_frame.dart';

class MarginTrendChart extends StatefulWidget {
  const MarginTrendChart({
    super.key,
    required this.points,
    required this.targetMarginPct,
    required this.onPointSelected,
  });

  final List<DailyMarginTrendPoint> points;
  final double targetMarginPct;
  final ValueChanged<DailyMarginTrendPoint> onPointSelected;

  @override
  State<MarginTrendChart> createState() => _MarginTrendChartState();
}

class _MarginTrendChartState extends State<MarginTrendChart> {
  int? _selectedIndex;

  void _handleTap(Offset localPosition, Size size) {
    if (widget.points.isEmpty) return;

    final chartWidth = size.width - MorganSpace.md * 2;
    final step = chartWidth / (widget.points.length - 1).clamp(1, 999);
    final index = ((localPosition.dx - MorganSpace.md) / step).round().clamp(0, widget.points.length - 1);

    setState(() => _selectedIndex = index);
    widget.onPointSelected(widget.points[index]);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final validPoints = widget.points.where((point) => point.marginPct != null).toList();

    if (validPoints.isEmpty) {
      return SizedBox(
        height: 180,
        child: Center(
          child: Text('Margin trend appears after order history syncs.', style: theme.textTheme.bodySmall),
        ),
      );
    }

    final selected = _selectedIndex != null ? widget.points[_selectedIndex!] : null;
    final summary = selected != null && selected.marginPct != null
        ? '${DateFormat('MMM d').format(DateTime.parse('${selected.day}T12:00:00Z'))} · ${formatMarginPct(selected.marginPct)}'
        : _defaultSummary(validPoints);

    return MorganChartFrame(
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
                painter: _MarginTrendPainter(
                  points: widget.points,
                  targetMarginPct: widget.targetMarginPct,
                  selectedIndex: _selectedIndex,
                  profitColor: p.profit,
                  accentColor: p.accent,
                  warningColor: p.warning,
                  borderColor: p.borderSubtle,
                  textMuted: p.textMuted,
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  String _defaultSummary(List<DailyMarginTrendPoint> validPoints) {
    if (validPoints.isEmpty) {
      return 'Margin trend. Target ${widget.targetMarginPct.toStringAsFixed(0)}%. No data yet.';
    }
    final last = validPoints.last;
    final day = DateFormat('MMM d').format(DateTime.parse('${last.day}T12:00:00Z'));
    return 'Margin trend through $day. Latest margin ${formatMarginPct(last.marginPct)}, '
        'target ${widget.targetMarginPct.toStringAsFixed(0)}%. Tap the chart to inspect each day.';
  }
}

class _MarginTrendPainter extends CustomPainter {
  _MarginTrendPainter({
    required this.points,
    required this.targetMarginPct,
    required this.selectedIndex,
    required this.profitColor,
    required this.accentColor,
    required this.warningColor,
    required this.borderColor,
    required this.textMuted,
  });

  final List<DailyMarginTrendPoint> points;
  final double targetMarginPct;
  final int? selectedIndex;
  final Color profitColor;
  final Color accentColor;
  final Color warningColor;
  final Color borderColor;
  final Color textMuted;

  @override
  void paint(Canvas canvas, Size size) {
    final left = MorganSpace.md;
    final right = size.width - MorganSpace.sm;
    final top = MorganSpace.sm;
    final bottom = size.height - MorganSpace.lg;
    final chartHeight = bottom - top;

    final values = points.map((point) => point.marginPct ?? targetMarginPct).toList();
    final minValue = [targetMarginPct, ...values].reduce((a, b) => a < b ? a : b) - 5;
    final maxValue = [targetMarginPct, ...values].reduce((a, b) => a > b ? a : b) + 5;
    final range = (maxValue - minValue).clamp(1, double.infinity);

    double yFor(double value) => bottom - ((value - minValue) / range) * chartHeight;

    final gridPaint = Paint()
      ..color = borderColor
      ..strokeWidth = 1;

    canvas.drawLine(Offset(left, bottom), Offset(right, bottom), gridPaint);

    final targetY = yFor(targetMarginPct);
    final targetPaint = Paint()
      ..color = warningColor.withValues(alpha: 0.8)
      ..strokeWidth = 1.5;
    canvas.drawLine(Offset(left, targetY), Offset(right, targetY), targetPaint);

    final linePaint = Paint()
      ..color = accentColor
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final path = Path();
    final stepX = points.length <= 1 ? 0.0 : (right - left) / (points.length - 1);

    for (var i = 0; i < points.length; i++) {
      final value = points[i].marginPct;
      if (value == null) continue;

      final x = left + stepX * i;
      final y = yFor(value);
      if (path.getBounds().isEmpty && i == 0) {
        path.moveTo(x, y);
      } else if (i == 0 || points[i - 1].marginPct == null) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    canvas.drawPath(path, linePaint);

    for (var i = 0; i < points.length; i++) {
      final value = points[i].marginPct;
      if (value == null) continue;

      final x = left + stepX * i;
      final y = yFor(value);
      final isSelected = selectedIndex == i;
      final dotPaint = Paint()..color = isSelected ? profitColor : accentColor;
      canvas.drawCircle(Offset(x, y), isSelected ? 5 : 3, dotPaint);
    }

    final label = TextPainter(
      text: TextSpan(
        text: 'Target ${targetMarginPct.toStringAsFixed(0)}%',
        style: TextStyle(color: textMuted, fontSize: 11),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    label.paint(canvas, Offset(left, targetY - 16));
  }

  @override
  bool shouldRepaint(covariant _MarginTrendPainter oldDelegate) {
    return oldDelegate.points != points ||
        oldDelegate.selectedIndex != selectedIndex ||
        oldDelegate.targetMarginPct != targetMarginPct;
  }
}
