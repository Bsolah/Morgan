import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/notifications/notification_prefs.dart';
import '../../../core/notifications/notifications_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_detail_app_bar.dart';
import '../../../shared/widgets/morgan_surface.dart';

class NotificationSettingsScreen extends ConsumerStatefulWidget {
  const NotificationSettingsScreen({super.key});

  @override
  ConsumerState<NotificationSettingsScreen> createState() => _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState extends ConsumerState<NotificationSettingsScreen> {
  NotificationPrefs? _prefs;
  bool _loaded = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadPrefs());
  }

  Future<void> _loadPrefs() async {
    try {
      final prefs = await ref.read(notificationsRepositoryProvider).getPreferences();
      if (!mounted) return;
      setState(() {
        _prefs = prefs;
        _loaded = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _prefs = const NotificationPrefs(
          pushDailyBrief: true,
          pushWarnings: true,
          pushCritical: true,
          quietHoursEnabled: true,
          quietHoursStart: 22,
          quietHoursEnd: 7,
          weeklyEmailDigest: false,
        );
        _loaded = true;
      });
    }
  }

  Future<void> _savePatch(Map<String, dynamic> patch, NotificationPrefs optimistic) async {
    setState(() {
      _prefs = optimistic;
      _saving = true;
    });

    try {
      final updated = await ref.read(notificationsRepositoryProvider).updatePreferences(patch);
      ref.invalidate(notificationPrefsProvider);
      if (!mounted) return;
      setState(() => _prefs = updated);
    } catch (_) {
      if (!mounted) return;
      await _loadPrefs();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not save notification preferences. Try again.')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickQuietHour({
    required String title,
    required int current,
    required void Function(int hour) onSelected,
  }) async {
    final selected = await showDialog<int>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(title),
          content: SizedBox(
            width: double.maxFinite,
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: 24,
              itemBuilder: (context, index) {
                return ListTile(
                  title: Text(NotificationPrefs.formatHourLabel(index)),
                  trailing: index == current ? const Icon(Icons.check_rounded) : null,
                  onTap: () => Navigator.of(context).pop(index),
                );
              },
            ),
          ),
        );
      },
    );

    if (selected == null || selected == current) return;
    onSelected(selected);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final prefs = _prefs;

    return Scaffold(
      backgroundColor: p.background,
      appBar: const MorganDetailAppBar(title: 'Notifications', fallbackRoute: '/settings'),
      body: !_loaded || prefs == null
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                  MorganSpace.screenH,
                  MorganSpace.md,
                  MorganSpace.screenH,
                  MorganSpace.huge,
                ),
                children: [
                  Text(
                    'Control when Morgan notifies you',
                    style: theme.textTheme.headlineSmall,
                  ),
                  const SizedBox(height: MorganSpace.sm),
                  Text(
                    'Changes apply immediately to new notifications.',
                    style: theme.textTheme.bodyLarge,
                  ),
                  const SizedBox(height: MorganSpace.xl),
                  Text('PUSH NOTIFICATIONS', style: theme.textTheme.labelMedium),
                  const SizedBox(height: MorganSpace.sm),
                  MorganSurface(
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        _PrefSwitch(
                          title: 'Daily brief',
                          subtitle: 'When today\'s brief is ready at 6:00 AM local',
                          value: prefs.pushDailyBrief,
                          enabled: !_saving,
                          onChanged: (value) => _savePatch(
                            {'push_daily_brief': value},
                            prefs.copyWith(pushDailyBrief: value),
                          ),
                        ),
                        Divider(height: 1, color: p.borderSubtle, indent: MorganSpace.card),
                        _PrefSwitch(
                          title: 'Alerts (warning)',
                          subtitle: 'Margin drops, ad waste, stockout risk, and similar',
                          value: prefs.pushWarnings,
                          enabled: !_saving,
                          onChanged: (value) => _savePatch(
                            {'push_warnings': value},
                            prefs.copyWith(pushWarnings: value),
                          ),
                        ),
                        Divider(height: 1, color: p.borderSubtle, indent: MorganSpace.card),
                        _PrefSwitch(
                          title: 'Alerts (critical)',
                          subtitle: 'Urgent issues that need immediate attention',
                          value: prefs.pushCritical,
                          enabled: !_saving,
                          onChanged: (value) => _savePatch(
                            {'push_critical': value},
                            prefs.copyWith(pushCritical: value),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: MorganSpace.xl),
                  Text('EMAIL', style: theme.textTheme.labelMedium),
                  const SizedBox(height: MorganSpace.sm),
                  MorganSurface(
                    padding: EdgeInsets.zero,
                    child: _PrefSwitch(
                      title: 'Weekly email digest',
                      subtitle: 'Summary of the week sent every Monday morning',
                      value: prefs.weeklyEmailDigest,
                      enabled: !_saving,
                      onChanged: (value) => _savePatch(
                        {'weekly_email_digest': value},
                        prefs.copyWith(weeklyEmailDigest: value),
                      ),
                    ),
                  ),
                  const SizedBox(height: MorganSpace.xl),
                  Text('QUIET HOURS', style: theme.textTheme.labelMedium),
                  const SizedBox(height: MorganSpace.sm),
                  MorganSurface(
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        SwitchListTile(
                          title: Text('Enable quiet hours', style: theme.textTheme.titleSmall),
                          subtitle: Text(
                            prefs.quietHoursEnabled ? prefs.quietHoursSummary : 'Off',
                            style: theme.textTheme.bodySmall,
                          ),
                          value: prefs.quietHoursEnabled,
                          onChanged: _saving
                              ? null
                              : (value) => _savePatch(
                                    {'quiet_hours_enabled': value},
                                    prefs.copyWith(quietHoursEnabled: value),
                                  ),
                        ),
                        if (prefs.quietHoursEnabled) ...[
                          Divider(height: 1, color: p.borderSubtle, indent: MorganSpace.card),
                          ListTile(
                            title: Text('Start time', style: theme.textTheme.titleSmall),
                            subtitle: Text(
                              NotificationPrefs.formatHourLabel(prefs.quietHoursStart),
                              style: theme.textTheme.bodySmall,
                            ),
                            trailing: Icon(Icons.chevron_right_rounded, color: p.textMuted, size: 20),
                            onTap: _saving
                                ? null
                                : () => _pickQuietHour(
                                      title: 'Quiet hours start',
                                      current: prefs.quietHoursStart,
                                      onSelected: (hour) => _savePatch(
                                        {'quiet_hours_start': hour},
                                        prefs.copyWith(quietHoursStart: hour),
                                      ),
                                    ),
                          ),
                          Divider(height: 1, color: p.borderSubtle, indent: MorganSpace.card),
                          ListTile(
                            title: Text('End time', style: theme.textTheme.titleSmall),
                            subtitle: Text(
                              NotificationPrefs.formatHourLabel(prefs.quietHoursEnd),
                              style: theme.textTheme.bodySmall,
                            ),
                            trailing: Icon(Icons.chevron_right_rounded, color: p.textMuted, size: 20),
                            onTap: _saving
                                ? null
                                : () => _pickQuietHour(
                                      title: 'Quiet hours end',
                                      current: prefs.quietHoursEnd,
                                      onSelected: (hour) => _savePatch(
                                        {'quiet_hours_end': hour},
                                        prefs.copyWith(quietHoursEnd: hour),
                                      ),
                                    ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: MorganSpace.md),
                  Text(
                    'Critical cash runway alerts can still notify you during quiet hours so you '
                    'don\'t miss urgent cash issues.',
                    style: theme.textTheme.bodySmall?.copyWith(color: p.textMuted),
                  ),
                ],
              ),
            ),
    );
  }
}

class _PrefSwitch extends StatelessWidget {
  const _PrefSwitch({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
    this.enabled = true,
  });

  final String title;
  final String subtitle;
  final bool value;
  final bool enabled;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SwitchListTile(
      title: Text(title, style: theme.textTheme.titleSmall),
      subtitle: Text(subtitle, style: theme.textTheme.bodySmall),
      value: value,
      onChanged: enabled ? onChanged : null,
    );
  }
}
