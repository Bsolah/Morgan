import 'package:flutter/material.dart';

import '../../core/theme/morgan_colors.dart';

/// Morgan logomark — vector `CustomPaint` (no raster assets; US-UX-15-06).
class MorganLogo extends StatelessWidget {
  const MorganLogo({super.key, this.size = 40, this.showWordmark = false});

  final double size;
  final bool showWordmark;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;

    final mark = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: size,
          height: size,
          child: CustomPaint(
            painter: _MorganLogoPainter(
              accent: p.accent,
              gold: p.gold,
              isDark: p.isDark,
            ),
          ),
        ),
        if (showWordmark) ...[
          SizedBox(width: size * 0.28),
          Text(
            'Morgan',
            style: TextStyle(
              fontSize: size * 0.52,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.8,
              color: p.textPrimary,
            ),
          ),
        ],
      ],
    );

    if (showWordmark) {
      return Semantics(label: 'Morgan', child: mark);
    }
    return ExcludeSemantics(child: mark);
  }
}

class _MorganLogoPainter extends CustomPainter {
  _MorganLogoPainter({required this.accent, required this.gold, required this.isDark});

  final Color accent;
  final Color gold;
  final bool isDark;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final r = w * 0.22;

    // Rounded square container
    final bg = RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, w, h), Radius.circular(r));
    final bgPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: isDark
            ? [const Color(0xFF3D3018), accent, const Color(0xFFE8C96A)]
            : [
                Color.lerp(accent, const Color(0xFF1A1408), 0.25)!,
                Color.lerp(accent, const Color(0xFFD4AF37), 0.45)!,
              ],
      ).createShader(Rect.fromLTWH(0, 0, w, h));
    canvas.drawRRect(bg, bgPaint);

    // "M" letterform
    final mPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = w * 0.09
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final path = Path();
    final left = w * 0.28;
    final right = w * 0.72;
    final top = h * 0.30;
    final mid = h * 0.52;
    final bottom = h * 0.72;

    path.moveTo(left, bottom);
    path.lineTo(left, top);
    path.lineTo(w * 0.5, mid);
    path.lineTo(right, top);
    path.lineTo(right, bottom);

    canvas.drawPath(path, mPaint);

    // Insight node — intelligence focal point
    final nodePaint = Paint()..color = gold;
    canvas.drawCircle(Offset(w * 0.5, mid - w * 0.02), w * 0.055, nodePaint);

    // Subtle upward trend tick
    final trendPaint = Paint()
      ..color = gold.withValues(alpha: 0.9)
      ..style = PaintingStyle.stroke
      ..strokeWidth = w * 0.05
      ..strokeCap = StrokeCap.round;
    final trend = Path()
      ..moveTo(w * 0.58, h * 0.38)
      ..lineTo(w * 0.66, h * 0.30)
      ..lineTo(w * 0.76, h * 0.34);
    canvas.drawPath(trend, trendPaint);
  }

  @override
  bool shouldRepaint(covariant _MorganLogoPainter old) =>
      old.accent != accent || old.gold != gold || old.isDark != isDark;
}
