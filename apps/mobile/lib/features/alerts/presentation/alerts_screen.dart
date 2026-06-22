import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/alerts/alert.dart';
import '../../../core/alerts/alerts_providers.dart';
import '../../../core/alerts/alerts_repository.dart';
import '../../../core/auth/auth_providers.dart';
import '../../../core/config/app_config.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_chip.dart';
import '../../../shared/widgets/morgan_fade_in.dart';
import '../../../shared/widgets/morgan_section_header.dart';
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
    return true;
  }

  String _emptyFilterMessage(AlertSeverityFilter filter) => switch (filter) {
        AlertSeverityFilter.all => 'No alerts right now',
        AlertSeverityFilter.warnings => 'No warning alerts',
        AlertSeverityFilter.critical => 'No critical alerts',
      };

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
            loading: () => const CustomScrollView(
              physics: AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverFillRemaining(
                  child: Center(child: CircularProgressIndicator()),
                ),
              ],
            ),
            error: (_, __) => CustomScrollView(
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
                    padding: EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                    child: Text(
                      'Could not load alerts. Pull to retry.',
                      style: theme.textTheme.bodyLarge,
                    ),
                  ),
                ),
              ],
            ),
            data: (data) {
              final alerts = data.filtered(filter);

              if (data.alerts.isEmpty) {
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
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.notifications_none_rounded, size: 48, color: p.accent),
                            const SizedBox(height: MorganSpace.md),
                            Text(
                              _emptyFilterMessage(filter),
                              style: theme.textTheme.titleMedium,
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: MorganSpace.xs),
                            Text(
                              'We will notify you when something needs attention.',
                              style: theme.textTheme.bodySmall,
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                );
              }

              return ListView(
                padding: const EdgeInsets.only(bottom: MorganSpace.huge),
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  const MorganScreenHeader(
                    title: 'Alerts',
                    subtitle: 'Signals that need your attention',
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                      MorganSpace.screenH,
                      0,
                      MorganSpace.screenH,
                      MorganSpace.md,
                    ),
                    child: Wrap(
                      spacing: MorganSpace.xs,
                      runSpacing: MorganSpace.xs,
                      children: [
                        for (final (value, label) in _filters)
                          MorganChip(
                            label: label,
                            selected: filter == value,
                            onTap: () => ref.read(alertSeverityFilterProvider.notifier).state = value,
                          ),
                      ],
                    ),
                  ),
                  if (alerts.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                      child: Text(
                        _emptyFilterMessage(filter),
                        style: theme.textTheme.bodyLarge,
                      ),
                    )
                  else
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                      child: Column(
                        children: [
                          for (var i = 0; i < alerts.length; i++) ...[
                            if (i > 0) const SizedBox(height: MorganSpace.sm),
                            MorganFadeIn(
                              delay: Duration(milliseconds: 60 * i),
                              child: _AlertListItem(
                                alert: alerts[i],
                                onTap: () => context.push('/alerts/${alerts[i].id}'),
                                onMarkRead: () => _markAlertRead(ref, alerts[i]),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
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

    final (Color accent, Color bg, IconData icon) = switch (alert.severity) {
      AlertSeverity.critical => (p.loss, p.lossMuted, Icons.error_outline_rounded),
      AlertSeverity.warning => (p.warning, p.goldMuted, Icons.warning_amber_rounded),
      AlertSeverity.info => (p.accent, p.accentMuted, Icons.info_outline_rounded),
    };

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Opacity(
        opacity: alert.isUnread ? 1 : 0.72,
        child: MorganSurface(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: BorderRadius.circular(MorganRadius.xs),
                ),
                child: Icon(icon, size: 18, color: accent),
              ),
              const SizedBox(width: MorganSpace.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            alert.title,
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: alert.isUnread ? FontWeight.w700 : FontWeight.w600,
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
                    Text(alert.topDriver, style: theme.textTheme.bodySmall),
                  ],
                ),
              ),
              if (alert.isUnread) ...[
                const SizedBox(width: MorganSpace.xs),
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(color: p.accent, shape: BoxShape.circle),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
