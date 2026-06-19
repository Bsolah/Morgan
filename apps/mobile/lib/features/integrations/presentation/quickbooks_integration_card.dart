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

class QuickBooksIntegrationCard extends ConsumerStatefulWidget {
  const QuickBooksIntegrationCard({super.key, required this.status});

  final QuickBooksIntegrationStatus status;

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
        await _showCompanyPicker();
        return;
      }

      if (status == 'connected') {
        ref.invalidate(quickbooksIntegrationStatusProvider);
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
    } catch (_) {
      setState(() => _actionError = 'Could not disconnect QuickBooks.');
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
        (status.status == IntegrationStatus.error ? status.errorMessage : null);

    return MorganSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.account_balance_outlined, color: p.accent),
              const SizedBox(width: MorganSpace.sm),
              Expanded(
                child: Text('QuickBooks Online', style: theme.textTheme.titleMedium),
              ),
              _QuickBooksStatusChip(status: status.status),
            ],
          ),
          const SizedBox(height: MorganSpace.sm),
          Text(
            'Sync costs and expenses from your books for accurate profit insights.',
            style: theme.textTheme.bodySmall,
          ),
          if (status.companyName != null)
            Text('Company: ${status.companyName}', style: theme.textTheme.bodySmall),
          if (status.needsReauth && status.reauthDueAt != null)
            Text(
              'Reconnection due by ${DateFormat.yMMMd().format(status.reauthDueAt!.toLocal())}',
              style: theme.textTheme.bodySmall?.copyWith(color: p.accent),
            ),
          if (status.isConnected)
            Text('Last sync: $lastSyncLabel', style: theme.textTheme.bodySmall),
          if (status.isConnected && !status.booksInitialSyncCompleted)
            Text(
              'Syncing month-to-date P&L, bills, purchases, and deposits…',
              style: theme.textTheme.bodySmall?.copyWith(color: p.accent),
            ),
          if (displayError != null) ...[
            const SizedBox(height: MorganSpace.xs),
            Text(displayError, style: theme.textTheme.bodySmall?.copyWith(color: p.loss)),
          ],
          const SizedBox(height: MorganSpace.md),
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
      ),
    );
  }
}

class _QuickBooksStatusChip extends StatelessWidget {
  const _QuickBooksStatusChip({required this.status});

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
