import 'package:flutter/material.dart';

import '../../core/theme/morgan_colors.dart';
import '../../core/theme/morgan_tokens.dart';
import 'morgan_primary_button.dart';

/// Consistent empty state: muted icon · title · explanation · optional CTA (US-UX-15-02).
class MorganEmptyState extends StatelessWidget {
  const MorganEmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
    this.compact = false,
    this.iconColor,
    this.iconBackground,
    this.centered = true,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;
  final bool compact;
  final Color? iconColor;
  final Color? iconBackground;
  final bool centered;

  double get _iconSize => compact ? 44 : 56;
  double get _glyphSize => compact ? 22 : 28;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final resolvedIconColor = iconColor ?? p.accent;
    final resolvedIconBackground = iconBackground ?? p.accentMuted;

    final content = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: centered ? CrossAxisAlignment.center : CrossAxisAlignment.start,
      children: [
        Container(
          width: _iconSize,
          height: _iconSize,
          decoration: BoxDecoration(
            color: resolvedIconBackground,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: _glyphSize, color: resolvedIconColor),
        ),
        SizedBox(height: compact ? MorganSpace.sm : MorganSpace.md),
        Text(
          title,
          textAlign: centered ? TextAlign.center : TextAlign.start,
          style: compact ? theme.textTheme.titleSmall : theme.textTheme.titleMedium,
        ),
        const SizedBox(height: MorganSpace.xs),
        Text(
          message,
          textAlign: centered ? TextAlign.center : TextAlign.start,
          style: theme.textTheme.bodyMedium?.copyWith(color: p.textMuted),
        ),
        if (actionLabel != null && onAction != null) ...[
          SizedBox(height: compact ? MorganSpace.md : MorganSpace.lg),
          MorganPrimaryButton(
            label: actionLabel!,
            onPressed: onAction,
            expanded: !compact,
          ),
        ],
      ],
    );

    if (!centered) {
      return content;
    }

    return Center(child: content);
  }
}
