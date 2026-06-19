import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:intl/intl.dart';

import '../../../core/integrations/integrations_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../../../shared/widgets/morgan_surface.dart';

class GoogleAdsIntegrationCard extends ConsumerStatefulWidget {
  const GoogleAdsIntegrationCard({super.key, required this.status});

  final GoogleAdsIntegrationStatus status;

  @override
  ConsumerState<GoogleAdsIntegrationCard> createState() => _GoogleAdsIntegrationCardState();
}

class _GoogleAdsIntegrationCardState extends ConsumerState<GoogleAdsIntegrationCard> {
  bool _connecting = false;
  bool _disconnecting = false;
  String? _actionError;

  Future<void> _connectGoogleAds() async {
    setState(() {
      _connecting = true;
      _actionError = null;
    });

    try {
      final repo = ref.read(integrationsRepositoryProvider);
      final startUrl = await repo.getGoogleAdsOAuthStartUrl();
      final result = await FlutterWebAuth2.authenticate(
        url: startUrl,
        callbackUrlScheme: metaOAuthCallbackScheme(),
      );

      final uri = Uri.parse(result);
      final errorCode = uri.queryParameters['google_ads_error'];
      if (errorCode != null) {
        setState(() => _actionError = googleAdsOAuthErrorMessage(errorCode));
        return;
      }

      final status = uri.queryParameters['google_ads_status'];
      ref.invalidate(googleAdsIntegrationStatusProvider);

      if (status == 'select_manager') {
        await _showManagerPicker();
        return;
      }

      if (status == 'select_client') {
        await _showClientPicker();
        return;
      }
    } catch (_) {
      setState(() => _actionError = googleAdsOAuthErrorMessage('server_error'));
    } finally {
      if (mounted) setState(() => _connecting = false);
    }
  }

  Future<void> _showManagerPicker() async {
    final repo = ref.read(integrationsRepositoryProvider);
    final accounts = await repo.listGoogleAdsManagerAccounts();
    if (!mounted || accounts.isEmpty) return;

    final selected = await _showAccountSheet(
      title: 'Select manager account',
      subtitle: 'Choose the Google Ads manager (MCC) account Morgan should use.',
      accounts: accounts,
    );

    if (selected == null) return;

    setState(() => _connecting = true);
    try {
      final status = await repo.selectGoogleAdsManagerAccount(selected);
      ref.invalidate(googleAdsIntegrationStatusProvider);
      if (status.needsClientSelection) {
        await _showClientPicker();
      }
    } catch (_) {
      setState(() => _actionError = 'Could not select that manager account.');
    } finally {
      if (mounted) setState(() => _connecting = false);
    }
  }

  Future<void> _showClientPicker() async {
    final repo = ref.read(integrationsRepositoryProvider);
    final accounts = await repo.listGoogleAdsClientAccounts();
    if (!mounted || accounts.isEmpty) return;

    final selected = await _showAccountSheet(
      title: 'Select client account',
      subtitle: 'Choose which Google Ads client account Morgan should analyze.',
      accounts: accounts,
    );

    if (selected == null) return;

    setState(() => _connecting = true);
    try {
      await repo.selectGoogleAdsClientAccount(selected);
      ref.invalidate(googleAdsIntegrationStatusProvider);
    } catch (_) {
      setState(() => _actionError = 'Could not select that client account.');
    } finally {
      if (mounted) setState(() => _connecting = false);
    }
  }

  Future<String?> _showAccountSheet({
    required String title,
    required String subtitle,
    required List<GoogleAdsAccountOption> accounts,
  }) {
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (context) {
        final theme = Theme.of(context);
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(MorganSpace.screenH),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: theme.textTheme.titleMedium),
                const SizedBox(height: MorganSpace.sm),
                Text(subtitle, style: theme.textTheme.bodySmall),
                const SizedBox(height: MorganSpace.md),
                ...accounts.map(
                  (account) => ListTile(
                    title: Text(account.name),
                    subtitle: Text(account.currency ?? account.id),
                    onTap: () => Navigator.of(context).pop(account.id),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _disconnectGoogleAds() async {
    setState(() {
      _disconnecting = true;
      _actionError = null;
    });

    try {
      await ref.read(integrationsRepositoryProvider).disconnectGoogleAds();
      ref.invalidate(googleAdsIntegrationStatusProvider);
    } catch (_) {
      setState(() => _actionError = 'Could not disconnect Google Ads.');
    } finally {
      if (mounted) setState(() => _disconnecting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final status = widget.status;
    final lastSyncLabel = status.lastSyncAt != null
        ? DateFormat.yMMMd().add_jm().format(status.lastSyncAt!.toLocal())
        : 'Never';

    final displayError = _actionError ??
        status.syncErrorMessage ??
        (status.status == IntegrationStatus.error ? status.errorMessage : null);

    return MorganSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.ads_click_outlined, color: p.accent),
              const SizedBox(width: MorganSpace.sm),
              Expanded(
                child: Text('Google Ads', style: theme.textTheme.titleMedium),
              ),
              _GoogleAdsStatusChip(status: status),
            ],
          ),
          const SizedBox(height: MorganSpace.sm),
          Text(
            'Include Search and Shopping campaign performance in budget recommendations.',
            style: theme.textTheme.bodySmall,
          ),
          if (status.managerCustomerName != null)
            Text('Manager: ${status.managerCustomerName}', style: theme.textTheme.bodySmall),
          if (status.clientCustomerName != null)
            Text('Client: ${status.clientCustomerName}', style: theme.textTheme.bodySmall),
          if (status.isConnected && !status.insightsBackfillCompleted)
            Text(
              'Backfilling 90 days of campaign performance…',
              style: theme.textTheme.bodySmall?.copyWith(color: p.accent),
            ),
          if (status.isConnected)
            Text('Last sync: $lastSyncLabel', style: theme.textTheme.bodySmall),
          if (displayError != null) ...[
            const SizedBox(height: MorganSpace.xs),
            Text(displayError, style: theme.textTheme.bodySmall?.copyWith(color: p.loss)),
          ],
          const SizedBox(height: MorganSpace.md),
          if (status.needsManagerSelection)
            MorganPrimaryButton(
              label: 'Select manager account',
              onPressed: _connecting ? null : _showManagerPicker,
            )
          else if (status.needsClientSelection)
            MorganPrimaryButton(
              label: 'Select client account',
              onPressed: _connecting ? null : _showClientPicker,
            )
          else if (status.status == IntegrationStatus.disconnected)
            MorganPrimaryButton(
              label: _connecting ? 'Connecting…' : 'Connect',
              onPressed: _connecting ? null : _connectGoogleAds,
            )
          else if (status.status == IntegrationStatus.error)
            MorganPrimaryButton(
              label: _connecting ? 'Reconnecting…' : 'Reconnect',
              onPressed: _connecting ? null : _connectGoogleAds,
            )
          else ...[
            TextButton(
              onPressed: _disconnecting ? null : _disconnectGoogleAds,
              child: Text(_disconnecting ? 'Disconnecting…' : 'Disconnect'),
            ),
          ],
        ],
      ),
    );
  }
}

class _GoogleAdsStatusChip extends StatelessWidget {
  const _GoogleAdsStatusChip({required this.status});

  final GoogleAdsIntegrationStatus status;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    final (label, color) = switch (status.status) {
      IntegrationStatus.connected => ('Connected', p.profit),
      IntegrationStatus.syncing => ('Syncing', p.accent),
      IntegrationStatus.error => ('Error', p.loss),
      IntegrationStatus.disconnected =>
        status.availability == 'available' ? ('Available', p.accent) : ('Disconnected', p.textMuted),
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
