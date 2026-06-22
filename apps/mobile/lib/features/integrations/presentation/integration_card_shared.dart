import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/integrations/integrations_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';

String formatIntegrationSyncTime(DateTime value) {
  return DateFormat.yMMMd().add_jm().format(value.toLocal());
}

class IntegrationStatusIcon extends StatelessWidget {
  const IntegrationStatusIcon({super.key, required this.status});

  final IntegrationStatus status;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;

    final (icon, color) = switch (status) {
      IntegrationStatus.connected => (Icons.check_circle_rounded, p.profit),
      IntegrationStatus.syncing => (Icons.sync_rounded, p.accent),
      IntegrationStatus.error => (Icons.error_outline_rounded, p.loss),
      IntegrationStatus.disconnected => (Icons.radio_button_unchecked_rounded, p.textMuted),
    };

    return Icon(icon, color: color, size: 22);
  }
}

class IntegrationComingSoonBadge extends StatelessWidget {
  const IntegrationComingSoonBadge({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: p.textMuted.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(MorganRadius.pill),
      ),
      child: Text(
        'Coming soon',
        style: theme.textTheme.labelSmall?.copyWith(color: p.textMuted),
      ),
    );
  }
}

class IntegrationStatusChip extends StatelessWidget {
  const IntegrationStatusChip({super.key, required this.status});

  final IntegrationStatus status;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    final (label, color) = switch (status) {
      IntegrationStatus.connected => ('Connected', p.profit),
      IntegrationStatus.syncing => ('Syncing', p.accent),
      IntegrationStatus.error => ('Error', p.loss),
      IntegrationStatus.disconnected => ('Disconnected', p.textMuted),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(MorganRadius.pill),
      ),
      child: Text(label, style: theme.textTheme.labelSmall?.copyWith(color: color)),
    );
  }
}

class IntegrationDataCoverageBar extends StatelessWidget {
  const IntegrationDataCoverageBar({
    super.key,
    required this.percent,
    this.compact = false,
  });

  final int percent;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final clamped = percent.clamp(0, 100);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              compact ? 'Data coverage' : 'Data coverage: $clamped%',
              style: theme.textTheme.bodySmall,
            ),
            if (!compact)
              Text('$clamped%', style: theme.textTheme.labelSmall?.copyWith(color: p.accent)),
          ],
        ),
        const SizedBox(height: MorganSpace.xs),
        ClipRRect(
          borderRadius: BorderRadius.circular(MorganRadius.pill),
          child: LinearProgressIndicator(
            minHeight: compact ? 6 : 8,
            value: clamped / 100,
            backgroundColor: p.borderSubtle,
            color: p.accent,
          ),
        ),
      ],
    );
  }
}

class IntegrationLastSyncLine extends StatelessWidget {
  const IntegrationLastSyncLine({super.key, this.lastSyncAt});

  final DateTime? lastSyncAt;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final label = lastSyncAt == null
        ? 'Last sync: Never'
        : 'Last sync: ${formatIntegrationSyncTime(lastSyncAt!)}';

    return Text(label, style: theme.textTheme.bodySmall);
  }
}

class IntegrationsOverallCoveragePanel extends StatelessWidget {
  const IntegrationsOverallCoveragePanel({
    super.key,
    required this.percent,
    this.summaryMessage,
  });

  final int percent;
  final String? summaryMessage;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final p = context.morgan;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        IntegrationDataCoverageBar(percent: percent),
        if (summaryMessage != null) ...[
          const SizedBox(height: MorganSpace.sm),
          Text(
            summaryMessage!,
            style: theme.textTheme.bodySmall?.copyWith(color: p.textMuted),
          ),
        ],
      ],
    );
  }
}
