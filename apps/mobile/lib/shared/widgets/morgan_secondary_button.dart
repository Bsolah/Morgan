import 'package:flutter/material.dart';

import '../../core/theme/morgan_tokens.dart';

/// Canonical secondary / outline action button.
class MorganSecondaryButton extends StatelessWidget {
  const MorganSecondaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.expanded = true,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool expanded;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final button = OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(MorganRadius.sm)),
      ),
      child: icon == null
          ? Text(label)
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 18),
                const SizedBox(width: MorganSpace.xs),
                Text(label),
              ],
            ),
    );

    if (!expanded) return button;
    return SizedBox(width: double.infinity, child: button);
  }
}
