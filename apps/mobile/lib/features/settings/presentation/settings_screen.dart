import 'package:flutter/material.dart';

import '../../../core/config/app_config.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          const ListTile(
            title: Text('COGS method'),
            subtitle: Text('Shopify unit cost'),
            trailing: Icon(Icons.chevron_right),
          ),
          const ListTile(
            title: Text('Daily briefing time'),
            subtitle: Text('6:00 AM'),
            trailing: Icon(Icons.chevron_right),
          ),
          ListTile(
            title: const Text('API base URL (dev)'),
            subtitle: Text(AppConfig.apiBaseUrl),
          ),
        ],
      ),
    );
  }
}
