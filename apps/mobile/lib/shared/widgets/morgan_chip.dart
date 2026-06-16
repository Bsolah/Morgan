import 'package:flutter/material.dart';

import '../../core/theme/morgan_colors.dart';
import '../../core/theme/morgan_tokens.dart';

class MorganChip extends StatelessWidget {
  const MorganChip({super.key, required this.label, required this.onTap, this.selected = false});

  final String label;
  final VoidCallback onTap;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: MorganDuration.fast,
        padding: const EdgeInsets.symmetric(horizontal: MorganSpace.md, vertical: MorganSpace.xs),
        decoration: BoxDecoration(
          color: selected ? p.accentMuted : p.surfaceMuted,
          borderRadius: BorderRadius.circular(MorganRadius.pill),
          border: Border.all(color: selected ? p.accent.withValues(alpha: 0.4) : p.borderSubtle),
        ),
        child: Text(
          label,
          style: theme.textTheme.bodySmall?.copyWith(
            color: selected ? p.accent : p.textSecondary,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}
