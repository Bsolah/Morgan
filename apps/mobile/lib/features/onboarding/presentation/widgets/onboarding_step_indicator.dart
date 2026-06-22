import 'package:flutter/material.dart';

import '../../../../core/theme/morgan_colors.dart';
import '../../../../core/theme/morgan_tokens.dart';

/// Four-step onboarding progress (Welcome · Connect · Confirmed · Sync).
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
    assert(labels.length <= 4, 'Onboarding supports at most 4 steps');

    final p = context.morgan;
    final theme = Theme.of(context);

    return Row(
      children: List.generate(labels.length, (index) {
        final active = index == currentIndex;
        final complete = index < currentIndex;

        return Expanded(
          child: Row(
            children: [
              Expanded(
                child: Column(
                  children: [
                    Container(
                      height: 3,
                      decoration: BoxDecoration(
                        color: complete || active ? p.accent : p.borderSubtle,
                        borderRadius: BorderRadius.circular(MorganRadius.pill),
                      ),
                    ),
                    const SizedBox(height: MorganSpace.xs),
                    Text(
                      labels[index],
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: active
                            ? p.accent
                            : complete
                                ? p.textSecondary
                                : p.textMuted,
                        fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                      ),
                    ),
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
