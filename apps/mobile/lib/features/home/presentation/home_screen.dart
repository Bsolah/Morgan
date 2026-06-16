import 'package:flutter/material.dart';

import '../../../core/theme/morgan_colors.dart';
import '../../../shared/widgets/kpi_tile.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: ShaderMask(
          shaderCallback: (bounds) => MorganColors.brandGradient.createShader(bounds),
          child: const Text(
            'Morgan',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Today\'s brief', style: theme.textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(
            'Profit rose 12% yesterday on lower discounting and improved Meta POAS.',
            style: theme.textTheme.bodyLarge,
          ),
          const SizedBox(height: 20),
          const Row(
            children: [
              Expanded(child: KpiTile(label: 'Profit', value: '\$4,280', delta: '+12%', accent: KpiAccent.secondary)),
              SizedBox(width: 12),
              Expanded(child: KpiTile(label: 'MER', value: '3.2', delta: '+0.3', accent: KpiAccent.primary)),
            ],
          ),
          const SizedBox(height: 12),
          const KpiTile(
            label: 'Cash runway',
            value: 'Connect bank',
            delta: null,
            fullWidth: true,
            accent: KpiAccent.tertiary,
          ),
          const SizedBox(height: 20),
          Card(
            color: MorganColors.tertiaryContainer,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: Color(0xFFFDE68A)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: MorganColors.tertiary.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.bolt, color: MorganColors.tertiary, size: 20),
                      ),
                      const SizedBox(width: 10),
                      Text('Top action', style: theme.textTheme.titleMedium?.copyWith(color: MorganColors.onTertiaryContainer)),
                    ],
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Reorder Blue Tee (M) to avoid an \$800 stockout risk.',
                    style: TextStyle(color: MorganColors.onTertiaryContainer, height: 1.4),
                  ),
                  const SizedBox(height: 12),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () {},
                      child: const Text('Review'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
