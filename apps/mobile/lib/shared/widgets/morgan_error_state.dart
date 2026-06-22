import 'package:flutter/material.dart';

import '../../core/network/morgan_user_error.dart';
import '../../core/theme/morgan_colors.dart';
import '../../core/theme/morgan_tokens.dart';
import 'morgan_secondary_button.dart';

/// Load failure UI: short message + Retry (US-UX-15-03).
class MorganErrorState extends StatelessWidget {
  const MorganErrorState({
    super.key,
    required this.error,
    required this.onRetry,
    this.fallbackMessage,
    this.compact = false,
    this.centered = true,
  });

  final Object? error;
  final VoidCallback onRetry;
  final String? fallbackMessage;
  final bool compact;
  final bool centered;

  IconData _iconFor(MorganErrorKind kind) => switch (kind) {
        MorganErrorKind.network => Icons.wifi_off_rounded,
        MorganErrorKind.server => Icons.cloud_off_outlined,
        MorganErrorKind.client => Icons.info_outline_rounded,
        MorganErrorKind.unknown => Icons.error_outline_rounded,
      };

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final userError = MorganUserError.from(error, fallback: fallbackMessage);

    final content = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: centered ? CrossAxisAlignment.center : CrossAxisAlignment.start,
      children: [
        Icon(
          _iconFor(userError.kind),
          size: compact ? 28 : 36,
          color: p.textMuted,
        ),
        SizedBox(height: compact ? MorganSpace.sm : MorganSpace.md),
        Text(
          userError.message,
          textAlign: centered ? TextAlign.center : TextAlign.start,
          style: (compact ? theme.textTheme.bodyMedium : theme.textTheme.titleSmall)
              ?.copyWith(color: p.textPrimary),
        ),
        SizedBox(height: compact ? MorganSpace.sm : MorganSpace.md),
        MorganSecondaryButton(
          label: 'Retry',
          onPressed: onRetry,
          expanded: !compact && centered,
        ),
      ],
    );

    if (!centered) return content;
    return Center(child: content);
  }
}

void showMorganSaveErrorSnackBar(
  BuildContext context, {
  String message = 'Could not save changes. Try again.',
}) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(message)),
  );
}
