import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_providers.dart';
import '../config/app_config.dart';
import 'recommendation.dart';
import 'recommendation_detail.dart';
import 'recommendations_repository.dart';

final recommendationsProvider = FutureProvider<RecommendationsFeed>((ref) async {
  final session = await ref.watch(authSessionProvider.future);
  if (session == null) return RecommendationsFeed.empty();

  final repo = RecommendationsRepository(session);

  try {
    return await repo.fetchOpen();
  } catch (_) {
    if (AppConfig.canSkipSetup) {
      return RecommendationsRepository.devFallback();
    }
    rethrow;
  }
});

final recommendationDetailProvider =
    FutureProvider.family<RecommendationDetail, String>((ref, recommendationId) async {
  final session = await ref.watch(authSessionProvider.future);
  if (session == null) {
    throw StateError('Not authenticated');
  }

  final repo = RecommendationsRepository(session);

  try {
    return await repo.fetchDetail(recommendationId);
  } catch (_) {
    if (AppConfig.canSkipSetup) {
      final fallback = RecommendationsRepository.devDetailFallback(recommendationId);
      if (fallback != null) return fallback;
    }
    rethrow;
  }
});
