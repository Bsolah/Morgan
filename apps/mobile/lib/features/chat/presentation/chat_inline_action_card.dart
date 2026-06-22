import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/chat/chat_models.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../../../shared/widgets/morgan_secondary_button.dart';
import '../../../shared/widgets/morgan_surface.dart';

class ChatInlineActionCard extends StatelessWidget {
  const ChatInlineActionCard({
    super.key,
    required this.actionCard,
    required this.onAccept,
    required this.onDismiss,
    this.busy = false,
  });

  final ChatActionCard actionCard;
  final VoidCallback onAccept;
  final VoidCallback onDismiss;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return MorganSurface(
      color: p.goldMuted,
      borderColor: p.gold.withValues(alpha: p.isDark ? 0.25 : 0.15),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.bolt_rounded, size: 18, color: p.gold),
              const SizedBox(width: MorganSpace.xs),
              Text('Recommended action', style: theme.textTheme.labelMedium?.copyWith(color: p.gold)),
            ],
          ),
          const SizedBox(height: MorganSpace.sm),
          InkWell(
            onTap: () => context.push('/recommendations/${actionCard.recommendationId}'),
            borderRadius: BorderRadius.circular(MorganRadius.xs),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: MorganSpace.xxs),
              child: Row(
                children: [
                  Expanded(child: Text(actionCard.title, style: theme.textTheme.titleMedium)),
                  Icon(Icons.chevron_right_rounded, color: p.textMuted, size: 20),
                ],
              ),
            ),
          ),
          const SizedBox(height: MorganSpace.xs),
          Text(actionCard.body, style: theme.textTheme.bodyMedium),
          if (actionCard.impactLabel != null) ...[
            const SizedBox(height: MorganSpace.sm),
            Text(
              actionCard.impactLabel!,
              style: theme.textTheme.titleSmall?.copyWith(color: p.profit, fontWeight: FontWeight.w600),
            ),
          ],
          if (actionCard.isOpen) ...[
            const SizedBox(height: MorganSpace.md),
            Row(
              children: [
                Expanded(
                  child: MorganSecondaryButton(
                    label: 'Dismiss',
                    expanded: true,
                    onPressed: busy ? null : onDismiss,
                  ),
                ),
                const SizedBox(width: MorganSpace.sm),
                Expanded(
                  child: MorganPrimaryButton(
                    label: busy ? 'Accepting…' : 'Accept',
                    onPressed: busy ? null : onAccept,
                  ),
                ),
              ],
            ),
          ] else ...[
            const SizedBox(height: MorganSpace.sm),
            Text(
              actionCard.status == 'accepted' ? 'Accepted' : 'Dismissed',
              style: theme.textTheme.labelMedium?.copyWith(color: p.textSecondary),
            ),
          ],
        ],
      ),
    );
  }
}
