import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/cash/cash_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_surface.dart';

class CashReconciliationPanel extends ConsumerStatefulWidget {
  const CashReconciliationPanel({
    super.key,
    required this.data,
    this.onChanged,
  });

  final UnmatchedCash data;
  final VoidCallback? onChanged;

  @override
  ConsumerState<CashReconciliationPanel> createState() => _CashReconciliationPanelState();
}

class _CashReconciliationPanelState extends ConsumerState<CashReconciliationPanel> {
  String? _selectedPayoutId;
  String? _selectedDepositId;
  bool _busy = false;

  UnmatchedCash get data => widget.data;

  CashPayoutSummary? get _selectedPayout {
    for (final payout in data.unmatchedPayouts) {
      if (payout.id == _selectedPayoutId) return payout;
    }
    return null;
  }

  CashDepositSummary? get _selectedDeposit {
    for (final deposit in data.unmatchedDeposits) {
      if (deposit.id == _selectedDepositId) return deposit;
    }
    return null;
  }

  Future<void> _confirmAndLink() async {
    final payout = _selectedPayout;
    final deposit = _selectedDeposit;
    if (payout == null || deposit == null) return;

    final money = NumberFormat.simpleCurrency();
    final payoutAmount = double.tryParse(payout.amount) ?? 0;
    final depositAmount = double.tryParse(deposit.amount) ?? 0;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm match'),
        content: Text(
          'Link Shopify payout ${money.format(payoutAmount)} '
          '(${DateFormat.yMMMd().format(payout.issuedAt)}) to bank deposit '
          '${money.format(depositAmount)} (${deposit.date})?',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Confirm link')),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _busy = true);
    try {
      await ref.read(cashRepositoryProvider).linkMatch(
            shopifyPayoutId: payout.id,
            plaidTransactionId: deposit.id,
          );
      ref.invalidate(unmatchedCashProvider);
      ref.invalidate(cashOverviewProvider);
      widget.onChanged?.call();
      setState(() {
        _selectedPayoutId = null;
        _selectedDepositId = null;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Payout and deposit linked.')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not link payout and deposit.')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirmAndUnlink(CashMatchedPair match) async {
    final money = NumberFormat.simpleCurrency();
    final payoutAmount = double.tryParse(match.payout.amount) ?? 0;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Unlink match'),
        content: Text(
          'Remove the link between payout ${money.format(payoutAmount)} '
          'and deposit on ${match.deposit.date}?',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Confirm unlink')),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _busy = true);
    try {
      await ref.read(cashRepositoryProvider).unlinkMatch(match.id);
      ref.invalidate(unmatchedCashProvider);
      ref.invalidate(cashOverviewProvider);
      widget.onChanged?.call();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Match removed.')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not unlink match.')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final money = NumberFormat.simpleCurrency();

    if (!data.bankConnected) {
      return MorganSurface(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Connect your bank to match Shopify payouts to deposits.', style: theme.textTheme.bodyMedium),
            const SizedBox(height: MorganSpace.md),
            MorganPrimaryButton(
              label: 'Connect bank',
              onPressed: () => context.push('/settings/integrations'),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        MorganSurface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Reconciliation status', style: theme.textTheme.titleMedium),
              const SizedBox(height: MorganSpace.sm),
              Text(
                '${data.matchedCount} matched · ${data.unmatchedPayoutCount} unmatched payouts · ${data.unmatchedDepositCount} unmatched deposits',
                style: theme.textTheme.bodySmall,
              ),
              if (data.hasReconciliationGaps) ...[
                const SizedBox(height: MorganSpace.sm),
                Text(
                  'Select a payout and deposit below, then confirm the link.',
                  style: theme.textTheme.bodySmall?.copyWith(color: p.warning),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: MorganSpace.xl),
        const MorganSectionHeader(title: 'Unmatched payouts'),
        const SizedBox(height: MorganSpace.sm),
        if (data.unmatchedPayouts.isEmpty)
          Text('All payouts are matched.', style: theme.textTheme.bodySmall)
        else
          ...data.unmatchedPayouts.map((payout) {
            final amount = double.tryParse(payout.amount) ?? 0;
            final selected = _selectedPayoutId == payout.id;
            return Padding(
              padding: const EdgeInsets.only(bottom: MorganSpace.sm),
              child: MorganSurface(
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(money.format(amount)),
                  subtitle: Text(DateFormat.yMMMd().format(payout.issuedAt)),
                  trailing: Icon(
                    selected ? Icons.radio_button_checked : Icons.radio_button_off,
                    color: selected ? p.accent : p.textMuted,
                  ),
                  onTap: _busy ? null : () => setState(() => _selectedPayoutId = payout.id),
                ),
              ),
            );
          }),
        const SizedBox(height: MorganSpace.xl),
        const MorganSectionHeader(title: 'Unmatched deposits'),
        const SizedBox(height: MorganSpace.sm),
        if (data.unmatchedDeposits.isEmpty)
          Text('All deposits are matched.', style: theme.textTheme.bodySmall)
        else
          ...data.unmatchedDeposits.map((deposit) {
            final amount = double.tryParse(deposit.amount) ?? 0;
            final selected = _selectedDepositId == deposit.id;
            return Padding(
              padding: const EdgeInsets.only(bottom: MorganSpace.sm),
              child: MorganSurface(
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(money.format(amount)),
                  subtitle: Text('${deposit.date} · ${deposit.name}'),
                  trailing: Icon(
                    selected ? Icons.radio_button_checked : Icons.radio_button_off,
                    color: selected ? p.accent : p.textMuted,
                  ),
                  onTap: _busy ? null : () => setState(() => _selectedDepositId = deposit.id),
                ),
              ),
            );
          }),
        if (data.unmatchedPayouts.isNotEmpty && data.unmatchedDeposits.isNotEmpty) ...[
          const SizedBox(height: MorganSpace.lg),
          MorganPrimaryButton(
            label: _busy ? 'Linking…' : 'Confirm link',
            onPressed: _selectedPayoutId != null && _selectedDepositId != null && !_busy
                ? _confirmAndLink
                : null,
          ),
        ],
        const SizedBox(height: MorganSpace.xl),
        const MorganSectionHeader(title: 'Matched'),
        const SizedBox(height: MorganSpace.sm),
        if (data.matched.isEmpty)
          Text('No matched pairs yet.', style: theme.textTheme.bodySmall)
        else
          ...data.matched.map((match) {
            final payoutAmount = double.tryParse(match.payout.amount) ?? 0;
            return Padding(
              padding: const EdgeInsets.only(bottom: MorganSpace.sm),
              child: MorganSurface(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(money.format(payoutAmount), style: theme.textTheme.titleMedium),
                    const SizedBox(height: MorganSpace.xs),
                    Text(
                      'Payout ${DateFormat.yMMMd().format(match.payout.issuedAt)} → deposit ${match.deposit.date}',
                      style: theme.textTheme.bodySmall,
                    ),
                    Text(
                      '${match.confidenceScore.toStringAsFixed(0)}% confidence · ${match.matchSource}',
                      style: theme.textTheme.bodySmall,
                    ),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: _busy ? null : () => _confirmAndUnlink(match),
                        child: const Text('Unlink'),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
      ],
    );
  }
}
