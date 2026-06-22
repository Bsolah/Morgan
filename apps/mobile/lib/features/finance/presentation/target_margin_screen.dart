import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/finance/finance_config.dart';
import '../../../core/finance/finance_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../../../shared/widgets/morgan_error_state.dart';
import '../../../shared/widgets/morgan_surface.dart';

class TargetMarginScreen extends ConsumerStatefulWidget {
  const TargetMarginScreen({super.key});

  @override
  ConsumerState<TargetMarginScreen> createState() => _TargetMarginScreenState();
}

class _TargetMarginScreenState extends ConsumerState<TargetMarginScreen> {
  static const _defaultTarget = 40.0;

  final _controller = TextEditingController(text: _defaultTarget.toStringAsFixed(0));
  double _sliderValue = _defaultTarget;
  String? _inputError;
  bool _loaded = false;
  bool _saving = false;
  String? _saveError;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

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
        _sliderValue = config.targetContributionMarginPct;
        _controller.text = config.targetContributionMarginPct.toStringAsFixed(0);
        _loaded = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loaded = true);
    }
  }

  void _syncFromSlider(double value) {
    setState(() {
      _sliderValue = value;
      _controller.text = value.round().toString();
      _inputError = null;
    });
  }

  void _syncFromField(String value) {
    final parsed = double.tryParse(value.trim());
    if (parsed == null) return;
    setState(() {
      _sliderValue = parsed.clamp(0, 100);
      _inputError = null;
    });
  }

  Future<void> _save() async {
    final parsed = double.tryParse(_controller.text.trim());
    final error = validateTargetMarginPct(parsed);
    if (error != null) {
      setState(() => _inputError = error);
      return;
    }

    setState(() {
      _saving = true;
      _saveError = null;
      _inputError = null;
    });

    try {
      await ref.read(financeRepositoryProvider).updateTargetMargin(
            UpdateTargetMarginRequest(targetContributionMarginPct: parsed!),
          );
      ref.invalidate(financeConfigProvider);
      if (!mounted) return;
      context.pop();
    } catch (_) {
      if (!mounted) return;
      setState(() => _saveError = 'Could not save target margin. Try again.');
      showMorganSaveErrorSnackBar(context, message: 'Could not save target margin. Try again.');
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
        title: Text('Target margin', style: theme.textTheme.titleMedium),
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
                    'Set your contribution margin goal',
                    style: theme.textTheme.headlineSmall,
                  ),
                  const SizedBox(height: MorganSpace.sm),
                  Text(
                    'Profit dashboards and briefings use this target to track progress and surface alerts.',
                    style: theme.textTheme.bodyLarge,
                  ),
                  const SizedBox(height: MorganSpace.xl),
                  MorganSurface(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Target contribution margin', style: theme.textTheme.labelMedium),
                        const SizedBox(height: MorganSpace.md),
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _controller,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                inputFormatters: [
                                  FilteringTextInputFormatter.allow(RegExp(r'^\d{0,3}(\.\d{0,1})?')),
                                ],
                                decoration: InputDecoration(
                                  suffixText: '%',
                                  errorText: _inputError,
                                  hintText: '40',
                                ),
                                onChanged: _syncFromField,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: MorganSpace.lg),
                        Slider(
                          value: _sliderValue,
                          min: 0,
                          max: 100,
                          divisions: 100,
                          label: '${_sliderValue.round()}%',
                          onChanged: _syncFromSlider,
                        ),
                        Text(
                          'Briefings and profit alerts will flag when margin falls below ${_sliderValue.round()}%.',
                          style: theme.textTheme.bodySmall?.copyWith(color: p.accent),
                        ),
                        const SizedBox(height: MorganSpace.sm),
                        Text(
                          'Default is 40%. Enter any value from 0–100%.',
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
                    ),
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
