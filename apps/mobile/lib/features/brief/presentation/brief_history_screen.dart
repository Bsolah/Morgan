import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/auth/auth_providers.dart';
import '../../../core/brief/brief_read_tracker_provider.dart';
import '../../../core/brief/brief_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_motion.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_detail_app_bar.dart';
import '../../../shared/widgets/morgan_empty_state.dart';
import '../../../shared/widgets/morgan_error_state.dart';
import '../../../shared/widgets/morgan_fade_in.dart';
import '../../../shared/widgets/morgan_skeleton.dart';
import '../../../shared/widgets/morgan_surface.dart';

class BriefHistoryScreen extends ConsumerWidget {
  const BriefHistoryScreen({super.key});

  static const _emptyTitle = 'No briefings yet';
  static const _emptyMessage =
      'Your daily brief runs each morning once order data is synced.';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final historyAsync = ref.watch(briefHistoryListProvider);
    final readTrackerAsync = ref.watch(briefReadTrackerProvider);
    final storeId = ref.watch(authControllerProvider).session?.storeId ?? '';

    return Scaffold(
      backgroundColor: p.background,
      appBar: const MorganDetailAppBar(title: 'Briefing history'),
      body: RefreshIndicator(
        onRefresh: () => ref.read(briefHistoryListProvider.notifier).refresh(),
        color: p.accent,
        child: historyAsync.when(
          loading: () => ListView.separated(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(
              MorganSpace.screenH,
              MorganSpace.sm,
              MorganSpace.screenH,
              MorganSpace.huge,
            ),
            itemCount: 6,
            separatorBuilder: (_, __) => const SizedBox(height: MorganSpace.sm),
            itemBuilder: (_, __) => const MorganBriefHistoryTileSkeleton(),
          ),
          error: (error, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              const SizedBox(height: MorganSpace.xxl),
              MorganErrorState(
                error: error,
                fallbackMessage: 'Could not load briefing history.',
                onRetry: () => ref.read(briefHistoryListProvider.notifier).refresh(),
              ),
            ],
          ),
          data: (history) {
            final items = [...history.items]
              ..sort((a, b) => b.date.compareTo(a.date));

            if (items.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: MorganSpace.xxl),
                  MorganEmptyState(
                    icon: Icons.auto_stories_outlined,
                    title: BriefHistoryScreen._emptyTitle,
                    message: BriefHistoryScreen._emptyMessage,
                  ),
                ],
              );
            }

            final readTracker = readTrackerAsync.valueOrNull;

            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(
                MorganSpace.screenH,
                MorganSpace.sm,
                MorganSpace.screenH,
                MorganSpace.huge,
              ),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: MorganSpace.sm),
              itemBuilder: (context, index) {
                final item = items[index];
                final isUnread = item.hasBrief &&
                    readTracker != null &&
                    storeId.isNotEmpty &&
                    !readTracker.isRead(storeId, item.date);

                return MorganFadeIn(
                  delay: MorganMotion.listStaggerDelay(index, step: const Duration(milliseconds: 20)),
                  child: _BriefHistoryTile(
                    item: item,
                    isUnread: isUnread,
                    onOpen: () async {
                      if (readTracker != null && storeId.isNotEmpty) {
                        await readTracker.markRead(storeId, item.date);
                        ref.invalidate(briefReadTrackerProvider);
                      }
                      if (context.mounted) {
                        context.push('/brief/${item.date}');
                      }
                    },
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

class _BriefHistoryTile extends StatelessWidget {
  const _BriefHistoryTile({
    required this.item,
    required this.isUnread,
    required this.onOpen,
  });

  final BriefHistoryListItem item;
  final bool isUnread;
  final VoidCallback onOpen;

  String _formatDateLabel() {
    final parsed = DateTime.tryParse(item.date);
    if (parsed == null) return item.date;
    return DateFormat('EEE, MMM d').format(parsed);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final enabled = item.hasBrief;

    return MorganSurface(
      child: InkWell(
        borderRadius: BorderRadius.circular(MorganRadius.md),
        onTap: enabled ? onOpen : null,
        child: Padding(
          padding: const EdgeInsets.all(MorganSpace.md),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(_formatDateLabel(), style: theme.textTheme.labelMedium),
                        if (isUnread) ...[
                          const SizedBox(width: MorganSpace.xs),
                          _HistoryBadge(label: 'Unread', color: p.accent, background: p.accentMuted),
                        ] else if (item.hasSignificantDelta) ...[
                          const SizedBox(width: MorganSpace.xs),
                          _HistoryBadge(label: 'Updated', color: p.warning, background: p.warning.withValues(alpha: 0.15)),
                        ],
                      ],
                    ),
                    const SizedBox(height: MorganSpace.xxs),
                    Text(
                      enabled ? (item.headline ?? 'Daily briefing') : 'No briefing',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: enabled ? p.textPrimary : p.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
              if (enabled)
                Icon(Icons.chevron_right_rounded, color: p.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}

class _HistoryBadge extends StatelessWidget {
  const _HistoryBadge({
    required this.label,
    required this.color,
    required this.background,
  });

  final String label;
  final Color color;
  final Color background;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: MorganSpace.xs,
        vertical: MorganSpace.xxs,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(MorganRadius.pill),
      ),
      child: Text(
        label,
        style: theme.textTheme.labelSmall?.copyWith(
          color: color,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
