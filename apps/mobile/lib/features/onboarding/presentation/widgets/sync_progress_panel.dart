import 'package:flutter/material.dart';

import '../../../../core/sync/sync_status.dart';
import '../../../../core/theme/morgan_colors.dart';
import '../../../../core/theme/morgan_tokens.dart';
import '../../../../shared/widgets/morgan_surface.dart';

class SyncProgressPanel extends StatelessWidget {
  const SyncProgressPanel({super.key, required this.status});

  final SyncStatus status;

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
              Text('Syncing your store', style: theme.textTheme.titleMedium),
              const Spacer(),
              Text('${status.overallPercent}%', style: theme.textTheme.titleSmall?.copyWith(color: p.accent)),
            ],
          ),
          if (status.etaMinutes != null && status.overallPercent < 100) ...[
            const SizedBox(height: MorganSpace.xxs),
            Text(
              'About ${status.etaMinutes} min remaining',
              style: theme.textTheme.bodySmall,
            ),
          ],
          const SizedBox(height: MorganSpace.md),
          ...status.tasks.map((task) => _SyncTaskRow(task: task)),
        ],
      ),
    );
  }
}

class _SyncTaskRow extends StatelessWidget {
  const _SyncTaskRow({required this.task});

  final SyncTaskProgress task;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    final (IconData icon, Color color) = switch (task.status) {
      SyncTaskStatus.complete => (Icons.check_circle_rounded, p.profit),
      SyncTaskStatus.syncing => (Icons.sync_rounded, p.accent),
      SyncTaskStatus.pending => (Icons.circle_outlined, p.textMuted),
    };

    return Padding(
      padding: const EdgeInsets.only(bottom: MorganSpace.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: color),
              const SizedBox(width: MorganSpace.xs),
              Expanded(child: Text(task.label, style: theme.textTheme.titleSmall)),
              Text('${task.percent}%', style: theme.textTheme.bodySmall),
            ],
          ),
          const SizedBox(height: MorganSpace.xxs),
          ClipRRect(
            borderRadius: BorderRadius.circular(MorganRadius.pill),
            child: LinearProgressIndicator(
              value: task.percent / 100,
              minHeight: 4,
              backgroundColor: p.surfaceMuted,
              color: p.accent,
            ),
          ),
        ],
      ),
    );
  }
}
