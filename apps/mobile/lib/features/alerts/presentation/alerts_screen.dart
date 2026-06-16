import 'package:flutter/material.dart';

import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_fade_in.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_surface.dart';

class AlertsScreen extends StatelessWidget {
  const AlertsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;

    return Scaffold(
      backgroundColor: p.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.only(bottom: MorganSpace.huge),
          children: [
            const MorganScreenHeader(
              title: 'Alerts',
              subtitle: 'Signals that need your attention',
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
              child: Column(
                children: const [
                  MorganFadeIn(
                    child: _AlertTile(
                      severity: _AlertSeverity.critical,
                      title: 'Margin down 14%',
                      subtitle: 'Refunds increased \$380 vs 7-day average',
                      time: '2h ago',
                    ),
                  ),
                  SizedBox(height: MorganSpace.sm),
                  MorganFadeIn(
                    delay: Duration(milliseconds: 60),
                    child: _AlertTile(
                      severity: _AlertSeverity.warning,
                      title: 'Meta campaign burning cash',
                      subtitle: 'Retargeting BOF · POAS 0.72 for 7 days',
                      time: '5h ago',
                    ),
                  ),
                  SizedBox(height: MorganSpace.sm),
                  MorganFadeIn(
                    delay: Duration(milliseconds: 120),
                    child: _AlertTile(
                      severity: _AlertSeverity.info,
                      title: 'Stockout risk',
                      subtitle: 'Blue Tee (M) · ~6 days remaining',
                      time: 'Today',
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

enum _AlertSeverity { critical, warning, info }

class _AlertTile extends StatelessWidget {
  const _AlertTile({
    required this.severity,
    required this.title,
    required this.subtitle,
    required this.time,
  });

  final _AlertSeverity severity;
  final String title;
  final String subtitle;
  final String time;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    final (Color accent, Color bg, IconData icon) = switch (severity) {
      _AlertSeverity.critical => (p.loss, p.lossMuted, Icons.error_outline_rounded),
      _AlertSeverity.warning => (p.warning, p.goldMuted, Icons.warning_amber_rounded),
      _AlertSeverity.info => (p.accent, p.accentMuted, Icons.info_outline_rounded),
    };

    return MorganSurface(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(MorganRadius.xs),
            ),
            child: Icon(icon, size: 18, color: accent),
          ),
          const SizedBox(width: MorganSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(child: Text(title, style: theme.textTheme.titleMedium)),
                    Text(time, style: theme.textTheme.bodySmall),
                  ],
                ),
                const SizedBox(height: MorganSpace.xxs),
                Text(subtitle, style: theme.textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
