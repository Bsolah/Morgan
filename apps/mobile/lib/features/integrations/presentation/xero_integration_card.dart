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

class XeroIntegrationCard extends ConsumerStatefulWidget {
  const XeroIntegrationCard({super.key, required this.status});

  final XeroIntegrationStatus status;

  @override
  ConsumerState<XeroIntegrationCard> createState() => _XeroIntegrationCardState();
}

class _XeroIntegrationCardState extends ConsumerState<XeroIntegrationCard> {
  bool _connecting = false;
  bool _disconnecting = false;
  String? _actionError;

  Future<void> _connectXero() async {
    setState(() {
      _connecting = true;
      _actionError = null;
    });

    try {
      final repo = ref.read(integrationsRepositoryProvider);
      final startUrl = await repo.getXeroOAuthStartUrl();
      final result = await FlutterWebAuth2.authenticate(
        url: startUrl,
        callbackUrlScheme: metaOAuthCallbackScheme(),
      );

      final uri = Uri.parse(result);
      final errorCode = uri.queryParameters['xero_error'];
      if (errorCode != null) {
        setState(() => _actionError = xeroOAuthErrorMessage(errorCode));
        return;
      }

      final status = uri.queryParameters['xero_status'];
      if (status == 'select_tenant') {
        ref.invalidate(xeroIntegrationStatusProvider);
        await _showTenantPicker();
        return;
      }

      if (status == 'connected') {
        ref.invalidate(xeroIntegrationStatusProvider);
      }
    } catch (_) {
      setState(() => _actionError = xeroOAuthErrorMessage('server_error'));
    } finally {
      if (mounted) setState(() => _connecting = false);
    }
  }

  Future<void> _showTenantPicker() async {
    final repo = ref.read(integrationsRepositoryProvider);
    final tenants = await repo.listXeroTenants();
    if (!mounted || tenants.isEmpty) return;

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
                Text('Select Xero organisation', style: theme.textTheme.titleMedium),
                const SizedBox(height: MorganSpace.sm),
                Text(
                  'Choose which Xero organisation Morgan should use for costs and expenses.',
                  style: theme.textTheme.bodySmall,
                ),
                const SizedBox(height: MorganSpace.md),
                ...tenants.map(
                  (tenant) => ListTile(
                    title: Text(tenant.name),
                    subtitle: tenant.tenantType != null ? Text(tenant.tenantType!) : null,
                    onTap: () => Navigator.of(context).pop(tenant.id),
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
      await repo.selectXeroTenant(selected);
      ref.invalidate(xeroIntegrationStatusProvider);
    } catch (_) {
      setState(() => _actionError = 'Could not select that Xero organisation.');
    } finally {
      if (mounted) setState(() => _connecting = false);
    }
  }

  Future<void> _disconnectXero() async {
    setState(() {
      _disconnecting = true;
      _actionError = null;
    });

    try {
      await ref.read(integrationsRepositoryProvider).disconnectXero();
      ref.invalidate(xeroIntegrationStatusProvider);
    } catch (_) {
      setState(() => _actionError = 'Could not disconnect Xero.');
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
              Icon(Icons.receipt_long_outlined, color: p.accent),
              const SizedBox(width: MorganSpace.sm),
              Expanded(
                child: Text('Xero', style: theme.textTheme.titleMedium),
              ),
              _XeroStatusChip(status: status.status),
            ],
          ),
          const SizedBox(height: MorganSpace.sm),
          Text(
            'Sync P&L, bank transactions, and invoices from Xero for UK profit insights.',
            style: theme.textTheme.bodySmall,
          ),
          if (status.tenantName != null)
            Text('Organisation: ${status.tenantName}', style: theme.textTheme.bodySmall),
          if (status.needsReauth && status.reauthDueAt != null)
            Text(
              'Reconnection due by ${DateFormat.yMMMd().format(status.reauthDueAt!.toLocal())}',
              style: theme.textTheme.bodySmall?.copyWith(color: p.accent),
            ),
          if (status.isConnected)
            Text('Last sync: $lastSyncLabel', style: theme.textTheme.bodySmall),
          if (status.isConnected && !status.booksInitialSyncCompleted)
            Text(
              'Syncing month-to-date P&L, bank transactions, and invoices…',
              style: theme.textTheme.bodySmall?.copyWith(color: p.accent),
            ),
          if (displayError != null) ...[
            const SizedBox(height: MorganSpace.xs),
            Text(displayError, style: theme.textTheme.bodySmall?.copyWith(color: p.loss)),
          ],
          const SizedBox(height: MorganSpace.md),
          if (status.needsTenantSelection)
            MorganPrimaryButton(
              label: 'Select organisation',
              onPressed: _connecting ? null : _showTenantPicker,
            )
          else if (status.status == IntegrationStatus.disconnected)
            MorganPrimaryButton(
              label: _connecting ? 'Connecting…' : 'Connect',
              onPressed: _connecting ? null : _connectXero,
            )
          else if (status.status == IntegrationStatus.error || status.needsReauth)
            MorganPrimaryButton(
              label: _connecting ? 'Reconnecting…' : 'Reconnect',
              onPressed: _connecting ? null : _connectXero,
            )
          else ...[
            TextButton(
              onPressed: () => context.push('/settings/integrations/xero/mapping'),
              child: const Text('Map accounts'),
            ),
            TextButton(
              onPressed: _disconnecting ? null : _disconnectXero,
              child: Text(_disconnecting ? 'Disconnecting…' : 'Disconnect'),
            ),
          ],
        ],
      ),
    );
  }
}

class _XeroStatusChip extends StatelessWidget {
  const _XeroStatusChip({required this.status});

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
