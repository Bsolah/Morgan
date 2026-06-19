import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_client.dart';

class Recommendation {
  const Recommendation({
    required this.id,
    required this.title,
    required this.body,
    required this.category,
    required this.status,
    this.impactLowUsd,
    this.impactHighUsd,
    this.confidence,
    this.effort,
  });

  final String id;
  final String title;
  final String body;
  final String category;
  final String status;
  final double? impactLowUsd;
  final double? impactHighUsd;
  final String? confidence;
  final String? effort;

  factory Recommendation.fromJson(Map<String, dynamic> json) {
    return Recommendation(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      category: json['category'] as String? ?? '',
      status: json['status'] as String? ?? 'open',
      impactLowUsd: (json['impact_low_usd'] as num?)?.toDouble(),
      impactHighUsd: (json['impact_high_usd'] as num?)?.toDouble(),
      confidence: json['confidence'] as String?,
      effort: json['effort'] as String?,
    );
  }
}

class RecommendationActionResult {
  const RecommendationActionResult({
    required this.recommendation,
    required this.confirmationMessage,
  });

  final Recommendation recommendation;
  final String confirmationMessage;

  factory RecommendationActionResult.fromJson(Map<String, dynamic> json) {
    return RecommendationActionResult(
      recommendation: Recommendation.fromJson(json['recommendation'] as Map<String, dynamic>),
      confirmationMessage: json['confirmation_message'] as String? ?? '',
    );
  }
}

class RecommendationsRepository {
  RecommendationsRepository(this._dio);

  final Dio _dio;

  Future<Recommendation> getRecommendation(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/recommendations/$id');
    return Recommendation.fromJson(response.data!);
  }

  Future<RecommendationActionResult> acceptRecommendation(String id) async {
    final response = await _dio.post<Map<String, dynamic>>('/api/v1/recommendations/$id/accept');
    return RecommendationActionResult.fromJson(response.data!);
  }

  Future<RecommendationActionResult> dismissRecommendation(String id) async {
    final response = await _dio.post<Map<String, dynamic>>('/api/v1/recommendations/$id/dismiss');
    return RecommendationActionResult.fromJson(response.data!);
  }
}

final recommendationsRepositoryProvider = Provider<RecommendationsRepository>((ref) {
  return RecommendationsRepository(ref.watch(apiClientProvider).dio);
});

final recommendationDetailProvider = FutureProvider.autoDispose.family<Recommendation, String>((ref, id) {
  return ref.watch(recommendationsRepositoryProvider).getRecommendation(id);
});
