import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/finance/finance_config.dart';
import '../../../core/finance/finance_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../widgets/cogs_method_picker.dart';

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
  String? _saveError;

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
        _loaded = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loaded = true);
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

      if (updated.recalculationDueBy != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profit metrics will refresh within the next hour.'),
          ),
        );
      }

      context.pop();
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
                    label: _saving ? 'Saving…' : 'Save',
                    onPressed: _saving ? null : _save,
                  ),
                ],
              ),
      ),
    );
  }
}
