import 'package:flutter/material.dart';

import '../../../core/theme/morgan_colors.dart';

class AlertsScreen extends StatelessWidget {
  const AlertsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Alerts')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          _AlertTile(title: 'Margin down 14%', subtitle: 'Main driver: refunds up \$380', severity: Icons.warning_amber),
          Divider(),
          _AlertTile(title: 'Meta campaign POAS < 1.0', subtitle: 'Retargeting BOF — 7 day trend', severity: Icons.trending_down),
        ],
      ),
    );
  }
}

class _AlertTile extends StatelessWidget {
  const _AlertTile({required this.title, required this.subtitle, required this.severity});

  final String title;
  final String subtitle;
  final IconData severity;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(severity, color: MorganColors.warning),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text(subtitle),
    );
  }
}
