import 'package:flutter/material.dart';

import '../../core/theme/morgan_colors.dart';
import '../../core/theme/morgan_tokens.dart';

class MorganPrimaryButton extends StatelessWidget {
  const MorganPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.expanded = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;

    final button = FilledButton(
      onPressed: onPressed,
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(MorganRadius.sm)),
        elevation: 0,
        shadowColor: Colors.transparent,
      ),
      child: Text(label),
    );

    if (!expanded) return button;

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(MorganRadius.sm),
        boxShadow: [
          BoxShadow(
            color: p.accent.withValues(alpha: p.isDark ? 0.35 : 0.28),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: button,
    );
  }
}
