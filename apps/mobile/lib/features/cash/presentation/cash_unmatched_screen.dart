import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cash/cash_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_section_header.dart';
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
      appBar: AppBar(
        backgroundColor: p.background,
        foregroundColor: p.textPrimary,
        title: const Text('Unmatched transactions'),
      ),
      body: SafeArea(
        child: unmatchedAsync.when(
          loading: () => Center(child: CircularProgressIndicator(color: p.accent)),
          error: (_, __) => Center(
            child: Text('Could not load unmatched transactions.', style: theme.textTheme.bodyMedium),
          ),
          data: (data) {
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
                CashReconciliationPanel(data: data),
              ],
            );
          },
        ),
      ),
    );
  }
}
