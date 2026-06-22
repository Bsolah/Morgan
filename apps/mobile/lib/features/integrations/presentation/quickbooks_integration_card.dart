import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/integrations/integrations_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../../../shared/widgets/morgan_surface.dart';
import 'integration_card_shared.dart';

class QuickBooksIntegrationCard extends ConsumerStatefulWidget {
  const QuickBooksIntegrationCard({
    super.key,
    required this.status,
    this.dataCoveragePct = 0,
  });

  final QuickBooksIntegrationStatus status;
  final int dataCoveragePct;

  @override
  ConsumerState<QuickBooksIntegrationCard> createState() => _QuickBooksIntegrationCardState();
}

class _QuickBooksIntegrationCardState extends ConsumerState<QuickBooksIntegrationCard> {
  bool _connecting = false;
  bool _disconnecting = false;
  String? _actionError;

  Future<void> _connectQuickBooks() async {
    setState(() {
      _connecting = true;
      _actionError = null;
    });

    try {
      final repo = ref.read(integrationsRepositoryProvider);
      final startUrl = await repo.getQuickBooksOAuthStartUrl();
      final result = await FlutterWebAuth2.authenticate(
        url: startUrl,
        callbackUrlScheme: metaOAuthCallbackScheme(),
      );

      final uri = Uri.parse(result);
      final errorCode = uri.queryParameters['qb_error'];
      if (errorCode != null) {
        setState(() => _actionError = quickBooksOAuthErrorMessage(errorCode));
        return;
      }

      final status = uri.queryParameters['qb_status'];
      if (status == 'select_company') {
        ref.invalidate(quickbooksIntegrationStatusProvider);
        ref.invalidate(integrationsHubProvider);
        await _showCompanyPicker();
        return;
      }

      if (status == 'connected') {
        ref.invalidate(quickbooksIntegrationStatusProvider);
        ref.invalidate(integrationsHubProvider);
      }
    } catch (_) {
      setState(() => _actionError = quickBooksOAuthErrorMessage('server_error'));
    } finally {
      if (mounted) setState(() => _connecting = false);
    }
  }

  Future<void> _showCompanyPicker() async {
    final repo = ref.read(integrationsRepositoryProvider);
    final companies = await repo.listQuickBooksCompanies();
    if (!mounted || companies.isEmpty) return;

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
                Text('Select QuickBooks company', style: theme.textTheme.titleMedium),
                const SizedBox(height: MorganSpace.sm),
                Text(
                  'Choose which QuickBooks company Morgan should use for costs and expenses.',
                  style: theme.textTheme.bodySmall,
                ),
                const SizedBox(height: MorganSpace.md),
                ...companies.map(
                  (company) => ListTile(
                    title: Text(company.name),
                    subtitle: company.country != null ? Text(company.country!) : null,
                    onTap: () => Navigator.of(context).pop(company.id),
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
      await repo.selectQuickBooksCompany(selected);
      ref.invalidate(quickbooksIntegrationStatusProvider);
      ref.invalidate(integrationsHubProvider);
    } catch (_) {
      setState(() => _actionError = 'Could not select that QuickBooks company.');
    } finally {
      if (mounted) setState(() => _connecting = false);
    }
  }

  Future<void> _disconnectQuickBooks() async {
    setState(() {
      _disconnecting = true;
      _actionError = null;
    });

    try {
      await ref.read(integrationsRepositoryProvider).disconnectQuickBooks();
      ref.invalidate(quickbooksIntegrationStatusProvider);
      ref.invalidate(integrationsHubProvider);
    } catch (_) {
      setState(() => _actionError = 'Could not disconnect QuickBooks.');
    } finally {
      if (mounted) setState(() => _disconnecting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = widget.status;

    final displayError = _actionError ??
        (status.status == IntegrationStatus.error ? status.errorMessage : null);

    final detailLines = [
      'Sync costs and expenses from your books for accurate profit insights.',
      if (status.companyName != null) 'Company: ${status.companyName}',
      if (status.needsReauth && status.reauthDueAt != null)
        'Reconnection due by ${DateFormat.yMMMd().format(status.reauthDueAt!.toLocal())}',
    ];

    return UnifiedIntegrationCard(
      name: 'QuickBooks',
      icon: Icons.account_balance_outlined,
      status: status.status,
      needsReauth: status.needsReauth,
      dataCoveragePct: widget.dataCoveragePct,
      detailLines: detailLines,
      syncMessage: status.isConnected && !status.booksInitialSyncCompleted
          ? 'Syncing month-to-date P&L, bills, purchases, and deposits…'
          : null,
      errorMessage: displayError,
      lastSyncAt: status.lastSyncAt,
      actions: [
        if (status.needsCompanySelection)
          MorganPrimaryButton(
            label: 'Select company',
            onPressed: _connecting ? null : _showCompanyPicker,
          )
        else if (status.status == IntegrationStatus.disconnected)
          MorganPrimaryButton(
            label: _connecting ? 'Connecting…' : 'Connect',
            onPressed: _connecting ? null : _connectQuickBooks,
          )
        else if (status.status == IntegrationStatus.error || status.needsReauth)
          MorganPrimaryButton(
            label: _connecting ? 'Reconnecting…' : 'Reconnect',
            onPressed: _connecting ? null : _connectQuickBooks,
          )
        else ...[
          TextButton(
            onPressed: () => context.push('/settings/integrations/quickbooks/mapping'),
            child: const Text('Map accounts'),
          ),
          TextButton(
            onPressed: _disconnecting ? null : _disconnectQuickBooks,
            child: Text(_disconnecting ? 'Disconnecting…' : 'Disconnect'),
          ),
        ],
      ],
    );
  }
}
