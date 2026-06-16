import 'package:flutter/material.dart';

import '../../core/theme/morgan_colors.dart';
import '../../core/theme/morgan_tokens.dart';

/// Elevated surface card with consistent radius, border, and shadow.
class MorganSurface extends StatelessWidget {
  const MorganSurface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(MorganSpace.card),
    this.margin,
    this.color,
    this.borderColor,
    this.radius = MorganRadius.md,
    this.elevated = true,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final Color? color;
  final Color? borderColor;
  final double radius;
  final bool elevated;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;

    return Container(
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? p.surface,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: borderColor ?? p.borderSubtle),
        boxShadow: elevated ? MorganElevation.card(p.isDark) : null,
      ),
      child: child,
    );
  }
}
