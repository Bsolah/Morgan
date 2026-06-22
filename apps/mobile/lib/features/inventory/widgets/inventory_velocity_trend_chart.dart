import 'package:flutter/material.dart';

import '../../../core/inventory/inventory_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';

class InventoryVelocityTrendChart extends StatelessWidget {
  const InventoryVelocityTrendChart({super.key, required this.points});

  final List<InventoryVelocityTrendPoint> points;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    if (points.isEmpty) {
      return SizedBox(
        height: 120,
        child: Center(
          child: Text(
            'Velocity trend appears after enough order history.',
            style: theme.textTheme.bodySmall,
          ),
        ),
      );
    }

    return ExcludeSemantics(
      child: SizedBox(
        height: 120,
        width: double.infinity,
        child: CustomPaint(
          painter: _InventoryVelocityTrendPainter(points: points, lineColor: p.accent),
        ),
      ),
    );
  }
}

class _InventoryVelocityTrendPainter extends CustomPainter {
  _InventoryVelocityTrendPainter({required this.points, required this.lineColor});

  final List<InventoryVelocityTrendPoint> points;
  final Color lineColor;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;

    const padding = MorganSpace.md;
    final chartWidth = size.width - padding * 2;
    final chartHeight = size.height - padding * 2;
    final maxUnits = points.map((point) => point.units).reduce((a, b) => a > b ? a : b).clamp(0.1, double.infinity);
    final step = chartWidth / (points.length - 1);

    final path = Path();
    for (var index = 0; index < points.length; index++) {
      final x = padding + index * step;
      final y = padding + chartHeight - (points[index].units / maxUnits) * chartHeight;
      if (index == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }

    canvas.drawPath(
      path,
      Paint()
        ..color = lineColor
        ..strokeWidth = 2
        ..style = PaintingStyle.stroke,
    );

    for (var index = 0; index < points.length; index++) {
      final x = padding + index * step;
      final y = padding + chartHeight - (points[index].units / maxUnits) * chartHeight;
      canvas.drawCircle(Offset(x, y), 2.5, Paint()..color = lineColor);
    }
  }

  @override
  bool shouldRepaint(covariant _InventoryVelocityTrendPainter oldDelegate) {
    return oldDelegate.points != points;
  }
}
