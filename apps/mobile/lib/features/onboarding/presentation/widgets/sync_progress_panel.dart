import 'package:flutter/material.dart';

import '../../../../core/sync/sync_status.dart';
import '../../../../core/theme/morgan_colors.dart';
import '../../../../core/theme/morgan_tokens.dart';
import '../../../../shared/widgets/morgan_surface.dart';

class SyncProgressPanel extends StatelessWidget {
  const SyncProgressPanel({
    super.key,
    required this.status,
    this.firstBriefMessage,
  });

  final SyncStatus status;
  final String? firstBriefMessage;

  static SyncStatus get placeholderStatus => const SyncStatus(
        storeId: '',
        overallPercent: 0,
        etaMinutes: null,
        storeStatus: 'syncing',
        tasks: [
          SyncTaskProgress(id: 'orders', label: 'Orders', percent: 0, status: SyncTaskStatus.pending),
          SyncTaskProgress(
            id: 'products',
            label: 'Products',
            percent: 0,
            status: SyncTaskStatus.pending,
          ),
          SyncTaskProgress(
            id: 'inventory',
            label: 'Inventory',
            percent: 0,
            status: SyncTaskStatus.pending,
          ),
        ],
      );

  bool get _isComplete =>
      status.overallPercent >= 100 ||
      status.storeStatus == 'ready' ||
      status.tasks.every((task) => task.status == SyncTaskStatus.complete);

  static String formatEta(int? minutes) {
    if (minutes == null || minutes <= 0) return '';
    if (minutes == 1) return 'About 1 minute remaining';
    return 'About $minutes minutes remaining';
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final complete = _isComplete;
    final eta = formatEta(status.etaMinutes);

    return MorganSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (complete) ...[
            Row(
              children: [
                Icon(Icons.check_circle_rounded, color: p.profit, size: 22),
                const SizedBox(width: MorganSpace.xs),
                Expanded(
                  child: Text(
                    'Store sync complete',
                    style: theme.textTheme.titleMedium?.copyWith(color: p.profit),
                  ),
                ),
              ],
            ),
            const SizedBox(height: MorganSpace.sm),
            Text(
              firstBriefMessage ?? 'Your first brief arrives at 6:00 AM.',
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: MorganSpace.md),
          ] else ...[
            Row(
              children: [
                Text('Syncing your store', style: theme.textTheme.titleMedium),
                const Spacer(),
                Text(
                  '${status.overallPercent}%',
                  style: theme.textTheme.titleSmall?.copyWith(color: p.accent),
                ),
              ],
            ),
            if (eta.isNotEmpty) ...[
              const SizedBox(height: MorganSpace.xxs),
              Text(eta, style: theme.textTheme.bodySmall),
            ],
            const SizedBox(height: MorganSpace.sm),
            ClipRRect(
              borderRadius: BorderRadius.circular(MorganRadius.pill),
              child: LinearProgressIndicator(
                value: status.overallPercent > 0 ? status.overallPercent / 100 : null,
                minHeight: 6,
                backgroundColor: p.surfaceMuted,
                color: p.accent,
              ),
            ),
            const SizedBox(height: MorganSpace.md),
          ],
          ...status.tasks.map((task) => _SyncTaskRow(task: task, complete: complete)),
        ],
      ),
    );
  }
}

class _SyncTaskRow extends StatelessWidget {
  const _SyncTaskRow({required this.task, required this.complete});

  final SyncTaskProgress task;
  final bool complete;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    final (IconData icon, Color color) = switch (task.status) {
      SyncTaskStatus.complete => (Icons.check_circle_rounded, p.profit),
      SyncTaskStatus.syncing => (Icons.sync_rounded, p.accent),
      SyncTaskStatus.pending => (Icons.circle_outlined, p.textMuted),
    };

    final progressValue = complete ? 1.0 : task.percent / 100;

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
              Text(
                complete || task.status == SyncTaskStatus.complete ? '100%' : '${task.percent}%',
                style: theme.textTheme.bodySmall,
              ),
            ],
          ),
          const SizedBox(height: MorganSpace.xxs),
          ClipRRect(
            borderRadius: BorderRadius.circular(MorganRadius.pill),
            child: LinearProgressIndicator(
              value: progressValue > 0 ? progressValue : null,
              minHeight: 4,
              backgroundColor: p.surfaceMuted,
              color: task.status == SyncTaskStatus.complete ? p.profit : p.accent,
            ),
          ),
        ],
      ),
    );
  }
}
