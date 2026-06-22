import 'package:flutter/material.dart';

import '../../core/theme/morgan_colors.dart';
import '../../core/theme/morgan_tokens.dart';
import 'morgan_logo.dart';
import 'morgan_surface.dart';

/// Animated shimmer wrapper for skeleton placeholder trees (US-UX-15-01).
class MorganShimmer extends StatefulWidget {
  const MorganShimmer({super.key, required this.child});

  final Widget child;

  @override
  State<MorganShimmer> createState() => _MorganShimmerState();
}

class _MorganShimmerState extends State<MorganShimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) {
            return LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: [
                p.surfaceMuted,
                p.isDark ? p.borderSubtle : p.surfaceElevated,
                p.surfaceMuted,
              ],
              stops: const [0.25, 0.5, 0.75],
              transform: _ShimmerGradientSlide(_controller.value),
            ).createShader(bounds);
          },
          child: child,
        );
      },
      child: widget.child,
    );
  }
}

class _ShimmerGradientSlide extends GradientTransform {
  const _ShimmerGradientSlide(this.slide);

  final double slide;

  @override
  Matrix4 transform(Rect bounds, {TextDirection? textDirection}) {
    return Matrix4.translationValues(bounds.width * (slide * 2 - 1), 0, 0);
  }
}

/// Base skeleton block — pair with [MorganShimmer] for animated loading.
class MorganSkeletonBox extends StatelessWidget {
  const MorganSkeletonBox({
    super.key,
    required this.width,
    required this.height,
    this.radius = MorganRadius.xs,
  });

  final double width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: p.surfaceMuted,
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}

class MorganBriefCardSkeleton extends StatelessWidget {
  const MorganBriefCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const MorganShimmer(
      child: MorganSurface(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                MorganSkeletonBox(width: 72, height: 12),
                Spacer(),
                MorganSkeletonBox(width: 96, height: 12),
              ],
            ),
            SizedBox(height: MorganSpace.sm),
            MorganSkeletonBox(width: double.infinity, height: 16),
            SizedBox(height: MorganSpace.xs),
            MorganSkeletonBox(width: 220, height: 16),
            SizedBox(height: MorganSpace.xs),
            MorganSkeletonBox(width: double.infinity, height: 14),
            SizedBox(height: MorganSpace.xxs),
            MorganSkeletonBox(width: double.infinity, height: 14),
            SizedBox(height: MorganSpace.xxs),
            MorganSkeletonBox(width: 180, height: 14),
          ],
        ),
      ),
    );
  }
}

class MorganMetricCardSkeleton extends StatelessWidget {
  const MorganMetricCardSkeleton({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    return MorganSurface(
      padding: compact
          ? const EdgeInsets.symmetric(
              horizontal: MorganSpace.md,
              vertical: MorganSpace.sm,
            )
          : const EdgeInsets.all(MorganSpace.card),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const MorganSkeletonBox(width: 56, height: 10),
          SizedBox(height: compact ? MorganSpace.xs : MorganSpace.sm),
          MorganSkeletonBox(width: compact ? 48 : 64, height: compact ? 22 : 28),
          if (compact) ...[
            const SizedBox(height: MorganSpace.xs),
            const MorganSkeletonBox(width: 40, height: 14),
          ],
        ],
      ),
    );
  }
}

class MorganKpiRowSkeleton extends StatelessWidget {
  const MorganKpiRowSkeleton({super.key, this.compact = true});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    return const MorganShimmer(
      child: Row(
        children: [
          Expanded(child: MorganMetricCardSkeleton(compact: true)),
          SizedBox(width: MorganSpace.sm),
          Expanded(child: MorganMetricCardSkeleton(compact: true)),
          SizedBox(width: MorganSpace.sm),
          Expanded(child: MorganMetricCardSkeleton(compact: true)),
        ],
      ),
    );
  }
}

class MorganBriefHistoryTileSkeleton extends StatelessWidget {
  const MorganBriefHistoryTileSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const MorganShimmer(
      child: MorganSurface(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MorganSkeletonBox(width: 88, height: 12),
            SizedBox(height: MorganSpace.xxs),
            MorganSkeletonBox(width: double.infinity, height: 16),
            SizedBox(height: MorganSpace.xxs),
            MorganSkeletonBox(width: 200, height: 16),
          ],
        ),
      ),
    );
  }
}

