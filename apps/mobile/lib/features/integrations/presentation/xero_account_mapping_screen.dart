import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/integrations/integrations_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_detail_app_bar.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import 'account_mapping_screen_shared.dart';

class XeroAccountMappingScreen extends ConsumerStatefulWidget {
  const XeroAccountMappingScreen({super.key});

  @override
  ConsumerState<XeroAccountMappingScreen> createState() => _XeroAccountMappingScreenState();
}

class _XeroAccountMappingScreenState extends ConsumerState<XeroAccountMappingScreen> {
  bool _loading = true;
  bool _saving = false;
  bool _showValidation = false;
  String? _error;
  String? _message;
  List<XeroAccountMapping> _mappings = [];
  final Map<String, String> _draftCategories = {};

  @override
  void initState() {
    super.initState();
    _loadMappings();
  }

  Future<void> _loadMappings() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final mappings = await ref.read(integrationsRepositoryProvider).listXeroAccountMappings();
      setState(() {
        _mappings = mappings;
        _draftCategories.clear();
        for (final mapping in mappings) {
          _draftCategories[mapping.xeroAccountId] = mapping.morganCategory;
        }
      });
    } catch (_) {
      setState(() => _error = 'Could not load Xero accounts.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool get _hasValidationErrors {
    return _draftCategories.values.any((category) => category == 'unmapped');
  }

  Future<void> _saveMappings() async {
    setState(() => _showValidation = true);
    if (_hasValidationErrors) return;

    setState(() {
      _saving = true;
      _error = null;
      _message = null;
    });

    try {
      final payload = _draftCategories.entries
          .map(
            (entry) => XeroAccountMappingUpdate(
              xeroAccountId: entry.key,
              morganCategory: entry.value,
            ),
          )
          .toList();

      final mappings =
          await ref.read(integrationsRepositoryProvider).updateXeroAccountMappings(payload);
      setState(() {
        _mappings = mappings;
        _message = 'Account mappings saved';
        _showValidation = false;
      });
    } catch (_) {
      setState(() => _error = 'Could not save account mappings.');
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
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MorganDetailAppBar(
              title: 'Xero mapping',
              fallbackRoute: '/settings/integrations',
              actions: [
                TextButton(
                  onPressed: _saving || _mappings.isEmpty ? null : _saveMappings,
                  child: Text(_saving ? 'Saving…' : 'Save'),
                ),
              ],
            ),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
              child: MorganScreenHeader(
                title: 'Account mapping',
                subtitle:
                    'Map Xero accounts to Morgan categories so COGS, shipping, marketing, and opex roll up correctly in profit.',
              ),
            ),
            if (_message != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                child: Text(_message!, style: theme.textTheme.bodySmall?.copyWith(color: p.profit)),
              ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
                child: Text(_error!, style: theme.textTheme.bodySmall?.copyWith(color: p.loss)),
              ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _mappings.isEmpty
                      ? Padding(
                          padding: const EdgeInsets.all(MorganSpace.screenH),
                          child: Text(
                            'No Xero accounts synced yet. Connect Xero and wait for the first books sync.',
                            style: theme.textTheme.bodyMedium,
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(MorganSpace.screenH),
                          itemCount: _mappings.length,
                          separatorBuilder: (_, __) => const SizedBox(height: MorganSpace.sm),
                          itemBuilder: (context, index) {
                            final mapping = _mappings[index];
                            final category = _draftCategories[mapping.xeroAccountId];
                            return AccountMappingRow(
                              accountName: mapping.accountName,
                              accountMeta: [
                                mapping.accountType,
                                mapping.accountSubtype,
                              ].whereType<String>().where((value) => value.isNotEmpty).join(' · '),
                              selectedCategory: category,
                              categories: quickBooksMorganCategories,
                              categoryLabel: quickBooksMorganCategoryLabel,
                              validationError: accountMappingValidationError(
                                category,
                                showValidation: _showValidation,
                              ),
                              onChanged: (value) {
                                if (value == null) return;
                                setState(() => _draftCategories[mapping.xeroAccountId] = value);
                              },
                            );
                          },
                        ),
            ),
            Padding(
              padding: const EdgeInsets.all(MorganSpace.screenH),
              child: MorganPrimaryButton(
                label: _saving ? 'Saving…' : 'Save mappings',
                onPressed: _saving || _mappings.isEmpty ? null : _saveMappings,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
