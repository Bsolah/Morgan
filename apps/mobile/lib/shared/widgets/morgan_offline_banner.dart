import 'package:flutter/material.dart';

import '../../core/theme/morgan_colors.dart';
import '../../core/theme/morgan_tokens.dart';

class MorganOfflineBanner extends StatelessWidget {
  const MorganOfflineBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return Material(
      color: p.warning.withValues(alpha: 0.12),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: MorganSpace.screenH,
          vertical: MorganSpace.sm,
        ),
        child: Row(
          children: [
            Icon(Icons.cloud_off_outlined, size: 18, color: p.warning),
            const SizedBox(width: MorganSpace.sm),
            Expanded(
              child: Text(
                'You\'re offline — messages will send when connection returns',
                style: theme.textTheme.bodySmall?.copyWith(color: p.warning),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
