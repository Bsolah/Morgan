import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/auth/auth_repository.dart';
import '../../../core/auth/biometric_service.dart';
import '../../../core/config/app_config.dart';
import '../../../core/inventory/inventory_config_repository.dart';
import '../../../core/finance/finance_repository.dart';
import '../../../core/network/api_client.dart';
import '../../../core/notifications/notifications_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_surface.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool? _biometricEnabled;
  bool _biometricAvailable = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadBiometricState());
  }

  Future<void> _loadBiometricState() async {
    final biometric = ref.read(biometricServiceProvider);
    final repo = ref.read(authRepositoryProvider);
    final supported = await biometric.isDeviceSupported();
    final canCheck = await biometric.canCheckBiometrics();
    final enabled = await repo.isBiometricEnabled();

    if (!mounted) return;
    setState(() {
      _biometricAvailable = supported && canCheck;
      _biometricEnabled = enabled;
    });
  }

  Future<void> _toggleBiometric(bool value) async {
    if (value) {
      final biometric = ref.read(biometricServiceProvider);
      final ok = await biometric.authenticate(
        reason: 'Confirm your identity to enable biometric unlock',
      );
      if (!ok) return;
      await ref.read(authControllerProvider.notifier).enableBiometric();
    } else {
      await ref.read(authControllerProvider.notifier).disableBiometric();
    }

    setState(() => _biometricEnabled = value);
  }

  Future<void> _logout() async {
    await ref.read(authControllerProvider.notifier).logout();
    if (mounted) context.go('/onboarding');
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final themeMode = ref.watch(themeModeProvider);
    final shopDomain = ref.watch(authControllerProvider).session?.shopDomain;
    final notificationSubtitle = ref.watch(notificationPrefsProvider).maybeWhen(
          data: (prefs) =>
              'Brief ${prefs.pushDailyBrief ? 'on' : 'off'} · Quiet hours ${prefs.quietHoursSummary}',
          orElse: () => 'Daily brief, alerts, quiet hours',
        );

    // Ensure API client is initialized for authenticated requests site-wide.
    ref.watch(apiClientProvider);

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
                  Text('ACCOUNT', style: theme.textTheme.labelMedium),
                  const SizedBox(height: MorganSpace.sm),
                  MorganSurface(
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        ListTile(
                          title: Text('Connected store', style: theme.textTheme.titleSmall),
                          subtitle: Text(
                            shopDomain ?? 'Not connected',
                            style: theme.textTheme.bodySmall,
                          ),
                        ),
                        if (_biometricAvailable) ...[
                          Divider(height: 1, color: p.borderSubtle, indent: MorganSpace.card),
                          SwitchListTile(
                            title: Text('Biometric unlock', style: theme.textTheme.titleSmall),
                            subtitle: Text(
                              'Face ID or fingerprint to open Morgan',
                              style: theme.textTheme.bodySmall,
                            ),
                            value: _biometricEnabled ?? false,
                            onChanged: _biometricEnabled == null ? null : _toggleBiometric,
                          ),
                        ],
                        Divider(height: 1, color: p.borderSubtle, indent: MorganSpace.card),
                        ListTile(
                          title: Text('Sign out', style: theme.textTheme.titleSmall?.copyWith(color: p.loss)),
                          onTap: _logout,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: MorganSpace.xl),
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
                  Text('INTEGRATIONS', style: theme.textTheme.labelMedium),
                  const SizedBox(height: MorganSpace.sm),
                  MorganSurface(
                    padding: EdgeInsets.zero,
                    child: _SettingsTile(
                      title: 'Integrations Hub',
                      subtitle: 'Meta Ads, Shopify, and more',
                      onTap: () => context.push('/settings/integrations'),
                    ),
                  ),
                  const SizedBox(height: MorganSpace.xl),
                  Text('INVENTORY', style: theme.textTheme.labelMedium),
                  const SizedBox(height: MorganSpace.sm),
                  MorganSurface(
                    padding: EdgeInsets.zero,
                    child: _SettingsTile(
                      title: 'Lead times',
                      subtitle: ref.watch(inventoryConfigProvider).maybeWhen(
                            data: (config) => config.subtitle,
                            orElse: () => '14-day default',
                          ),
                      onTap: () => context.push('/settings/inventory'),
                    ),
                  ),
                  const SizedBox(height: MorganSpace.xl),
                  Text('NOTIFICATIONS', style: theme.textTheme.labelMedium),
                  const SizedBox(height: MorganSpace.sm),
                  MorganSurface(
                    padding: EdgeInsets.zero,
                    child: _SettingsTile(
                      title: 'Notification preferences',
                      subtitle: notificationSubtitle,
                      onTap: () => context.push('/settings/notifications'),
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
                          subtitle: ref.watch(financeConfigProvider).maybeWhen(
                                data: (config) => config.settingsSubtitle,
                                orElse: () => 'Shopify unit cost',
                              ),
                          onTap: () => context.push('/settings/cogs'),
                        ),
                        Divider(height: 1, color: p.borderSubtle, indent: MorganSpace.card),
                        _SettingsTile(
                          title: 'Target margin',
                          subtitle: ref.watch(financeConfigProvider).maybeWhen(
                                data: (config) => config.targetMarginSettingsSubtitle,
                                orElse: () => 'Target 40%',
                              ),
                          onTap: () => context.push('/settings/target-margin'),
                        ),
                        Divider(height: 1, color: p.borderSubtle, indent: MorganSpace.card),
                        _SettingsTile(
                          title: 'Daily briefing',
                          subtitle: ref.watch(briefingScheduleProvider).maybeWhen(
                                data: (schedule) => schedule.settingsSubtitle,
                                orElse: () => '6:00 AM',
                              ),
                          onTap: () => context.push('/settings/briefing'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: MorganSpace.xl),
                  Text('DEVELOPER', style: theme.textTheme.labelMedium),
                  const SizedBox(height: MorganSpace.sm),
                  MorganSurface(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          AppConfig.apiBaseUrl,
                          style: theme.textTheme.bodySmall?.copyWith(
                            fontFamily: 'monospace',
                            color: p.textMuted,
                          ),
                        ),
                        if (AppConfig.canSkipSetup) ...[
                          const SizedBox(height: MorganSpace.sm),
                          Text(
                            'Local dev mode — Shopify setup skipped',
                            style: theme.textTheme.bodySmall?.copyWith(color: p.accent),
                          ),
                        ],
                      ],
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
