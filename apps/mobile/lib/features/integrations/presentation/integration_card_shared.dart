import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/integrations/integrations_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_surface.dart';

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
      padding: const EdgeInsets.symmetric(horizontal: MorganSpace.sm, vertical: MorganSpace.xxs),
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
  const IntegrationStatusChip({
    super.key,
    required this.status,
    this.needsReauth = false,
    this.comingSoon = false,
  });

  final IntegrationStatus status;
  final bool needsReauth;
  final bool comingSoon;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    if (comingSoon) {
      return const IntegrationComingSoonBadge();
    }

    final (label, color) = switch ((status, needsReauth)) {
      (_, true) => ('Reconnect needed', p.warning),
      (IntegrationStatus.connected, _) => ('Connected', p.profit),
      (IntegrationStatus.syncing, _) => ('Syncing', p.accent),
      (IntegrationStatus.error, _) => ('Error', p.loss),
      (IntegrationStatus.disconnected, _) => ('Disconnected', p.textMuted),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: MorganSpace.sm, vertical: MorganSpace.xxs),
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

/// US-UX-13-01 — unified integration card shell (provider · status · sync · coverage).
class UnifiedIntegrationCard extends StatelessWidget {
  const UnifiedIntegrationCard({
    super.key,
    required this.name,
    required this.icon,
    required this.status,
    required this.dataCoveragePct,
    this.needsReauth = false,
    this.comingSoon = false,
    this.detailLines = const [],
    this.syncMessage,
    this.errorMessage,
    this.lastSyncAt,
    this.actions = const [],
  });

  final String name;
  final IconData icon;
  final IntegrationStatus status;
  final int dataCoveragePct;
  final bool needsReauth;
  final bool comingSoon;
  final List<String> detailLines;
  final String? syncMessage;
  final String? errorMessage;
  final DateTime? lastSyncAt;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return MorganSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: p.accent, size: 22),
              const SizedBox(width: MorganSpace.sm),
              Expanded(child: Text(name, style: theme.textTheme.titleMedium)),
              IntegrationStatusChip(
                status: status,
                needsReauth: needsReauth,
                comingSoon: comingSoon,
              ),
            ],
          ),
          const SizedBox(height: MorganSpace.sm),
          for (final line in detailLines) ...[
            Text(line, style: theme.textTheme.bodySmall),
          ],
          if (syncMessage != null)
            Text(syncMessage!, style: theme.textTheme.bodySmall?.copyWith(color: p.accent)),
          if (!comingSoon) IntegrationLastSyncLine(lastSyncAt: lastSyncAt),
          if (errorMessage != null) ...[
            const SizedBox(height: MorganSpace.xs),
            Text(errorMessage!, style: theme.textTheme.bodySmall?.copyWith(color: p.loss)),
          ],
          const SizedBox(height: MorganSpace.md),
          IntegrationDataCoverageBar(percent: dataCoveragePct, compact: true),
          if (!comingSoon && actions.isNotEmpty) ...[
            const SizedBox(height: MorganSpace.md),
            ...actions,
          ],
        ],
      ),
    );
  }
}
