import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/cash/cash_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';

class CashProjectionChart extends StatefulWidget {
  const CashProjectionChart({
    super.key,
    required this.points,
    this.zeroCrossingDay,
  });

  final List<CashProjectionPoint> points;
  final String? zeroCrossingDay;

  @override
  State<CashProjectionChart> createState() => _CashProjectionChartState();
}

class _CashProjectionChartState extends State<CashProjectionChart> {
  int? _selectedIndex;

  void _handleTap(Offset localPosition, Size size) {
    if (widget.points.length < 2) return;

    final chartWidth = size.width - MorganSpace.md * 2;
    final step = chartWidth / (widget.points.length - 1);
    final index = ((localPosition.dx - MorganSpace.md) / step).round().clamp(0, widget.points.length - 1);

    setState(() => _selectedIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final money = NumberFormat.compactCurrency(symbol: '\$');

    if (widget.points.length < 2) {
      return SizedBox(
        height: 180,
        child: Center(
          child: Text(
            'Projection appears after bank balance syncs.',
            style: theme.textTheme.bodySmall,
          ),
        ),
      );
    }

    final selected = _selectedIndex != null ? widget.points[_selectedIndex!] : widget.points.last;
    final zeroIndex = widget.zeroCrossingDay == null
        ? null
        : widget.points.indexWhere((point) => point.day == widget.zeroCrossingDay);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: MorganSpace.sm),
          child: Text(
            '${DateFormat('MMM d').format(DateTime.parse('${selected.day}T12:00:00Z'))} · '
            '${money.format(selected.balanceUsd)}',
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
                  painter: _CashProjectionPainter(
                    points: widget.points,
                    selectedIndex: _selectedIndex ?? widget.points.length - 1,
                    zeroIndex: zeroIndex != null && zeroIndex >= 0 ? zeroIndex : null,
                    lineColor: p.accent,
                    zeroColor: p.loss,
                    mutedColor: p.textMuted,
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _CashProjectionPainter extends CustomPainter {
  _CashProjectionPainter({
    required this.points,
    required this.selectedIndex,
    required this.zeroIndex,
    required this.lineColor,
    required this.zeroColor,
    required this.mutedColor,
  });

  final List<CashProjectionPoint> points;
  final int selectedIndex;
  final int? zeroIndex;
  final Color lineColor;
  final Color zeroColor;
  final Color mutedColor;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;

    const padding = MorganSpace.md;
    final chartWidth = size.width - padding * 2;
    final chartHeight = size.height - padding * 2;

    final balances = points.map((point) => point.balanceUsd).toList();
    final minBalance = balances.reduce((a, b) => a < b ? a : b);
    final maxBalance = balances.reduce((a, b) => a > b ? a : b);
    final range = (maxBalance - minBalance).abs() < 1 ? 1.0 : maxBalance - minBalance;

    final zeroY = padding + chartHeight - ((0 - minBalance) / range) * chartHeight;
    if (minBalance < 0 || maxBalance > 0) {
      final zeroPaint = Paint()
        ..color = mutedColor.withValues(alpha: 0.35)
        ..strokeWidth = 1;
      canvas.drawLine(Offset(padding, zeroY), Offset(size.width - padding, zeroY), zeroPaint);
    }

    final path = Path();
    for (var index = 0; index < points.length; index++) {
      final x = padding + (chartWidth / (points.length - 1)) * index;
      final y = padding + chartHeight - ((points[index].balanceUsd - minBalance) / range) * chartHeight;
      if (index == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }

    final linePaint = Paint()
      ..color = lineColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5;
    canvas.drawPath(path, linePaint);

    if (zeroIndex != null) {
      final x = padding + (chartWidth / (points.length - 1)) * zeroIndex;
      final dotPaint = Paint()..color = zeroColor;
      canvas.drawCircle(Offset(x, zeroY), 5, dotPaint);
    }

    final selectedX = padding + (chartWidth / (points.length - 1)) * selectedIndex;
    final selectedY = padding +
        chartHeight -
        ((points[selectedIndex].balanceUsd - minBalance) / range) * chartHeight;
    final selectedPaint = Paint()..color = lineColor;
    canvas.drawCircle(Offset(selectedX, selectedY), 4, selectedPaint);
  }

  @override
  bool shouldRepaint(covariant _CashProjectionPainter oldDelegate) {
    return oldDelegate.points != points ||
        oldDelegate.selectedIndex != selectedIndex ||
        oldDelegate.zeroIndex != zeroIndex;
  }
}