class MorganRecommendationCardSkeleton extends StatelessWidget {
  const MorganRecommendationCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const MorganSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MorganSkeletonBox(width: 72, height: 20),
          SizedBox(height: MorganSpace.sm),
          MorganSkeletonBox(width: double.infinity, height: 18),
          SizedBox(height: MorganSpace.xs),
          MorganSkeletonBox(width: 96, height: 16),
          SizedBox(height: MorganSpace.sm),
          MorganSkeletonBox(width: double.infinity, height: 14),
          SizedBox(height: MorganSpace.xxs),
          MorganSkeletonBox(width: 240, height: 14),
        ],
      ),
    );
  }
}

class MorganRecommendationsListSkeleton extends StatelessWidget {
  const MorganRecommendationsListSkeleton({super.key, this.count = 3});

  final int count;

  @override
  Widget build(BuildContext context) {
    return MorganShimmer(
      child: Column(
        children: [
          for (var i = 0; i < count; i++) ...[
            if (i > 0) const SizedBox(height: MorganSpace.sm),
            const MorganRecommendationCardSkeleton(),
          ],
        ],
      ),
    );
  }
}

class MorganAlertTileSkeleton extends StatelessWidget {
  const MorganAlertTileSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const MorganSurface(
      child: Row(
        children: [
          MorganSkeletonBox(width: 36, height: 36, radius: MorganRadius.xs),
          SizedBox(width: MorganSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                MorganSkeletonBox(width: double.infinity, height: 16),
                SizedBox(height: MorganSpace.xxs),
                MorganSkeletonBox(width: 120, height: 12),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class MorganAlertFiltersSkeleton extends StatelessWidget {
  const MorganAlertFiltersSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        MorganSkeletonBox(width: 48, height: 32, radius: MorganRadius.pill),
        SizedBox(width: MorganSpace.xs),
        MorganSkeletonBox(width: 72, height: 32, radius: MorganRadius.pill),
        SizedBox(width: MorganSpace.xs),
        MorganSkeletonBox(width: 64, height: 32, radius: MorganRadius.pill),
      ],
    );
  }
}

class MorganAlertsListSkeleton extends StatelessWidget {
  const MorganAlertsListSkeleton({super.key, this.count = 3});

  final int count;

  @override
  Widget build(BuildContext context) {
    return const MorganShimmer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MorganAlertFiltersSkeleton(),
          SizedBox(height: MorganSpace.md),
          MorganAlertTileSkeleton(),
          SizedBox(height: MorganSpace.sm),
          MorganAlertTileSkeleton(),
          SizedBox(height: MorganSpace.sm),
          MorganAlertTileSkeleton(),
        ],
      ),
    );
  }
}

class MorganProfitHeroSkeleton extends StatelessWidget {
  const MorganProfitHeroSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const MorganShimmer(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MorganSkeletonBox(width: 160, height: 28),
            SizedBox(height: MorganSpace.xs),
            MorganSkeletonBox(width: 240, height: 14),
            SizedBox(height: MorganSpace.lg),
            const MorganMetricCardSkeleton(),
            SizedBox(height: MorganSpace.sm),
            MorganSkeletonBox(width: double.infinity, height: 8),
            SizedBox(height: MorganSpace.lg),
            MorganSkeletonBox(width: double.infinity, height: 120),
          ],
        ),
      ),
    );
  }
}

/// Section placeholder: header line + one or more card blocks (US-UX-09-02).
class MorganProfitSectionSkeleton extends StatelessWidget {
  const MorganProfitSectionSkeleton({super.key, this.cardCount = 1});

  final int cardCount;

  @override
  Widget build(BuildContext context) {
    return MorganShimmer(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const MorganSkeletonBox(width: 180, height: 22),
            const SizedBox(height: MorganSpace.sm),
            for (var i = 0; i < cardCount; i++) ...[
              if (i > 0) const SizedBox(height: MorganSpace.sm),
              const MorganSkeletonBox(width: double.infinity, height: 96),
            ],
          ],
        ),
      ),
    );
  }
}

/// Full-screen loader for auth bootstrap only (US-UX-15-01).
class MorganBootstrapLoader extends StatelessWidget {
  const MorganBootstrapLoader({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: p.background,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const MorganLogo(size: 56),
            const SizedBox(height: MorganSpace.xl),
            SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(strokeWidth: 2.5, color: p.accent),
            ),
            const SizedBox(height: MorganSpace.md),
            Text(
              'Loading Morgan…',
              style: theme.textTheme.bodySmall?.copyWith(color: p.textMuted),
            ),
          ],
        ),
      ),
    );
  }
}
