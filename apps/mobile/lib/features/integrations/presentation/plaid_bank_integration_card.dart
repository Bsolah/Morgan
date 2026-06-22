import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:plaid_flutter/plaid_flutter.dart';

import '../../../core/integrations/integrations_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../../../shared/widgets/morgan_surface.dart';
import 'integration_card_shared.dart';

class PlaidBankIntegrationCard extends ConsumerStatefulWidget {
  const PlaidBankIntegrationCard({
    super.key,
    required this.status,
    this.dataCoveragePct = 0,
  });

  final PlaidIntegrationStatus status;
  final int dataCoveragePct;

  @override
  ConsumerState<PlaidBankIntegrationCard> createState() => _PlaidBankIntegrationCardState();
}

class _PlaidBankIntegrationCardState extends ConsumerState<PlaidBankIntegrationCard> {
  bool _connecting = false;
  bool _disconnecting = false;
  StreamSubscription<LinkSuccess>? _successSubscription;
  StreamSubscription<LinkExit>? _exitSubscription;

  @override
  void dispose() {
    _successSubscription?.cancel();
    _exitSubscription?.cancel();
    super.dispose();
  }

  Future<bool> _confirmPrivacyDisclosure() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        final theme = Theme.of(context);
        return AlertDialog(
          title: const Text('Before you connect your bank'),
          content: Text(widget.status.privacyDisclosure, style: theme.textTheme.bodyMedium),
          actions: [
            TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Continue')),
          ],
        );
      },
    );

    return confirmed ?? false;
  }

  Future<void> _connectPlaid() async {
    final confirmed = await _confirmPrivacyDisclosure();
    if (!confirmed || !mounted) return;

    setState(() => _connecting = true);

    try {
      final repo = ref.read(integrationsRepositoryProvider);
      final linkToken = await repo.createPlaidLinkToken();

      final completer = Completer<String?>();
      await _successSubscription?.cancel();
      await _exitSubscription?.cancel();

      _successSubscription = PlaidLink.onSuccess.listen((event) {
        if (!completer.isCompleted) completer.complete(event.publicToken);
      });
      _exitSubscription = PlaidLink.onExit.listen((event) {
        if (!completer.isCompleted) completer.complete(null);
      });

      await PlaidLink.create(
        configuration: LinkTokenConfiguration(token: linkToken.linkToken),
      );
      await PlaidLink.open();

      final publicToken = await completer.future.timeout(const Duration(minutes: 10), onTimeout: () => null);
      if (publicToken == null || publicToken.isEmpty) return;

      await repo.exchangePlaidPublicToken(publicToken);
      ref.invalidate(plaidIntegrationStatusProvider);
      ref.invalidate(integrationsHubProvider);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not connect bank account.')),
        );
      }
    } finally {
      await _successSubscription?.cancel();
      await _exitSubscription?.cancel();
      if (mounted) setState(() => _connecting = false);
    }
  }

  Future<void> _disconnectPlaid() async {
    setState(() => _disconnecting = true);
    try {
      await ref.read(integrationsRepositoryProvider).disconnectPlaid();
      ref.invalidate(plaidIntegrationStatusProvider);
      ref.invalidate(integrationsHubProvider);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not disconnect bank account.')),
        );
      }
    } finally {
      if (mounted) setState(() => _disconnecting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = widget.status;

    final detailLines = [
      if (status.displayLabel != null) status.displayLabel!,
      if (status.pendingUncategorizedCount > 0)
        '${status.pendingUncategorizedCount} transactions need classification',
      if (status.status == IntegrationStatus.disconnected) status.privacyDisclosure,
    ];

    return UnifiedIntegrationCard(
      name: 'Bank (Plaid)',
      icon: Icons.account_balance_outlined,
      status: status.status,
      dataCoveragePct: widget.dataCoveragePct,
      detailLines: detailLines,
      errorMessage: status.errorMessage,
      lastSyncAt: status.lastSyncAt,
      actions: [
        if (status.status == IntegrationStatus.disconnected)
          MorganPrimaryButton(
            label: _connecting ? 'Connecting…' : 'Connect bank',
            onPressed: _connecting ? null : _connectPlaid,
          )
        else if (status.status == IntegrationStatus.error)
          MorganPrimaryButton(
            label: _connecting ? 'Reconnecting…' : 'Reconnect',
            onPressed: _connecting ? null : _connectPlaid,
          )
        else
          TextButton(
            onPressed: _disconnecting ? null : _disconnectPlaid,
            child: Text(_disconnecting ? 'Disconnecting…' : 'Disconnect'),
          ),
      ],
    );
  }
}
