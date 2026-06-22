import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/inventory/inventory_config_repository.dart';
import '../../../core/inventory/inventory_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_detail_app_bar.dart';
import '../../../shared/widgets/morgan_error_state.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../../../shared/widgets/morgan_icon_button.dart';
import '../../../shared/widgets/morgan_surface.dart';

class InventorySettingsScreen extends ConsumerStatefulWidget {
  const InventorySettingsScreen({super.key});

  @override
  ConsumerState<InventorySettingsScreen> createState() => _InventorySettingsScreenState();
}

class _InventorySettingsScreenState extends ConsumerState<InventorySettingsScreen> {
  final _defaultLeadTimeController = TextEditingController();
  bool _loaded = false;
  bool _savingDefault = false;
  String? _saveError;
  List<SkuLeadTimeOverride> _overrides = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadConfig());
  }

  @override
  void dispose() {
    _defaultLeadTimeController.dispose();
    super.dispose();
  }

  Future<void> _loadConfig() async {
    try {
      final config = await ref.read(inventoryConfigRepositoryProvider).getConfig();
      if (!mounted) return;
      setState(() {
        _defaultLeadTimeController.text = '${config.defaultLeadTimeDays}';
        _overrides = config.skuOverrides;
        _loaded = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loaded = true);
    }
  }

  int? _parseLeadTime(String value) {
    final parsed = int.tryParse(value.trim());
    if (parsed == null || parsed < 1 || parsed > 365) return null;
    return parsed;
  }

  Future<void> _saveDefaultLeadTime() async {
    final days = _parseLeadTime(_defaultLeadTimeController.text);
    if (days == null) {
      setState(() => _saveError = 'Enter a whole number between 1 and 365 days.');
      return;
    }

    setState(() {
      _savingDefault = true;
      _saveError = null;
    });

    try {
      final updated = await ref.read(inventoryConfigRepositoryProvider).updateDefaultLeadTime(days);
      ref.invalidate(inventoryConfigProvider);
      ref.invalidate(inventoryHealthProvider);

      if (!mounted) return;
      setState(() {
        _overrides = updated.skuOverrides;
        _defaultLeadTimeController.text = '${updated.defaultLeadTimeDays}';
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Default lead time saved.')),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _saveError = 'Could not save default lead time. Try again.');
      showMorganSaveErrorSnackBar(context, message: 'Could not save default lead time. Try again.');
    } finally {
      if (mounted) setState(() => _savingDefault = false);
    }
  }

  Future<void> _showAddOverrideDialog() async {
    final skuController = TextEditingController();
    final daysController = TextEditingController();
    String? dialogError;

    final saved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('Add SKU override'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: skuController,
                    decoration: const InputDecoration(labelText: 'SKU'),
                    textCapitalization: TextCapitalization.characters,
                  ),
                  const SizedBox(height: MorganSpace.md),
                  TextField(
                    controller: daysController,
                    decoration: const InputDecoration(labelText: 'Lead time (days)'),
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  ),
                  if (dialogError != null) ...[
                    const SizedBox(height: MorganSpace.sm),
                    Text(dialogError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  ],
                ],
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')),
                TextButton(
                  onPressed: () async {
                    final sku = skuController.text.trim();
                    final days = _parseLeadTime(daysController.text);
                    if (sku.isEmpty || days == null) {
                      setDialogState(() => dialogError = 'Enter a SKU and lead time between 1 and 365 days.');
                      return;
                    }

                    try {
                      final updated = await ref
                          .read(inventoryConfigRepositoryProvider)
                          .upsertSkuOverride(sku, days);
                      ref.invalidate(inventoryConfigProvider);
                      ref.invalidate(inventoryHealthProvider);
                      if (!mounted) return;
                      setState(() => _overrides = updated.skuOverrides);
                      if (dialogContext.mounted) Navigator.pop(dialogContext, true);
                    } catch (_) {
                      setDialogState(() => dialogError = 'Could not save override. Try again.');
                    }
                  },
                  child: const Text('Save'),
                ),
              ],
            );
          },
        );
      },
    );

    if (saved == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('SKU lead time override saved.')),
      );
    }
  }

  Future<void> _deleteOverride(String sku) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Remove override?'),
        content: Text('$sku will use the default lead time again.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Remove')),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      final updated = await ref.read(inventoryConfigRepositoryProvider).deleteSkuOverride(sku);
      ref.invalidate(inventoryConfigProvider);
      ref.invalidate(inventoryHealthProvider);
      if (!mounted) return;
      setState(() => _overrides = updated.skuOverrides);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not remove override. Try again.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: p.background,
      appBar: const MorganDetailAppBar(title: 'Inventory', fallbackRoute: '/inventory'),
      body: SafeArea(
        child: !_loaded
            ? Center(child: CircularProgressIndicator(color: p.accent))
            : ListView(
                padding: const EdgeInsets.fromLTRB(
                  MorganSpace.screenH,
                  MorganSpace.md,
                  MorganSpace.screenH,
                  MorganSpace.huge,
                ),
                children: [
                  Text(
                    'Supplier lead times',
                    style: theme.textTheme.headlineSmall,
                  ),
                  const SizedBox(height: MorganSpace.sm),
                  Text(
                    'Set how long replenishment takes. Morgan uses this for safety stock and reorder-by dates.',
                    style: theme.textTheme.bodyLarge,
                  ),
                  const SizedBox(height: MorganSpace.xl),
                  MorganSurface(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Default lead time', style: theme.textTheme.labelMedium),
                        const SizedBox(height: MorganSpace.md),
                        TextField(
                          controller: _defaultLeadTimeController,
                          decoration: const InputDecoration(
                            labelText: 'Days',
                            helperText: 'Used for all SKUs unless overridden below',
                          ),
                          keyboardType: TextInputType.number,
                          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                        ),
                        if (_saveError != null) ...[
                          const SizedBox(height: MorganSpace.sm),
                          Text(_saveError!, style: theme.textTheme.bodyMedium?.copyWith(color: p.loss)),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: MorganSpace.xl),
                  MorganPrimaryButton(
                    label: _savingDefault ? 'Saving…' : 'Save',
                    onPressed: _savingDefault ? null : _saveDefaultLeadTime,
                  ),
                  const SizedBox(height: MorganSpace.xl),
                  Row(
                    children: [
                      Expanded(child: Text('SKU OVERRIDES', style: theme.textTheme.labelMedium)),
                      TextButton(onPressed: _showAddOverrideDialog, child: const Text('Add')),
                    ],
                  ),
                  const SizedBox(height: MorganSpace.sm),
                  if (_overrides.isEmpty)
                    MorganSurface(
                      child: Text(
                        'No per-SKU overrides yet. Add one when a supplier takes longer or shorter than the default.',
                        style: theme.textTheme.bodyMedium,
                      ),
                    )
                  else
                    MorganSurface(
                      padding: EdgeInsets.zero,
                      child: Column(
                        children: [
                          for (var index = 0; index < _overrides.length; index++) ...[
                            if (index > 0) Divider(height: 1, color: p.borderSubtle, indent: MorganSpace.card),
                            ListTile(
                              title: Text(_overrides[index].sku, style: theme.textTheme.titleSmall),
                              subtitle: Text(
                                '${_overrides[index].leadTimeDays} days',
                                style: theme.textTheme.bodySmall,
                              ),
                              trailing: MorganIconButton(
                                icon: Icons.delete_outline_rounded,
                                label: 'Remove lead time override for ${_overrides[index].sku}',
                                onPressed: () => _deleteOverride(_overrides[index].sku),
                                iconSize: 22,
                                color: p.textMuted,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                ],
              ),
      ),
    );
  }
}
