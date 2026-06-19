import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/integrations/integrations_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_primary_button.dart';

class QuickBooksAccountMappingScreen extends ConsumerStatefulWidget {
  const QuickBooksAccountMappingScreen({super.key});

  @override
  ConsumerState<QuickBooksAccountMappingScreen> createState() =>
      _QuickBooksAccountMappingScreenState();
}

class _QuickBooksAccountMappingScreenState extends ConsumerState<QuickBooksAccountMappingScreen> {
  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _message;
  List<QuickBooksAccountMapping> _mappings = [];
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
      final mappings = await ref.read(integrationsRepositoryProvider).listQuickBooksAccountMappings();
      setState(() {
        _mappings = mappings;
        _draftCategories.clear();
        for (final mapping in mappings) {
          _draftCategories[mapping.qboAccountId] = mapping.morganCategory;
        }
      });
    } catch (_) {
      setState(() => _error = 'Could not load QuickBooks accounts.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _saveMappings() async {
    setState(() {
      _saving = true;
      _error = null;
      _message = null;
    });

    try {
      final payload = _draftCategories.entries
          .map(
            (entry) => QuickBooksAccountMappingUpdate(
              qboAccountId: entry.key,
              morganCategory: entry.value,
            ),
          )
          .toList();

      final mappings =
          await ref.read(integrationsRepositoryProvider).updateQuickBooksAccountMappings(payload);
      setState(() {
        _mappings = mappings;
        _message = 'Account mappings saved';
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
      appBar: AppBar(
        title: const Text('QuickBooks mapping'),
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
              child: Text(
                'Map QBO accounts to Morgan categories for COGS, shipping, marketing, and opex.',
                style: theme.textTheme.bodyMedium,
              ),
            ),
            const SizedBox(height: MorganSpace.sm),
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
                            'No QuickBooks accounts synced yet. Connect QuickBooks and wait for the first books sync.',
                            style: theme.textTheme.bodyMedium,
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(MorganSpace.screenH),
                          itemCount: _mappings.length,
                          separatorBuilder: (_, __) => const SizedBox(height: MorganSpace.sm),
                          itemBuilder: (context, index) {
                            final mapping = _mappings[index];
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(mapping.accountName, style: theme.textTheme.bodyLarge),
                              subtitle: Text(
                                [mapping.accountType, mapping.accountSubtype]
                                    .whereType<String>()
                                    .where((value) => value.isNotEmpty)
                                    .join(' · '),
                                style: theme.textTheme.bodySmall,
                              ),
                              trailing: DropdownButton<String>(
                                value: _draftCategories[mapping.qboAccountId],
                                items: quickBooksMorganCategories
                                    .map(
                                      (category) => DropdownMenuItem(
                                        value: category,
                                        child: Text(quickBooksMorganCategoryLabel(category)),
                                      ),
                                    )
                                    .toList(),
                                onChanged: (value) {
                                  if (value == null) return;
                                  setState(() => _draftCategories[mapping.qboAccountId] = value);
                                },
                              ),
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
