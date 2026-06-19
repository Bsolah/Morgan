import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../core/finance/finance_config.dart';
import '../../../core/finance/finance_repository.dart';

class CogsMethodPicker extends StatefulWidget {
  const CogsMethodPicker({
    super.key,
    required this.selected,
    required this.quickbooksConnected,
    required this.xeroConnected,
    required this.onSelected,
    this.manualPct,
    this.onManualPctChanged,
    this.manualPctError,
  });

  final CogsMethod selected;
  final bool quickbooksConnected;
  final bool xeroConnected;
  final ValueChanged<CogsMethod> onSelected;
  final double? manualPct;
  final ValueChanged<double?>? onManualPctChanged;
  final String? manualPctError;

  @override
  State<CogsMethodPicker> createState() => _CogsMethodPickerState();
}

class _CogsMethodPickerState extends State<CogsMethodPicker> {
  late final TextEditingController _manualPctController;

  @override
  void initState() {
    super.initState();
    _manualPctController = TextEditingController(text: _formatPct(widget.manualPct));
  }

  @override
  void didUpdateWidget(CogsMethodPicker oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.manualPct != oldWidget.manualPct) {
      final formatted = _formatPct(widget.manualPct);
      if (_manualPctController.text != formatted) {
        _manualPctController.text = formatted;
      }
    }
  }

  @override
  void dispose() {
    _manualPctController.dispose();
    super.dispose();
  }

  String _formatPct(double? value) {
    if (value == null) return '';
    return value % 1 == 0 ? value.toStringAsFixed(0) : value.toStringAsFixed(1);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final method in CogsMethod.values) ...[
          _CogsOptionTile(
            method: method,
            selected: widget.selected == method,
            disabled: (method == CogsMethod.qbo && !widget.quickbooksConnected) ||
                (method == CogsMethod.xero && !widget.xeroConnected),
            onTap: () {
              if (method == CogsMethod.qbo && !widget.quickbooksConnected) return;
              if (method == CogsMethod.xero && !widget.xeroConnected) return;
              widget.onSelected(method);
            },
          ),
          if (method != CogsMethod.values.last) const SizedBox(height: MorganSpace.sm),
        ],
        if (widget.selected == CogsMethod.manualPct) ...[
          const SizedBox(height: MorganSpace.lg),
          Text('Cost percentage', style: theme.textTheme.titleSmall),
          const SizedBox(height: MorganSpace.sm),
          TextField(
            controller: _manualPctController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'^\d{0,3}(\.\d{0,2})?')),
            ],
            decoration: InputDecoration(
              labelText: 'Manual COGS %',
              hintText: 'e.g. 35',
              suffixText: '%',
              errorText: widget.manualPctError,
              filled: true,
              fillColor: p.surfaceMuted,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(MorganRadius.sm),
                borderSide: BorderSide(color: p.borderSubtle),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(MorganRadius.sm),
                borderSide: BorderSide(color: p.borderSubtle),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(MorganRadius.sm),
                borderSide: BorderSide(color: p.accent, width: 1.5),
              ),
            ),
            onChanged: (value) {
              if (value.isEmpty) {
                widget.onManualPctChanged?.call(null);
                return;
              }
              widget.onManualPctChanged?.call(double.tryParse(value));
            },
          ),
          const SizedBox(height: MorganSpace.xs),
          Text(
            'Enter a value from 0 to 100.',
            style: theme.textTheme.bodySmall,
          ),
        ],
      ],
    );
  }
}

class _CogsOptionTile extends StatelessWidget {
  const _CogsOptionTile({
    required this.method,
    required this.selected,
    required this.disabled,
    required this.onTap,
  });

  final CogsMethod method;
  final bool selected;
  final bool disabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return Material(
      color: selected ? p.accentMuted : p.surfaceMuted,
      borderRadius: BorderRadius.circular(MorganRadius.md),
      child: InkWell(
        onTap: disabled ? null : onTap,
        borderRadius: BorderRadius.circular(MorganRadius.md),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(MorganSpace.card),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(MorganRadius.md),
            border: Border.all(
              color: selected ? p.accent : p.borderSubtle,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          method.label,
                          style: theme.textTheme.titleSmall?.copyWith(
                            color: disabled ? p.textMuted : p.textPrimary,
                          ),
                        ),
                        if (disabled) ...[
                          const SizedBox(width: MorganSpace.xs),
                          Text(
                            method == CogsMethod.xero ? 'Connect Xero' : 'Connect QuickBooks',
                            style: theme.textTheme.labelSmall?.copyWith(color: p.textMuted),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: MorganSpace.xs),
                    Text(
                      method.description,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: disabled ? p.textMuted : p.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: MorganSpace.sm),
              Icon(
                selected ? Icons.radio_button_checked : Icons.radio_button_off,
                color: disabled ? p.textMuted : (selected ? p.accent : p.textMuted),
                size: 22,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String? validateManualCogsPct(double? value) {
  if (value == null) return 'Enter a percentage between 0 and 100';
  if (value < 0 || value > 100) return 'Enter a value between 0 and 100';
  return null;
}
