import 'package:flutter/material.dart';

import '../../core/theme/morgan_tokens.dart';

/// Visible text summary above a chart; chart pixels excluded from screen readers.
class MorganChartFrame extends StatelessWidget {
  const MorganChartFrame({
    super.key,
    required this.summary,
    required this.chart,
  });

  final String summary;
  final Widget chart;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          label: summary,
          child: Text(summary, style: theme.textTheme.bodySmall),
        ),
        const SizedBox(height: MorganSpace.sm),
        ExcludeSemantics(child: chart),
      ],
    );
  }
}
