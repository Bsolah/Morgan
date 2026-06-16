import 'package:flutter/material.dart';

import '../../../core/theme/morgan_colors.dart';

class RecommendationsScreen extends StatelessWidget {
  const RecommendationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Actions')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          _RecommendationCard(
            title: 'Pause Campaign X',
            impact: 'Save ~\$400/wk',
            effort: 'Low effort',
          ),
          SizedBox(height: 12),
          _RecommendationCard(
            title: 'Reorder Blue Tee (M)',
            impact: 'Avoid \$800 stockout',
            effort: 'Medium effort',
          ),
        ],
      ),
    );
  }
}

class _RecommendationCard extends StatelessWidget {
  const _RecommendationCard({required this.title, required this.impact, required this.effort});

  final String title;
  final String impact;
  final String effort;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
            const SizedBox(height: 8),
            Text(impact, style: const TextStyle(color: MorganColors.secondary, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(effort, style: const TextStyle(color: MorganColors.textMuted)),
          ],
        ),
      ),
    );
  }
}
