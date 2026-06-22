import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/alerts/alert.dart';
import '../../../core/alerts/alert_visuals.dart';
import '../../../core/alerts/alerts_providers.dart';
import '../../../core/alerts/alerts_repository.dart';
import '../../../core/auth/auth_providers.dart';
import '../../../core/config/app_config.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/haptics/morgan_haptics.dart';
import '../../../core/theme/morgan_motion.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_chip.dart';
import '../../../shared/widgets/morgan_empty_state.dart';
import '../../../shared/widgets/morgan_error_state.dart';
import '../../../shared/widgets/morgan_fade_in.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_skeleton.dart';
import '../../../shared/widgets/morgan_surface.dart';

class AlertsScreen extends ConsumerWidget {
  const AlertsScreen({super.key});

  static const _filters = [
    (AlertSeverityFilter.all, 'All'),
    (AlertSeverityFilter.warnings, 'Warnings'),
    (AlertSeverityFilter.critical, 'Critical'),
  ];

  Future<bool> _markAlertRead(WidgetRef ref, Alert alert) async {
    if (!alert.isUnread) return false;

    final session = await ref.read(authSessionProvider.future);
    if (session != null) {
      try {
        await AlertsRepository(session).markRead(alert.id);
      } catch (_) {
        if (AppConfig.canSkipSetup) {
          AlertsRepository.markReadLocally(alert.id);
        }
      }
    }

    ref.invalidate(alertsProvider);
    ref.invalidate(alertDetailProvider(alert.id));
    MorganHaptics.lightImpact();
    return true;
  }

  ({String title, String message}) _emptyCopy(AlertSeverityFilter filter) => switch (filter) {
        AlertSeverityFilter.all => (
            title: 'No alerts right now',
            message: 'You will get a push when something needs attention.',
          ),
        AlertSeverityFilter.warnings => (
            title: 'No warnings',
            message: 'Margin, ad waste, and stockout signals appear here when flagged.',
          ),
        AlertSeverityFilter.critical => (
            title: 'No critical alerts',
            message: 'Urgent cash and stock issues show up here first.',
          ),
      };

  static const _filteredEmptyTitle = 'Nothing in this filter';
  static const _filteredEmptyMessage = 'Switch to All to see earlier alerts.';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final feed = ref.watch(alertsProvider);
    final filter = ref.watch(alertSeverityFilterProvider);

