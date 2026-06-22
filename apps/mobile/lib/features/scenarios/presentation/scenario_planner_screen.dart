import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/inventory/inventory_repository.dart';
import '../../../core/scenarios/scenarios_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_surface.dart';

class ScenarioPlannerScreen extends ConsumerStatefulWidget {
  const ScenarioPlannerScreen({super.key});

  @override
  ConsumerState<ScenarioPlannerScreen> createState() => _ScenarioPlannerScreenState();
}

class _ScenarioPlannerScreenState extends ConsumerState<ScenarioPlannerScreen> {
  double _metaChangePct = 0;
  double _googleChangePct = 0;
  ScenarioRunResult? _result;
  bool _running = false;
  bool _saving = false;
  String? _error;
  final Map<String, double> _assumptionOverrides = {};

  final _skuController = TextEditingController();
  final _quantityController = TextEditingController(text: '500');
  final _unitCostController = TextEditingController();
  InventoryPurchaseRunResult? _inventoryResult;
  bool _inventoryRunning = false;
  bool _inventorySaving = false;
  String? _inventoryError;
  String? _skuLoadHint;

  @override
  void dispose() {
    _skuController.dispose();
    _quantityController.dispose();
    _unitCostController.dispose();
    super.dispose();
  }

  Future<void> _loadSkuDefaults() async {
    final sku = _skuController.text.trim();
    if (sku.isEmpty) return;

    setState(() {
      _skuLoadHint = null;
      _inventoryError = null;
    });

    try {
      final detail = await ref.read(inventoryRepositoryProvider).getSkuDetail(sku);
      if (!mounted) return;
      if (detail == null) {
        setState(() => _skuLoadHint = 'SKU not found in inventory data');
        return;
      }
      setState(() {
        _skuLoadHint = detail.title ?? '${detail.availableUnits} units on hand';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _skuLoadHint = 'Could not load SKU details');
    }
  }

  Future<void> _runInventoryScenario() async {
    final sku = _skuController.text.trim();
    final quantity = int.tryParse(_quantityController.text.trim());
    final unitCost = double.tryParse(_unitCostController.text.trim());

    if (sku.isEmpty || quantity == null || quantity <= 0 || unitCost == null || unitCost <= 0) {
      setState(() => _inventoryError = 'Enter SKU, quantity, and unit cost to run the scenario.');
      return;
    }

    setState(() {
      _inventoryRunning = true;
      _inventoryError = null;
    });

    try {
      final result = await ref.read(scenariosRepositoryProvider).runInventoryPurchaseScenario({
        'sku': sku,
        'quantity': quantity,
        'unit_cost_usd': unitCost,
        'source': 'scenario_planner',
      });

      if (!mounted) return;
      setState(() => _inventoryResult = result);
    } catch (_) {
      if (!mounted) return;
      setState(() => _inventoryError = 'Could not run inventory scenario. Check inputs and try again.');
    } finally {
      if (mounted) setState(() => _inventoryRunning = false);
    }
  }

  Future<void> _saveInventoryScenario() async {
    if (_inventoryResult == null) return;

    setState(() => _inventorySaving = true);
    try {
      await ref.read(scenariosRepositoryProvider).saveScenario({
        'scenario_type': 'inventory_purchase',
        'title': 'Buy ${_inventoryResult!.quantity} units of ${_inventoryResult!.sku}',
        'inputs': {
          'sku': _inventoryResult!.sku,
          'quantity': _inventoryResult!.quantity,
          'unit_cost_usd': _inventoryResult!.raw['unit_cost_usd'],
          'reference_day': _inventoryResult!.referenceDay,
        },
        'results': _inventoryResult!.raw,
        'source': 'scenario_planner',
      });
      ref.invalidate(savedScenariosProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Scenario saved')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not save scenario')),
      );
    } finally {
      if (mounted) setState(() => _inventorySaving = false);
    }
  }

  Future<void> _runScenario() async {
    setState(() {
      _running = true;
      _error = null;
    });

    try {
      final changes = <Map<String, dynamic>>[];
      if (_metaChangePct != 0) {
        changes.add({'channel': 'meta', 'spend_change_pct': _metaChangePct.round()});
      }
      if (_googleChangePct != 0) {
        changes.add({'channel': 'google', 'spend_change_pct': _googleChangePct.round()});
      }
      if (changes.isEmpty) {
        changes.add({'channel': 'meta', 'spend_change_pct': 0});
      }

      final result = await ref.read(scenariosRepositoryProvider).runScenario({
        'channel_changes': changes,
        if (_assumptionOverrides.isNotEmpty) 'assumption_overrides': _assumptionOverrides,
        'source': 'scenario_planner',
      });

      if (!mounted) return;
      setState(() => _result = result);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not run scenario. Check ad connections and try again.');
    } finally {
      if (mounted) setState(() => _running = false);
    }
  }

  Future<void> _saveScenario() async {
    if (_result == null || _result!.scenarios.isEmpty) return;

    setState(() => _saving = true);
    try {
      final scenario = _result!.scenarios.first;
      await ref.read(scenariosRepositoryProvider).saveScenario({
        'scenario_type': 'ad_spend',
        'channel': scenario['channel'],
        'spend_change_pct': scenario['spend_change_pct'],
        'title': _buildTitle(scenario),
        'inputs': {
          'reference_day': _result!.referenceDay,
          'assumption_items': scenario['assumption_items'],
        },
        'results': scenario,
        'source': 'scenario_planner',
      });
      ref.invalidate(savedScenariosProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Scenario saved')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not save scenario')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String _buildTitle(Map<String, dynamic> scenario) {
    final channel = scenario['channel'] as String? ?? 'ads';
    final pct = (scenario['spend_change_pct'] as num?)?.round() ?? 0;
    final label = channel == 'google' ? 'Google' : 'Meta';
    final direction = pct >= 0 ? 'increase' : 'decrease';
    return '$label spend $direction ${pct.abs()}%';
  }

  String _formatCurrency(int value) {
    final sign = value >= 0 ? '+' : '-';
    return '$sign\$${value.abs()}';
  }

  String _formatRange(int low, int high) {
    if (low == high) return _formatCurrency(low);
    final orderedLow = low < high ? low : high;
    final orderedHigh = low < high ? high : low;
    return '${_formatCurrency(orderedLow)} to ${_formatCurrency(orderedHigh)}';
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final baselinesAsync = ref.watch(scenarioBaselinesProvider);
    final scenariosAsync = ref.watch(savedScenariosProvider);

    return Scaffold(
      backgroundColor: p.background,
      appBar: AppBar(
        backgroundColor: p.background,
        foregroundColor: p.textPrimary,
        title: const Text('Scenario Planner'),
      ),
      body: SafeArea(
        child: baselinesAsync.when(
          loading: () => Center(child: CircularProgressIndicator(color: p.accent)),
          error: (_, __) => Center(
            child: Text('Could not load ad baselines.', style: theme.textTheme.bodyMedium),
          ),
          data: (baselines) {
            final meta = baselines.channels.firstWhere(
              (row) => row.channel == 'meta',
              orElse: () => const ScenarioChannelBaseline(
                channel: 'meta',
                baselineSpend7dUsd: 0,
                baselineRevenue7dUsd: 0,
                connected: false,
              ),
            );
            final google = baselines.channels.firstWhere(
              (row) => row.channel == 'google',
              orElse: () => const ScenarioChannelBaseline(
                channel: 'google',
                baselineSpend7dUsd: 0,
                baselineRevenue7dUsd: 0,
                connected: false,
              ),
            );

            return ListView(
              padding: const EdgeInsets.fromLTRB(
                MorganSpace.screenH,
                MorganSpace.md,
                MorganSpace.screenH,
                MorganSpace.huge,
              ),
              children: [
                const MorganScreenHeader(
                  title: 'Ad spend what-if',
                  subtitle: 'Model revenue, profit, and runway before you commit budget',
                ),
                MorganSurface(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Meta spend change', style: theme.textTheme.titleSmall),
                      Text(
                        meta.connected
                            ? '7d baseline \$${meta.baselineSpend7dUsd}'
                            : 'Connect Meta Ads to model spend changes',
                        style: theme.textTheme.bodySmall,
                      ),
                      Slider(
                        value: _metaChangePct,
                        min: -50,
                        max: 100,
                        divisions: 30,
                        label: '${_metaChangePct.round()}%',
                        onChanged: meta.connected ? (value) => setState(() => _metaChangePct = value) : null,
                      ),
                      Text('${_metaChangePct.round()}%', style: theme.textTheme.titleMedium),
                      const SizedBox(height: MorganSpace.md),
                      Text('Google spend change', style: theme.textTheme.titleSmall),
                      Text(
                        google.connected
                            ? '7d baseline \$${google.baselineSpend7dUsd}'
                            : 'Connect Google Ads to model spend changes',
                        style: theme.textTheme.bodySmall,
                      ),
                      Slider(
                        value: _googleChangePct,
                        min: -50,
                        max: 100,
                        divisions: 30,
                        label: '${_googleChangePct.round()}%',
                        onChanged:
                            google.connected ? (value) => setState(() => _googleChangePct = value) : null,
                      ),
                      Text('${_googleChangePct.round()}%', style: theme.textTheme.titleMedium),
                      const SizedBox(height: MorganSpace.md),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: _running ? null : _runScenario,
                          child: _running
                              ? SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: p.accentOn),
                                )
                              : const Text('Run scenario'),
                        ),
                      ),
                    ],
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: MorganSpace.md),
                  Text(_error!, style: theme.textTheme.bodyMedium?.copyWith(color: p.loss)),
                ],
                if (_result != null) ...[
                  const SizedBox(height: MorganSpace.lg),
                  MorganSurface(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Projected impact (7d)', style: theme.textTheme.titleMedium),
                        const SizedBox(height: MorganSpace.md),
                        _ResultRow(
                          label: 'Revenue',
                          value: _formatRange(
                            _result!.combined.revenueChangeLowUsd,
                            _result!.combined.revenueChangeHighUsd,
                          ),
                        ),
                        _ResultRow(
                          label: 'Profit',
                          value: _formatRange(
                            _result!.combined.profitChangeLowUsd,
                            _result!.combined.profitChangeHighUsd,
                          ),
                          valueColor: p.profit,
                        ),
                        _ResultRow(
                          label: 'Cash',
                          value: _formatRange(
                            _result!.combined.cashImpactLowUsd,
                            _result!.combined.cashImpactHighUsd,
                          ),
                        ),
                        if (_result!.combined.runwayDaysDeltaLow != null &&
                            _result!.combined.runwayDaysDeltaHigh != null)
                          _ResultRow(
                            label: 'Runway',
                            value:
                                '${_result!.combined.runwayDaysDeltaLow!.toStringAsFixed(1)} to ${_result!.combined.runwayDaysDeltaHigh!.toStringAsFixed(1)} days',
                          ),
                        const SizedBox(height: MorganSpace.md),
                        Text('ASSUMPTIONS', style: theme.textTheme.labelSmall),
                        const SizedBox(height: MorganSpace.xs),
                        ..._result!.scenarios.expand((scenario) {
                          final items = (scenario['assumption_items'] as List<dynamic>? ?? const [])
                              .whereType<Map<String, dynamic>>();
                          return items.where((item) => item['editable'] == true).map((item) {
                            final key = item['key'] as String? ?? '';
                            final channel = scenario['channel'] as String? ?? '';
                            final overrideKey = channel == 'google' ? 'google_$key' : 'meta_$key';
                            final value = (item['value'] as num?)?.toDouble() ?? 0;
                            return Padding(
                              padding: const EdgeInsets.only(bottom: MorganSpace.sm),
                              child: TextFormField(
                                initialValue: value.toStringAsFixed(2),
                                decoration: InputDecoration(
                                  labelText: item['label'] as String? ?? key,
                                  isDense: true,
                                ),
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                onChanged: (text) {
                                  final parsed = double.tryParse(text);
                                  if (parsed != null) {
                                    _assumptionOverrides[overrideKey] = parsed;
                                  }
                                },
                              ),
                            );
                          });
                        }),
                        const SizedBox(height: MorganSpace.sm),
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton(
                            onPressed: _running ? null : _runScenario,
                            child: const Text('Re-run with updated assumptions'),
                          ),
                        ),
                        const SizedBox(height: MorganSpace.sm),
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton(
                            onPressed: _saving ? null : _saveScenario,
                            child: _saving
                                ? SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: p.accent),
                                  )
                                : const Text('Save scenario'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: MorganSpace.xl),
                const MorganScreenHeader(
                  title: 'Inventory purchase what-if',
                  subtitle: 'Model cash runway and stockout before a large buy',
                ),
                MorganSurface(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      TextFormField(
                        controller: _skuController,
                        decoration: const InputDecoration(
                          labelText: 'SKU',
                          isDense: true,
                        ),
                        textCapitalization: TextCapitalization.characters,
                        onFieldSubmitted: (_) => _loadSkuDefaults(),
                      ),
                      if (_skuLoadHint != null) ...[
                        const SizedBox(height: MorganSpace.xs),
                        Text(_skuLoadHint!, style: theme.textTheme.bodySmall),
                      ],
                      const SizedBox(height: MorganSpace.sm),
                      TextFormField(
                        controller: _quantityController,
                        decoration: const InputDecoration(
                          labelText: 'Quantity',
                          isDense: true,
                        ),
                        keyboardType: TextInputType.number,
                      ),
                      const SizedBox(height: MorganSpace.sm),
                      TextFormField(
                        controller: _unitCostController,
                        decoration: const InputDecoration(
                          labelText: 'Unit cost (USD)',
                          isDense: true,
                        ),
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      ),
                      const SizedBox(height: MorganSpace.md),
                      Row(
                        children: [
                          OutlinedButton(
                            onPressed: _loadSkuDefaults,
                            child: const Text('Load SKU'),
                          ),
                          const SizedBox(width: MorganSpace.sm),
                          Expanded(
                            child: FilledButton(
                              onPressed: _inventoryRunning ? null : _runInventoryScenario,
                              child: _inventoryRunning
                                  ? SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: p.accentOn),
                                    )
                                  : const Text('Run purchase scenario'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (_inventoryError != null) ...[
                  const SizedBox(height: MorganSpace.md),
                  Text(_inventoryError!, style: theme.textTheme.bodyMedium?.copyWith(color: p.loss)),
                ],
                if (_inventoryResult != null) ...[
                  const SizedBox(height: MorganSpace.lg),
                  MorganSurface(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (_inventoryResult!.runwayWarning) ...[
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(MorganSpace.sm),
                            decoration: BoxDecoration(
                              color: p.lossMuted,
                              borderRadius: BorderRadius.circular(MorganSpace.xs),
                            ),
                            child: Text(
                              'Warning: cash runway drops below 30 days after this purchase.',
                              style: theme.textTheme.bodySmall?.copyWith(color: p.loss),
                            ),
                          ),
                          const SizedBox(height: MorganSpace.md),
                        ],
                        Text('Purchase impact', style: theme.textTheme.titleMedium),
                        const SizedBox(height: MorganSpace.md),
                        _ResultRow(
                          label: 'Purchase cost',
                          value: '\$${_inventoryResult!.purchaseCostUsd}',
                        ),
                        if (_inventoryResult!.expectedProfitUsd != null)
                          _ResultRow(
                            label: 'Expected profit',
                            value: '\$${_inventoryResult!.expectedProfitUsd}',
                            valueColor: p.profit,
                          ),
                        if (_inventoryResult!.runwayDaysAfterPurchase != null)
                          _ResultRow(
                            label: 'Runway after purchase',
                            value: '${_inventoryResult!.runwayDaysAfterPurchase!.toStringAsFixed(1)} days',
                            valueColor: _inventoryResult!.runwayWarning ? p.loss : null,
                          ),
                        if (_inventoryResult!.stockoutDateAfterPurchase != null)
                          _ResultRow(
                            label: 'Projected stockout',
                            value: DateFormat('MMM d, y').format(
                              DateTime.parse(_inventoryResult!.stockoutDateAfterPurchase!),
                            ),
                          ),
                        const SizedBox(height: MorganSpace.sm),
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton(
                            onPressed: _inventorySaving ? null : _saveInventoryScenario,
                            child: _inventorySaving
                                ? SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: p.accent),
                                  )
                                : const Text('Save scenario'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: MorganSpace.xl),
                const MorganScreenHeader(
                  title: 'Saved scenarios',
                  subtitle: 'What-if models from chat and the planner',
                ),
                scenariosAsync.when(
                  loading: () => Padding(
                    padding: const EdgeInsets.symmetric(vertical: MorganSpace.lg),
                    child: Center(child: CircularProgressIndicator(color: p.accent)),
                  ),
                  error: (_, __) => Text(
                    'Could not load saved scenarios.',
                    style: theme.textTheme.bodyMedium,
                  ),
                  data: (scenarios) {
                    if (scenarios.isEmpty) {
                      return MorganSurface(
                        child: Text(
                          'No saved scenarios yet. Run a what-if above or ask Morgan in chat.',
                          style: theme.textTheme.bodyMedium,
                        ),
                      );
                    }

                    return Column(
                      children: scenarios.map((scenario) {
                        final created = scenario.createdAt != null
                            ? DateFormat('MMM d, y').format(DateTime.parse(scenario.createdAt!))
                            : null;
                        return Padding(
                          padding: const EdgeInsets.only(bottom: MorganSpace.md),
                          child: MorganSurface(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(scenario.title, style: theme.textTheme.titleMedium),
                                if (scenario.spendChangePct != null) ...[
                                  const SizedBox(height: MorganSpace.xs),
                                  Text(
                                    '${scenario.channel ?? 'ads'} ${scenario.spendChangePct! >= 0 ? '+' : ''}${scenario.spendChangePct!.round()}%',
                                    style: theme.textTheme.bodySmall,
                                  ),
                                ] else if (scenario.scenarioType == 'inventory_purchase') ...[
                                  const SizedBox(height: MorganSpace.xs),
                                  Text('Inventory purchase', style: theme.textTheme.bodySmall),
                                ],
                                if (created != null) ...[
                                  const SizedBox(height: MorganSpace.xxs),
                                  Text(created, style: theme.textTheme.labelSmall),
                                ],
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    );
                  },
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ResultRow extends StatelessWidget {
  const _ResultRow({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: MorganSpace.sm),
      child: Row(
        children: [
          Expanded(child: Text(label, style: theme.textTheme.bodySmall)),
          Text(
            value,
            style: theme.textTheme.titleSmall?.copyWith(
              color: valueColor,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
