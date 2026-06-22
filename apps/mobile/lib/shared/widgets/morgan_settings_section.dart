import 'package:flutter/material.dart';

import '../../core/theme/morgan_tokens.dart';
import 'morgan_surface.dart';

/// Grouped settings block: uppercase section label + inset [MorganSurface] list.
class MorganSettingsSection extends StatelessWidget {
  const MorganSettingsSection({
    super.key,
    required this.label,
    required this.child,
    this.bottomSpacing = MorganSpace.xl,
  });

  final String label;
  final Widget child;
  final double bottomSpacing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: theme.textTheme.labelMedium),
        const SizedBox(height: MorganSpace.sm),
        MorganSurface(padding: EdgeInsets.zero, child: child),
        SizedBox(height: bottomSpacing),
      ],
    );
  }
}
