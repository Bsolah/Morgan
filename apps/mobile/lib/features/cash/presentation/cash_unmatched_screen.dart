import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/cash/cash_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_detail_app_bar.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_surface.dart';
import 'cash_reconciliation_panel.dart';

class CashUnmatchedScreen extends ConsumerWidget {
  const CashUnmatchedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final unmatchedAsync = ref.watch(unmatchedCashProvider);

    return Scaffold(
      backgroundColor: p.background,
      appBar: const MorganDetailAppBar(title: 'Unmatched transactions', fallbackRoute: '/cash'),
      body: SafeArea(
        child: unmatchedAsync.when(
          loading: () => Center(child: CircularProgressIndicator(color: p.accent)),
          error: (_, __) => Center(
            child: Text('Could not load unmatched transactions.', style: theme.textTheme.bodyMedium),
          ),
          data: (data) {
            if (!data.hasReconciliationGaps) {
              return Padding(
                padding: const EdgeInsets.all(MorganSpace.screenH),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: p.profitMuted,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.check_rounded, color: p.profit, size: 28),
                    ),
                    const SizedBox(height: MorganSpace.md),
                    Text(
                      'All matched',
                      style: theme.textTheme.titleMedium,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: MorganSpace.xs),
                    Text(
                      'Every payout and deposit is reconciled.',
                      style: theme.textTheme.bodyMedium,
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              );
            }

            final rows = _buildUnmatchedRows(data);

            return ListView(
              padding: const EdgeInsets.fromLTRB(
                MorganSpace.screenH,
                MorganSpace.md,
                MorganSpace.screenH,
                MorganSpace.huge,
              ),
              children: [
                const MorganScreenHeader(
                  title: 'Fix reconciliation gaps',
                  subtitle: 'Match Shopify payouts to bank deposits',
                ),
                const MorganSectionHeader(title: 'Unmatched'),
                ...rows.map(
                  (row) => Padding(
                    padding: const EdgeInsets.only(bottom: MorganSpace.sm),
                    child: _UnmatchedTransactionRow(row: row),
                  ),
                ),
                const SizedBox(height: MorganSpace.lg),
                CashReconciliationPanel(data: data),
              ],
            );
          },
        ),
      ),
    );
  }

  List<_UnmatchedRowData> _buildUnmatchedRows(UnmatchedCash data) {
    final money = NumberFormat.simpleCurrency();
    final rows = <_UnmatchedRowData>[];

    for (final payout in data.unmatchedPayouts) {
      final amount = double.tryParse(payout.amount) ?? 0;
      final suggestion = _bestDepositMatch(payout, data.unmatchedDeposits, money);
      rows.add(
        _UnmatchedRowData(
          date: DateFormat.yMMMd().format(payout.issuedAt),
          amount: money.format(amount),
          isOutflow: amount < 0,
          counterparty: 'Shopify payout',
          matchSuggestion: suggestion,
        ),
      );
    }

    for (final deposit in data.unmatchedDeposits) {
      final amount = double.tryParse(deposit.amount) ?? 0;
      final suggestion = _bestPayoutMatch(deposit, data.unmatchedPayouts, money);
      rows.add(
        _UnmatchedRowData(
          date: deposit.date,
          amount: money.format(amount),
          isOutflow: amount < 0,
          counterparty: deposit.merchantName ?? deposit.name,
          matchSuggestion: suggestion,
        ),
      );
    }

    return rows;
  }

  String _bestDepositMatch(
    CashPayoutSummary payout,
    List<CashDepositSummary> deposits,
    NumberFormat money,
  ) {
    if (deposits.isEmpty) return 'No deposit candidate';

    final payoutAmount = double.tryParse(payout.amount) ?? 0;
    CashDepositSummary? closest;
    var closestDelta = double.infinity;

    for (final deposit in deposits) {
      final depositAmount = double.tryParse(deposit.amount) ?? 0;
      final delta = (depositAmount - payoutAmount).abs();
      if (delta < closestDelta) {
        closestDelta = delta;
        closest = deposit;
      }
    }

    if (closest == null) return 'Match deposit';
    final depositAmount = double.tryParse(closest.amount) ?? 0;
    return 'Likely ${money.format(depositAmount)} on ${closest.date}';
  }

  String _bestPayoutMatch(
    CashDepositSummary deposit,
    List<CashPayoutSummary> payouts,
    NumberFormat money,
  ) {
    if (payouts.isEmpty) return 'Match payout';

    final depositAmount = double.tryParse(deposit.amount) ?? 0;
    CashPayoutSummary? closest;
    var closestDelta = double.infinity;

    for (final payout in payouts) {
      final payoutAmount = double.tryParse(payout.amount) ?? 0;
      final delta = (payoutAmount - depositAmount).abs();
      if (delta < closestDelta) {
        closestDelta = delta;
        closest = payout;
      }
    }

    if (closest == null) return 'Match payout';
    final payoutAmount = double.tryParse(closest.amount) ?? 0;
    return 'Likely payout ${money.format(payoutAmount)}';
  }
}

class _UnmatchedRowData {
  const _UnmatchedRowData({
    required this.date,
    required this.amount,
    required this.isOutflow,
    required this.counterparty,
    required this.matchSuggestion,
  });

  final String date;
  final String amount;
  final bool isOutflow;
  final String counterparty;
  final String matchSuggestion;
}

class _UnmatchedTransactionRow extends StatelessWidget {
  const _UnmatchedTransactionRow({required this.row});

  final _UnmatchedRowData row;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return MorganSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(row.date, style: theme.textTheme.labelMedium?.copyWith(color: p.textMuted)),
              ),
              Text(
                row.amount,
                style: theme.textTheme.titleSmall?.copyWith(
                  color: row.isOutflow ? p.loss : p.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: MorganSpace.xxs),
          Text(row.counterparty, style: theme.textTheme.titleSmall),
          const SizedBox(height: MorganSpace.xxs),
          Text(
            row.matchSuggestion,
            style: theme.textTheme.bodySmall?.copyWith(color: p.accent),
          ),
        ],
      ),
    );
  }
}