    return Scaffold(
      backgroundColor: p.background,
      body: SafeArea(
        child: RefreshIndicator(
          color: p.accent,
          onRefresh: () async {
            ref.invalidate(alertsProvider);
            await ref.read(alertsProvider.future);
          },
          child: feed.when(
            loading: () => ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.only(bottom: MorganSpace.huge),
              children: [
                const MorganScreenHeader(
                  title: 'Alerts',
                  subtitle: 'Signals that need your attention',
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                  child: const MorganAlertsListSkeleton(),
                ),
              ],
            ),
            error: (error, __) => CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                const SliverToBoxAdapter(
                  child: MorganScreenHeader(
                    title: 'Alerts',
                    subtitle: 'Signals that need your attention',
                  ),
                ),
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                    child: MorganErrorState(
                      error: error,
                      fallbackMessage: 'Could not load alerts.',
                      onRetry: () => ref.invalidate(alertsProvider),
                    ),
                  ),
                ),
              ],
            ),
            data: (data) {
              final alerts = data.sortedFiltered(filter);

              if (data.alerts.isEmpty) {
                final copy = _emptyCopy(filter);
                return CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    const SliverToBoxAdapter(
                      child: MorganScreenHeader(
                        title: 'Alerts',
                        subtitle: 'Signals that need your attention',
                      ),
                    ),
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                        child: MorganEmptyState(
                          icon: Icons.notifications_none_rounded,
                          title: copy.title,
                          message: copy.message,
                        ),
                      ),
                    ),
                  ],
                );
              }

              final unread = alerts.where((a) => a.isUnread).toList();
              final read = alerts.where((a) => !a.isUnread).toList();

              return CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  const SliverToBoxAdapter(
                    child: MorganScreenHeader(
                      title: 'Alerts',
                      subtitle: 'Signals that need your attention',
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(
                        MorganSpace.screenH,
                        0,
                        MorganSpace.screenH,
                        MorganSpace.md,
                      ),
                      child: Semantics(
                        label: 'Filter alerts',
                        child: Wrap(
                          spacing: MorganSpace.xs,
                          runSpacing: MorganSpace.xs,
                          children: [
                            for (final (value, label) in _filters)
                              MorganChip(
                                label: label,
                                selected: filter == value,
                                onTap: () =>
                                    ref.read(alertSeverityFilterProvider.notifier).state = value,
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  if (alerts.isEmpty)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                        child: MorganEmptyState(
                          icon: Icons.filter_list_off_outlined,
                          title: AlertsScreen._filteredEmptyTitle,
                          message: AlertsScreen._filteredEmptyMessage,
                          compact: true,
                          centered: false,
                        ),
                      ),
                    )
                  else ...[
                    if (unread.isNotEmpty) ...[
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(
                            MorganSpace.screenH,
                            0,
                            MorganSpace.screenH,
                            MorganSpace.sm,
                          ),
                          child: Text('UNREAD', style: theme.textTheme.labelMedium),
                        ),
                      ),
                      SliverPadding(
                        padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                        sliver: SliverList.builder(
                          itemCount: unread.length,
                          itemBuilder: (context, i) {
                            return Padding(
                              padding: EdgeInsets.only(
                                bottom: i < unread.length - 1 ? MorganSpace.sm : 0,
                              ),
                              child: MorganFadeIn(
                                delay: MorganMotion.listStaggerDelay(i),
                                child: _AlertListItem(
                                  alert: unread[i],
                                  onTap: () => context.push('/alerts/${unread[i].id}'),
                                  onMarkRead: () => _markAlertRead(ref, unread[i]),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                    if (read.isNotEmpty) ...[
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: EdgeInsets.fromLTRB(
                            MorganSpace.screenH,
                            unread.isNotEmpty ? MorganSpace.lg : 0,
                            MorganSpace.screenH,
                            MorganSpace.sm,
                          ),
                          child: Text('EARLIER', style: theme.textTheme.labelMedium),
                        ),
                      ),
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(
                          MorganSpace.screenH,
                          0,
                          MorganSpace.screenH,
                          MorganSpace.huge,
                        ),
                        sliver: SliverList.builder(
                          itemCount: read.length,
                          itemBuilder: (context, i) {
                            return Padding(
                              padding: EdgeInsets.only(
                                bottom: i < read.length - 1 ? MorganSpace.sm : 0,
                              ),
                              child: MorganFadeIn(
                                delay: MorganMotion.listStaggerDelay(i),
                                child: _AlertListItem(
                                  alert: read[i],
                                  onTap: () => context.push('/alerts/${read[i].id}'),
                                  onMarkRead: () => _markAlertRead(ref, read[i]),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                  ],
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _AlertListItem extends StatelessWidget {
  const _AlertListItem({
    required this.alert,
    required this.onTap,
    required this.onMarkRead,
  });

  final Alert alert;
  final VoidCallback onTap;
  final Future<bool> Function() onMarkRead;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final tile = _AlertTile(alert: alert, onTap: onTap);

    if (!alert.isUnread) return tile;

    return Dismissible(
      key: ValueKey(alert.id),
      direction: DismissDirection.endToStart,
      confirmDismiss: (_) async {
        final marked = await onMarkRead();
        if (marked && context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Marked as read'),
              duration: Duration(seconds: 1),
            ),
          );
        }
        return false;
      },
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: MorganSpace.lg),
        decoration: BoxDecoration(
          color: p.accentMuted,
          borderRadius: BorderRadius.circular(MorganRadius.md),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Icon(Icons.done_all_rounded, color: p.accent, size: 20),
            const SizedBox(width: MorganSpace.xxs),
            Text(
              'Mark read',
              style: Theme.of(context).textTheme.labelLarge?.copyWith(color: p.accent),
            ),
          ],
        ),
      ),
      child: tile,
    );
  }
}

class _AlertTile extends StatelessWidget {
  const _AlertTile({required this.alert, required this.onTap});

  final Alert alert;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final (stripeColor, _) = alertSeverityAccent(p, alert.severity);

    return Semantics(
      button: true,
      label: _semanticsLabel(),
      hint: alert.isUnread ? 'Swipe left to mark as read' : null,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Opacity(
        opacity: alert.isUnread ? 1 : 0.72,
        child: MorganSurface(
          padding: EdgeInsets.zero,
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  width: 4,
                  decoration: BoxDecoration(
                    color: stripeColor,
                    borderRadius: const BorderRadius.horizontal(
                      left: Radius.circular(MorganRadius.md),
                    ),
                  ),
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(MorganSpace.md),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: p.surfaceMuted,
                            borderRadius: BorderRadius.circular(MorganRadius.xs),
                          ),
                          child: Icon(
                            alertTypeIcon(alert.type),
                            size: 18,
                            color: stripeColor,
                          ),
                        ),
                        const SizedBox(width: MorganSpace.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                alertTypeLabel(alert.type),
                                style: theme.textTheme.labelSmall?.copyWith(color: p.textMuted),
                              ),
                              const SizedBox(height: MorganSpace.xxs),
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      alert.title,
                                      style: theme.textTheme.titleMedium?.copyWith(
                                        fontWeight:
                                            alert.isUnread ? FontWeight.w700 : FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                  Text(
                                    formatAlertRelativeTime(alert.createdAt),
                                    style: theme.textTheme.bodySmall,
                                  ),
                                ],
                              ),
                              const SizedBox(height: MorganSpace.xxs),
                              Text(
                                alert.magnitude,
                                style: theme.textTheme.titleSmall?.copyWith(color: stripeColor),
                              ),
                            ],
                          ),
                        ),
                        if (alert.isUnread) ...[
                          const SizedBox(width: MorganSpace.xs),
                          Container(
                            width: 8,
                            height: 8,
                            margin: const EdgeInsets.only(top: MorganSpace.xxs),
                            decoration: BoxDecoration(color: p.accent, shape: BoxShape.circle),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      ),
    );
  }

  String _semanticsLabel() {
    final status = alert.isUnread ? 'Unread' : 'Read';
    return '${alertTypeLabel(alert.type)}. ${alert.title}. ${alert.magnitude}. $status.';
  }
}
