import 'package:flutter/material.dart';

import '../../core/theme/morgan_colors.dart';

/// Icon-only control with Semantics label and 44pt minimum touch target.
class MorganIconButton extends StatelessWidget {
  const MorganIconButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onPressed,
    this.iconSize = 24,
    this.color,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;
  final double iconSize;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;

    return Semantics(
      button: true,
      label: label,
      enabled: onPressed != null,
      child: IconButton(
        tooltip: label,
        onPressed: onPressed,
        icon: Icon(icon, size: iconSize, color: color ?? p.textPrimary),
        style: IconButton.styleFrom(
          minimumSize: const Size(44, 44),
          tapTargetSize: MaterialTapTargetSize.padded,
        ),
      ),
    );
  }
}
