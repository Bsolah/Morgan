import 'package:flutter/material.dart';

import '../../core/theme/morgan_colors.dart';
import '../../core/theme/morgan_tokens.dart';
import 'morgan_back_button.dart';

class MorganSectionHeader extends StatelessWidget {
  const MorganSectionHeader({
    super.key,
    required this.title,
    this.action,
    this.actionLabel,
    this.badgeCount,
  });

  final String title;
  final VoidCallback? action;
  final String? actionLabel;
  final int? badgeCount;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final p = context.morgan;

    return Padding(
      padding: const EdgeInsets.only(bottom: MorganSpace.sm),
      child: Row(
        children: [
          Expanded(
            child: Row(
              children: [
                Flexible(child: Text(title, style: theme.textTheme.titleLarge)),
                if (badgeCount != null && badgeCount! > 0) ...[
                  const SizedBox(width: MorganSpace.sm),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: MorganSpace.sm,
                      vertical: MorganSpace.xxs,
                    ),
                    decoration: BoxDecoration(
                      color: p.lossMuted,
                      borderRadius: BorderRadius.circular(MorganRadius.pill),
                    ),
                    child: Text(
                      '$badgeCount',
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: p.loss,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (action != null && actionLabel != null)
            TextButton(
              onPressed: action,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: MorganSpace.sm),
                minimumSize: const Size(44, 44),
                tapTargetSize: MaterialTapTargetSize.padded,
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

/// Sticky header for deep routes: back affordance + title (US-UX-01-03).
class MorganDetailScreenHeader extends StatelessWidget {
  const MorganDetailScreenHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
    this.fallbackRoute = '/home',
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;
  final String fallbackRoute;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        MorganSpace.xs,
        MorganSpace.md,
        MorganSpace.screenH,
        MorganSpace.sm,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MorganBackButton(fallbackRoute: fallbackRoute),
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
