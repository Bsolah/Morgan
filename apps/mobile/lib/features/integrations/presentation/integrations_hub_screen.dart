import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/integrations/integrations_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_surface.dart';
import 'plaid_bank_integration_card.dart';
import 'quickbooks_integration_card.dart';
import 'xero_integration_card.dart';
import 'google_ads_integration_card.dart';

class IntegrationsHubScreen extends ConsumerStatefulWidget {
  const IntegrationsHubScreen({super.key});

  @override
  ConsumerState<IntegrationsHubScreen> createState() => _IntegrationsHubScreenState();
}

class _IntegrationsHubScreenState extends ConsumerState<IntegrationsHubScreen> {
  bool _connecting = false;
  bool _disconnecting = false;
  String? _actionError;
  String? _actionMessage;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _handleOAuthReturn());
  }

  Future<void> _handleOAuthReturn() async {
    final uri = GoRouterState.of(context).uri;
    final metaErrorCode = uri.queryParameters['meta_error'];
    final metaStatus = uri.queryParameters['meta_status'];
    final qbErrorCode = uri.queryParameters['qb_error'];
    final qbStatus = uri.queryParameters['qb_status'];
    final googleAdsErrorCode = uri.queryParameters['google_ads_error'];
    final googleAdsStatus = uri.queryParameters['google_ads_status'];
    final xeroErrorCode = uri.queryParameters['xero_error'];
    final xeroStatus = uri.queryParameters['xero_status'];

    if (metaErrorCode != null) {
      setState(() => _actionError = metaOAuthErrorMessage(metaErrorCode));
      ref.invalidate(metaIntegrationStatusProvider);
      return;
    }

    if (qbErrorCode != null) {
      setState(() => _actionError = quickBooksOAuthErrorMessage(qbErrorCode));
      ref.invalidate(quickbooksIntegrationStatusProvider);
      return;
    }

    if (googleAdsErrorCode != null) {
      setState(() => _actionError = googleAdsOAuthErrorMessage(googleAdsErrorCode));
      ref.invalidate(googleAdsIntegrationStatusProvider);
      return;
    }

    if (xeroErrorCode != null) {
      setState(() => _actionError = xeroOAuthErrorMessage(xeroErrorCode));
      ref.invalidate(xeroIntegrationStatusProvider);
      return;
    }

    if (metaStatus == 'select_account') {
      ref.invalidate(metaIntegrationStatusProvider);
      await _showAccountPicker();
      return;
    }

    if (metaStatus == 'connected') {
      setState(() => _actionMessage = 'Meta Ads connected — syncing now');
      ref.invalidate(metaIntegrationStatusProvider);
    }

    if (qbStatus == 'select_company') {
      setState(() => _actionMessage = 'Select your QuickBooks company below');
      ref.invalidate(quickbooksIntegrationStatusProvider);
      return;
    }

    if (qbStatus == 'connected') {
      setState(() => _actionMessage = 'QuickBooks connected');
      ref.invalidate(quickbooksIntegrationStatusProvider);
    }

    if (googleAdsStatus == 'select_manager') {
      setState(() => _actionMessage = 'Select your Google Ads manager account below');
      ref.invalidate(googleAdsIntegrationStatusProvider);
      return;
    }

    if (googleAdsStatus == 'select_client') {
      setState(() => _actionMessage = 'Select your Google Ads client account below');
      ref.invalidate(googleAdsIntegrationStatusProvider);
      return;
    }

    if (googleAdsStatus == 'connected') {
      setState(() => _actionMessage = 'Google Ads connected — syncing now');
      ref.invalidate(googleAdsIntegrationStatusProvider);
    }

    if (xeroStatus == 'select_tenant') {
      setState(() => _actionMessage = 'Select your Xero organisation below');
      ref.invalidate(xeroIntegrationStatusProvider);
      return;
    }

    if (xeroStatus == 'connected') {
      setState(() => _actionMessage = 'Xero connected');
      ref.invalidate(xeroIntegrationStatusProvider);
    }
  }

  Future<void> _connectMeta() async {
    setState(() {
      _connecting = true;
      _actionError = null;
      _actionMessage = null;
    });

    try {
      final repo = ref.read(integrationsRepositoryProvider);
      final startUrl = await repo.getMetaOAuthStartUrl();
      final result = await FlutterWebAuth2.authenticate(
        url: startUrl,
        callbackUrlScheme: metaOAuthCallbackScheme(),
      );

      final uri = Uri.parse(result);
      final errorCode = uri.queryParameters['meta_error'];
      if (errorCode != null) {
        setState(() => _actionError = metaOAuthErrorMessage(errorCode));
        return;
      }

      final status = uri.queryParameters['meta_status'];
      if (status == 'select_account') {
        ref.invalidate(metaIntegrationStatusProvider);
        await _showAccountPicker();
        return;
      }

      if (status == 'connected') {
        setState(() => _actionMessage = 'Meta Ads connected — syncing now');
        ref.invalidate(metaIntegrationStatusProvider);
      }
    } catch (e) {
      setState(() => _actionError = metaOAuthErrorMessage('server_error'));
    } finally {
      if (mounted) setState(() => _connecting = false);
    }
  }

  Future<void> _showAccountPicker() async {
    final repo = ref.read(integrationsRepositoryProvider);
    final accounts = await repo.listMetaAdAccounts();
    if (!mounted || accounts.isEmpty) return;

    final selected = await showModalBottomSheet<String>(
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
                Text('Select ad account', style: theme.textTheme.titleMedium),
                const SizedBox(height: MorganSpace.sm),
                Text(
                  'Choose which Meta ad account Morgan should analyze.',
                  style: theme.textTheme.bodySmall,
                ),
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

    if (selected == null) return;

    setState(() => _connecting = true);
    try {
      await repo.selectMetaAdAccount(selected);
      setState(() => _actionMessage = 'Meta Ads connected — syncing now');
      ref.invalidate(metaIntegrationStatusProvider);
    } catch (_) {
      setState(() => _actionError = 'Could not select that ad account.');
    } finally {
      if (mounted) setState(() => _connecting = false);
    }
  }

  Future<void> _disconnectMeta() async {
    setState(() {
      _disconnecting = true;
      _actionError = null;
      _actionMessage = null;
    });

    try {
      await ref.read(integrationsRepositoryProvider).disconnectMeta();
      ref.invalidate(metaIntegrationStatusProvider);
    } catch (_) {
      setState(() => _actionError = 'Could not disconnect Meta Ads.');
    } finally {
      if (mounted) setState(() => _disconnecting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final metaAsync = ref.watch(metaIntegrationStatusProvider);
    final plaidAsync = ref.watch(plaidIntegrationStatusProvider);
    final quickbooksAsync = ref.watch(quickbooksIntegrationStatusProvider);
    final googleAdsAsync = ref.watch(googleAdsIntegrationStatusProvider);
    final xeroAsync = ref.watch(xeroIntegrationStatusProvider);

    return Scaffold(
      backgroundColor: p.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.only(bottom: MorganSpace.huge),
          children: [
            const MorganScreenHeader(
              title: 'Integrations',
              subtitle: 'Connect data sources for profit insights',
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (_actionMessage != null) ...[
                    Text(_actionMessage!, style: theme.textTheme.bodySmall?.copyWith(color: p.profit)),
                    const SizedBox(height: MorganSpace.md),
                  ],
                  if (_actionError != null) ...[
                    Text(_actionError!, style: theme.textTheme.bodySmall?.copyWith(color: p.loss)),
                    const SizedBox(height: MorganSpace.md),
                  ],
                  metaAsync.when(
                    loading: () => const Center(child: CircularProgressIndicator()),
                    error: (_, __) => Text(
                      'Could not load integrations.',
                      style: theme.textTheme.bodySmall,
                    ),
                    data: (meta) => Column(
                      children: [
                        _MetaIntegrationCard(
                          status: meta,
                          connecting: _connecting,
                          disconnecting: _disconnecting,
                          onConnect: _connectMeta,
                          onReconnect: _connectMeta,
                          onSelectAccount: _showAccountPicker,
                          onDisconnect: _disconnectMeta,
                        ),
                        const SizedBox(height: MorganSpace.sm),
                        plaidAsync.when(
                          loading: () => const SizedBox.shrink(),
                          error: (_, __) => Text(
                            'Could not load bank connection.',
                            style: theme.textTheme.bodySmall,
                          ),
                          data: (plaid) => PlaidBankIntegrationCard(status: plaid),
                        ),
                        const SizedBox(height: MorganSpace.sm),
                        quickbooksAsync.when(
                          loading: () => const SizedBox.shrink(),
                          error: (_, __) => Text(
                            'Could not load QuickBooks connection.',
                            style: theme.textTheme.bodySmall,
                          ),
                          data: (quickbooks) => QuickBooksIntegrationCard(status: quickbooks),
                        ),
                        const SizedBox(height: MorganSpace.sm),
                        googleAdsAsync.when(
                          loading: () => const SizedBox.shrink(),
                          error: (_, __) => Text(
                            'Could not load Google Ads connection.',
                            style: theme.textTheme.bodySmall,
                          ),
                          data: (googleAds) => GoogleAdsIntegrationCard(status: googleAds),
                        ),
                        const SizedBox(height: MorganSpace.sm),
                        xeroAsync.when(
                          loading: () => const SizedBox.shrink(),
                          error: (_, __) => Text(
                            'Could not load Xero connection.',
                            style: theme.textTheme.bodySmall,
                          ),
                          data: (xero) => XeroIntegrationCard(status: xero),
                        ),
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
}

class _MetaIntegrationCard extends StatelessWidget {
  const _MetaIntegrationCard({
    required this.status,
    required this.connecting,
    required this.disconnecting,
    required this.onConnect,
    required this.onReconnect,
    required this.onSelectAccount,
    required this.onDisconnect,
  });

  final MetaIntegrationStatus status;
  final bool connecting;
  final bool disconnecting;
  final VoidCallback onConnect;
  final VoidCallback onReconnect;
  final VoidCallback onSelectAccount;
  final VoidCallback onDisconnect;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final lastSuccessfulSync = status.lastSuccessfulSyncAt ?? status.lastSyncAt;
    final lastSyncLabel = lastSuccessfulSync != null
        ? DateFormat.yMMMd().add_jm().format(lastSuccessfulSync.toLocal())
        : 'Never';

    final syncError = status.syncErrorMessage;
    final displayError = syncError ?? (status.status == IntegrationStatus.error ? status.errorMessage : null);

    return MorganSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.campaign_outlined, color: p.accent),
              const SizedBox(width: MorganSpace.sm),
              Expanded(
                child: Text('Meta Ads', style: theme.textTheme.titleMedium),
              ),
              _StatusChip(status: status.status),
            ],
          ),
          const SizedBox(height: MorganSpace.sm),
          if (status.adAccountName != null)
            Text('Account: ${status.adAccountName}', style: theme.textTheme.bodySmall),
          if (status.status == IntegrationStatus.syncing)
            Text(
              status.insightsBackfillCompleted
                  ? 'Syncing latest campaign data…'
                  : 'Backfilling 90 days of campaign insights…',
              style: theme.textTheme.bodySmall?.copyWith(color: p.accent),
            ),
          Text('Last successful sync: $lastSyncLabel', style: theme.textTheme.bodySmall),
          if (displayError != null) ...[
            const SizedBox(height: MorganSpace.xs),
            Text(
              displayError,
              style: theme.textTheme.bodySmall?.copyWith(color: p.loss),
            ),
          ],
          const SizedBox(height: MorganSpace.md),
          if (status.needsAccountSelection)
            MorganPrimaryButton(
              label: 'Select ad account',
              onPressed: connecting ? null : onSelectAccount,
            )
          else if (status.status == IntegrationStatus.disconnected)
            MorganPrimaryButton(
              label: connecting ? 'Connecting…' : 'Connect',
              onPressed: connecting ? null : onConnect,
            )
          else if (status.status == IntegrationStatus.error)
            MorganPrimaryButton(
              label: connecting ? 'Reconnecting…' : 'Reconnect',
              onPressed: connecting ? null : onReconnect,
            )
          else ...[
            TextButton(
              onPressed: disconnecting ? null : onDisconnect,
              child: Text(disconnecting ? 'Disconnecting…' : 'Disconnect'),
            ),
          ],
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final IntegrationStatus status;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    final (label, color) = switch (status) {
      IntegrationStatus.connected => ('Connected', p.profit),
      IntegrationStatus.syncing => ('Syncing', p.accent),
      IntegrationStatus.error => ('Error', p.loss),
      IntegrationStatus.disconnected => ('Disconnected', p.textMuted),
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
