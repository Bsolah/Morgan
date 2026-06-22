import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/finance/briefing_schedule.dart';
import '../../../core/finance/finance_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../../../shared/widgets/morgan_surface.dart';

class BriefingScheduleScreen extends ConsumerStatefulWidget {
  const BriefingScheduleScreen({super.key});

  @override
  ConsumerState<BriefingScheduleScreen> createState() => _BriefingScheduleScreenState();
}

class _BriefingScheduleScreenState extends ConsumerState<BriefingScheduleScreen> {
  TimeOfDay _selectedTime = const TimeOfDay(hour: 6, minute: 0);
  String _selectedTimezone = 'UTC';
  List<String> _timezoneOptions = const [];
  String? _shopifyTimezone;
  bool _timezoneOverridden = false;
  String? _nextBriefingAt;
  BriefingSchedulePending? _pending;
  bool _loaded = false;
  bool _saving = false;
  String? _saveError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadSchedule());
  }

  Future<void> _loadSchedule() async {
    try {
      final schedule = await ref.read(financeRepositoryProvider).getBriefingSchedule();
      if (!mounted) return;
      setState(() {
        _selectedTime = parseBriefingTimeOfDay(schedule.briefingTimeLocal);
        _selectedTimezone = schedule.timezone;
        _timezoneOptions = schedule.timezoneOptions;
        _shopifyTimezone = schedule.shopifyTimezone;
        _timezoneOverridden = schedule.timezoneOverridden;
        _nextBriefingAt = schedule.nextBriefingAt;
        _pending = schedule.pending;
        _loaded = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loaded = true);
    }
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _selectedTime,
      helpText: 'Daily briefing time',
    );
    if (picked != null) {
      setState(() => _selectedTime = picked);
    }
  }

  Future<void> _pickTimezone() async {
    final options = {
      ..._timezoneOptions,
      if (_shopifyTimezone != null) _shopifyTimezone!,
      _selectedTimezone,
    }.toList()
      ..sort();

    final selected = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (context) {
        final theme = Theme.of(context);
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(MorganSpace.screenH),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Timezone', style: theme.textTheme.titleMedium),
                const SizedBox(height: MorganSpace.sm),
                Flexible(
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: options.length,
                    itemBuilder: (context, index) {
                      final timezone = options[index];
                      final isShopify = timezone == _shopifyTimezone;
                      return ListTile(
                        title: Text(formatTimezoneLabel(timezone)),
                        subtitle: isShopify ? const Text('Detected from Shopify') : null,
                        trailing: timezone == _selectedTimezone
                            ? const Icon(Icons.check_rounded)
                            : null,
                        onTap: () => Navigator.of(context).pop(timezone),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );

    if (selected != null) {
      setState(() => _selectedTimezone = selected);
    }
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _saveError = null;
    });

    try {
      final updated = await ref.read(financeRepositoryProvider).updateBriefingSchedule(
            UpdateBriefingScheduleRequest(
              timezone: _selectedTimezone,
              briefingTimeLocal: formatBriefingTimeOfDay(_selectedTime),
            ),
          );

      ref.invalidate(briefingScheduleProvider);

      if (!mounted) return;

      setState(() {
        _nextBriefingAt = updated.nextBriefingAt;
        _pending = updated.pending;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Briefing schedule updated — changes start tomorrow')),
      );
      context.pop();
    } catch (_) {
      if (!mounted) return;
      setState(() => _saveError = 'Could not save briefing schedule. Try again.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String _formatNextBriefing(String iso) {
    final parsed = DateTime.tryParse(iso);
    if (parsed == null) return '—';
    return DateFormat.yMMMEd().add_jm().format(parsed.toLocal());
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
        title: Text('Daily briefing', style: theme.textTheme.titleMedium),
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
                    'When should Morgan deliver your brief?',
                    style: theme.textTheme.headlineSmall,
                  ),
                  const SizedBox(height: MorganSpace.sm),
                  Text(
                    'Timezone is detected from Shopify and can be changed manually. Updates apply from the next calendar day.',
                    style: theme.textTheme.bodyLarge,
                  ),
                  const SizedBox(height: MorganSpace.xl),
                  MorganSurface(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Next briefing', style: theme.textTheme.titleSmall),
                        const SizedBox(height: MorganSpace.xs),
                        Text(
                          _formatNextBriefing(_nextBriefingAt ?? ''),
                          style: theme.textTheme.bodyLarge,
                        ),
                        if (_pending != null) ...[
                          const SizedBox(height: MorganSpace.sm),
                          Text(
                            'Pending change from ${_pending!.effectiveFrom}: '
                            '${_pending!.briefingTimeLocal != null ? formatBriefingTimeLocal(_pending!.briefingTimeLocal!) : formatBriefingTimeLocal(formatBriefingTimeOfDay(_selectedTime))}'
                            '${_pending!.timezone != null ? ' · ${formatTimezoneLabel(_pending!.timezone!)}' : ''}',
                            style: theme.textTheme.bodySmall?.copyWith(color: p.accent),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: MorganSpace.lg),
                  MorganSurface(
                    child: Column(
                      children: [
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text('Briefing time', style: theme.textTheme.titleSmall),
                          subtitle: Text(formatBriefingTimeLocal(formatBriefingTimeOfDay(_selectedTime))),
                          trailing: const Icon(Icons.schedule_outlined),
                          onTap: _pickTime,
                        ),
                        Divider(height: 1, color: p.borderSubtle),
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text('Timezone', style: theme.textTheme.titleSmall),
                          subtitle: Text(
                            _timezoneOverridden
                                ? '${formatTimezoneLabel(_selectedTimezone)} · manual'
                                : '${formatTimezoneLabel(_selectedTimezone)} · from Shopify',
                          ),
                          trailing: const Icon(Icons.public_outlined),
                          onTap: _pickTimezone,
                        ),
                        if (_shopifyTimezone != null &&
                            _shopifyTimezone != _selectedTimezone) ...[
                          const SizedBox(height: MorganSpace.sm),
                          Align(
                            alignment: Alignment.centerLeft,
                            child: TextButton(
                              onPressed: () => setState(() => _selectedTimezone = _shopifyTimezone!),
                              child: Text(
                                'Use Shopify timezone (${formatTimezoneLabel(_shopifyTimezone!)})',
                              ),
                            ),
                          ),
                        ],
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
