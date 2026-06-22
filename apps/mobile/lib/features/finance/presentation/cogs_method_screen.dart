import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/finance/finance_config.dart';
import '../../../core/finance/finance_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../widgets/cogs_method_picker.dart';
import '../widgets/cogs_recalculation_banner.dart';

class CogsMethodScreen extends ConsumerStatefulWidget {
  const CogsMethodScreen({super.key});

  @override
  ConsumerState<CogsMethodScreen> createState() => _CogsMethodScreenState();
}

class _CogsMethodScreenState extends ConsumerState<CogsMethodScreen> {
  CogsMethod _selected = CogsMethod.shopify;
  double? _manualPct;
  String? _manualPctError;
  bool _quickbooksConnected = false;
  bool _xeroConnected = false;
  bool _saving = false;
  bool _loaded = false;
  bool _watchRecalculation = false;
  bool _completionHandled = false;
  String? _saveError;
  FinanceRecalculation? _recalculation;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadConfig());
  }

  Future<void> _loadConfig() async {
    try {
      final config = await ref.read(financeRepositoryProvider).getConfig();
      if (!mounted) return;
      setState(() {
        _selected = config.cogsMethod;
        _manualPct = config.manualCogsPct;
        _quickbooksConnected = config.quickbooksConnected;
        _xeroConnected = config.xeroConnected;
        _recalculation = config.recalculation;
        _watchRecalculation = config.recalculation.isActive;
        _loaded = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loaded = true);
    }
  }

  void _handleRecalculationUpdate(FinanceRecalculation recalculation) {
    if (!mounted) return;
    setState(() => _recalculation = recalculation);

    if (recalculation.status == FinanceRecalculationStatus.completed && !_completionHandled) {
      _completionHandled = true;
      ref.invalidate(financeConfigProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profit metrics updated with your new COGS method')),
      );
      Future<void>.delayed(const Duration(seconds: 2), () {
        if (mounted) context.pop();
      });
    }
  }

  Future<void> _save() async {
    if (_selected == CogsMethod.manualPct) {
      final error = validateManualCogsPct(_manualPct);
      if (error != null) {
        setState(() => _manualPctError = error);
        return;
      }
    }

    setState(() {
      _saving = true;
      _saveError = null;
      _manualPctError = null;
      _completionHandled = false;
    });

    try {
      final updated = await ref.read(financeRepositoryProvider).updateConfig(
            UpdateFinanceConfigRequest(
              cogsMethod: _selected,
              manualCogsPct: _selected == CogsMethod.manualPct ? _manualPct : null,
            ),
          );

      ref.invalidate(financeConfigProvider);

      if (!mounted) return;

      setState(() {
        _recalculation = updated.recalculation;
        _watchRecalculation = updated.recalculation.isActive;
      });

      if (!updated.recalculation.isActive) {
        context.pop();
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _saveError = 'Could not save COGS method. Try again.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    if (_watchRecalculation) {
      ref.listen<AsyncValue<FinanceRecalculation>>(
        financeRecalculationPollerProvider,
        (_, next) => next.whenData(_handleRecalculationUpdate),
      );
      ref.watch(financeRecalculationPollerProvider);
    }

    final recalculation = _recalculation;
    final recalcActive = recalculation?.isActive ?? false;

    return Scaffold(
      backgroundColor: p.background,
      appBar: AppBar(
        backgroundColor: p.background,
        elevation: 0,
        title: Text('COGS method', style: theme.textTheme.titleMedium),
      ),
      body: SafeArea(
        child: !_loaded
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.fromLTRB(
                  MorganSpace.screenH,
                  MorganSpace.md,
                  MorganSpace.screenH,
                  MorganSpace.huge,
                ),
                children: [
                  Text(
                    'How should Morgan calculate product costs?',
                    style: theme.textTheme.headlineSmall,
                  ),
                  const SizedBox(height: MorganSpace.sm),
                  Text(
                    'This drives profit and margin numbers across your briefings.',
                    style: theme.textTheme.bodyLarge,
                  ),
                  if (recalculation != null &&
                      (recalculation.isActive ||
                          recalculation.status == FinanceRecalculationStatus.completed)) ...[
                    const SizedBox(height: MorganSpace.lg),
                    CogsRecalculationBanner(recalculation: recalculation),
                  ],
                  const SizedBox(height: MorganSpace.xl),
                  CogsMethodPicker(
                    selected: _selected,
                    quickbooksConnected: _quickbooksConnected,
                    xeroConnected: _xeroConnected,
                    manualPct: _manualPct,
                    manualPctError: _manualPctError,
                    onSelected: (method) => setState(() {
                      _selected = method;
                      _manualPctError = null;
                    }),
                    onManualPctChanged: (value) => setState(() {
                      _manualPct = value;
                      _manualPctError = null;
                    }),
                  ),
                  if (_saveError != null) ...[
                    const SizedBox(height: MorganSpace.md),
                    Text(_saveError!, style: theme.textTheme.bodyMedium?.copyWith(color: p.loss)),
                  ],
                  const SizedBox(height: MorganSpace.xl),
                  MorganPrimaryButton(
                    label: _saving
                        ? 'Saving…'
                        : recalcActive
                            ? 'Recalculating…'
                            : 'Save',
                    onPressed: _saving || recalcActive ? null : _save,
                  ),
                ],
              ),
      ),
    );
  }
}
