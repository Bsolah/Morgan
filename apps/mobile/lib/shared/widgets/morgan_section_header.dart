import 'package:flutter/material.dart';

import '../../core/theme/morgan_colors.dart';
import '../../core/theme/morgan_tokens.dart';

class MorganSectionHeader extends StatelessWidget {
  const MorganSectionHeader({
    super.key,
    required this.title,
    this.action,
    this.actionLabel,
  });

  final String title;
  final VoidCallback? action;
  final String? actionLabel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final p = context.morgan;

    return Padding(
      padding: const EdgeInsets.only(bottom: MorganSpace.sm),
      child: Row(
        children: [
          Expanded(child: Text(title, style: theme.textTheme.titleLarge)),
          if (action != null && actionLabel != null)
            TextButton(
              onPressed: action,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: MorganSpace.xs),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Text(actionLabel!, style: theme.textTheme.titleSmall?.copyWith(color: p.accent)),
            ),
        ],
      ),
    );
  }
}

class MorganScreenHeader extends StatelessWidget {
  const MorganScreenHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        MorganSpace.screenH,
        MorganSpace.md,
        MorganSpace.screenH,
        MorganSpace.sm,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: theme.textTheme.headlineMedium),
                if (subtitle != null) ...[
                  const SizedBox(height: MorganSpace.xxs),
                  Text(subtitle!, style: theme.textTheme.bodyMedium),
                ],
              ],
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}
