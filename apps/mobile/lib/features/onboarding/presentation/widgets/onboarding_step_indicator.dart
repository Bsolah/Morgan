import 'package:flutter/material.dart';

import '../../../../core/theme/morgan_colors.dart';
import '../../../../core/theme/morgan_tokens.dart';

class OnboardingStepIndicator extends StatelessWidget {
  const OnboardingStepIndicator({
    super.key,
    required this.currentIndex,
    required this.labels,
  });

  final int currentIndex;
  final List<String> labels;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;

    return Row(
      children: List.generate(labels.length, (index) {
        final active = index == currentIndex;
        final complete = index < currentIndex;

        return Expanded(
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      height: 3,
                      decoration: BoxDecoration(
                        color: complete || active ? p.accent : p.borderSubtle,
                        borderRadius: BorderRadius.circular(MorganRadius.pill),
                      ),
                    ),
                    if (active) ...[
                      const SizedBox(height: MorganSpace.xxs),
                      Text(
                        labels[index],
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(color: p.accent),
                      ),
                    ],
                  ],
                ),
              ),
              if (index < labels.length - 1) const SizedBox(width: MorganSpace.xxs),
            ],
          ),
        );
      }),
    );
  }
}
