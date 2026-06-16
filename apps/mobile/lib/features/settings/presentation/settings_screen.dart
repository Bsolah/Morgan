import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_surface.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final themeMode = ref.watch(themeModeProvider);

    return Scaffold(
      backgroundColor: p.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.only(bottom: MorganSpace.huge),
          children: [
            const MorganScreenHeader(
              title: 'Settings',
              subtitle: 'Preferences and connections',
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('APPEARANCE', style: theme.textTheme.labelMedium),
                  const SizedBox(height: MorganSpace.sm),
                  MorganSurface(
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: MorganThemeMode.values.map((mode) {
                        final selected = themeMode == mode;
                        return ListTile(
                          title: Text(_themeLabel(mode), style: theme.textTheme.titleSmall),
                          trailing: selected
                              ? Icon(Icons.check_rounded, color: p.accent, size: 20)
                              : null,
                          onTap: () => ref.read(themeModeProvider.notifier).state = mode,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(MorganRadius.md),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                  const SizedBox(height: MorganSpace.xl),
                  Text('FINANCE', style: theme.textTheme.labelMedium),
                  const SizedBox(height: MorganSpace.sm),
                  MorganSurface(
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        _SettingsTile(
                          title: 'COGS method',
                          subtitle: 'Shopify unit cost',
                          onTap: () {},
                        ),
                        Divider(height: 1, color: p.borderSubtle, indent: MorganSpace.card),
                        _SettingsTile(
                          title: 'Daily briefing',
                          subtitle: '6:00 AM local time',
                          onTap: () {},
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: MorganSpace.xl),
                  Text('DEVELOPER', style: theme.textTheme.labelMedium),
                  const SizedBox(height: MorganSpace.sm),
                  MorganSurface(
                    child: Text(
                      AppConfig.apiBaseUrl,
                      style: theme.textTheme.bodySmall?.copyWith(
                        fontFamily: 'monospace',
                        color: p.textMuted,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _themeLabel(MorganThemeMode mode) => switch (mode) {
        MorganThemeMode.system => 'System',
        MorganThemeMode.light => 'Light',
        MorganThemeMode.dark => 'Dark',
      };
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({required this.title, required this.subtitle, this.onTap});

  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final p = context.morgan;

    return ListTile(
      title: Text(title, style: theme.textTheme.titleSmall),
      subtitle: Text(subtitle, style: theme.textTheme.bodySmall),
      trailing: Icon(Icons.chevron_right_rounded, color: p.textMuted, size: 20),
      onTap: onTap,
    );
  }
}
