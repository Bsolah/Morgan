import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';

import '../../../core/integrations/integrations_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../../../shared/widgets/morgan_surface.dart';
import 'integration_card_shared.dart';

class GoogleAdsIntegrationCard extends ConsumerStatefulWidget {
  const GoogleAdsIntegrationCard({
    super.key,
    required this.status,
    this.dataCoveragePct = 0,
  });

  final GoogleAdsIntegrationStatus status;
  final int dataCoveragePct;

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
      ref.invalidate(integrationsHubProvider);

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
      ref.invalidate(integrationsHubProvider);
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
      ref.invalidate(integrationsHubProvider);
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
      ref.invalidate(integrationsHubProvider);
    } catch (_) {
      setState(() => _actionError = 'Could not disconnect Google Ads.');
    } finally {
      if (mounted) setState(() => _disconnecting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = widget.status;

    final displayError = _actionError ??
        status.syncErrorMessage ??
        (status.status == IntegrationStatus.error ? status.errorMessage : null);

    final detailLines = [
      'Include Search and Shopping campaign performance in budget recommendations.',
      if (status.managerCustomerName != null) 'Manager: ${status.managerCustomerName}',
      if (status.clientCustomerName != null) 'Client: ${status.clientCustomerName}',
    ];

    return UnifiedIntegrationCard(
      name: 'Google Ads',
      icon: Icons.ads_click_outlined,
      status: status.status,
      dataCoveragePct: widget.dataCoveragePct,
      detailLines: detailLines,
      syncMessage: status.isConnected && !status.insightsBackfillCompleted
          ? 'Backfilling 90 days of campaign performance…'
          : null,
      errorMessage: displayError,
      lastSyncAt: status.lastSyncAt,
      actions: [
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
        else
          TextButton(
            onPressed: _disconnecting ? null : _disconnectGoogleAds,
            child: Text(_disconnecting ? 'Disconnecting…' : 'Disconnect'),
          ),
      ],
    );
  }
}
