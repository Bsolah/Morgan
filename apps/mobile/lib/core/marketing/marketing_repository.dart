import 'package:dio/dio.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';



import '../network/api_client.dart';



class MarketingCampaignMetrics {

  const MarketingCampaignMetrics({

    required this.channel,

    required this.campaignId,

    required this.campaignName,

    required this.adSpend,

    required this.attributedRevenue,

    required this.attributedContributionMargin,

    required this.poas,

    required this.roas,

    required this.adWaste,

  });



  final String channel;

  final String campaignId;

  final String campaignName;

  final double adSpend;

  final double attributedRevenue;

  final double attributedContributionMargin;

  final double? poas;

  final double? roas;

  final bool adWaste;



  bool get isLowPoas => poas != null && poas! < 1;



  factory MarketingCampaignMetrics.fromJson(Map<String, dynamic> json) {

    return MarketingCampaignMetrics(

      channel: json['channel'] as String? ?? 'meta',

      campaignId: json['campaign_id'] as String,

      campaignName: json['campaign_name'] as String,

      adSpend: (json['ad_spend'] as num?)?.toDouble() ?? 0,

      attributedRevenue: (json['attributed_revenue'] as num?)?.toDouble() ?? 0,

      attributedContributionMargin:

          (json['attributed_contribution_margin'] as num?)?.toDouble() ?? 0,

      poas: (json['poas'] as num?)?.toDouble(),

      roas: (json['roas'] as num?)?.toDouble(),

      adWaste: json['ad_waste'] as bool? ?? false,

    );

  }

}



class MarketingOverview {

  const MarketingOverview({

    required this.metaConnected,

    required this.googleAdsConnected,

    required this.adsConnected,

    required this.windowDays,

    required this.summaryPoas,

    required this.summaryRoas,

    required this.summaryAdSpend,

    required this.poasTooltip,

    required this.roasTooltip,

    required this.campaigns,

  });



  final bool metaConnected;

  final bool googleAdsConnected;

  final bool adsConnected;

  final int windowDays;

  final double? summaryPoas;

  final double? summaryRoas;

  final double summaryAdSpend;

  final String poasTooltip;

  final String roasTooltip;

  final List<MarketingCampaignMetrics> campaigns;



  factory MarketingOverview.fromJson(Map<String, dynamic> json) {

    final summary = json['summary'] as Map<String, dynamic>? ?? {};

    final tooltips = json['tooltips'] as Map<String, dynamic>? ?? {};

    final campaigns = (json['campaigns'] as List<dynamic>? ?? [])

        .map((item) => MarketingCampaignMetrics.fromJson(item as Map<String, dynamic>))

        .toList();



    return MarketingOverview(

      metaConnected: json['meta_connected'] as bool? ?? false,

      googleAdsConnected: json['google_ads_connected'] as bool? ?? false,

      adsConnected: json['ads_connected'] as bool? ?? false,

      windowDays: (json['window_days'] as num?)?.toInt() ?? 7,

      summaryPoas: (summary['poas'] as num?)?.toDouble(),

      summaryRoas: (summary['roas'] as num?)?.toDouble(),

      summaryAdSpend: (summary['ad_spend'] as num?)?.toDouble() ?? 0,

      poasTooltip: tooltips['poas'] as String? ?? '',

      roasTooltip: tooltips['roas'] as String? ?? '',

      campaigns: campaigns,

    );

  }

}



class CampaignTrendPoint {

  const CampaignTrendPoint({

    required this.day,

    required this.adSpend,

    required this.poas,

  });



  final String day;

  final double adSpend;

  final double? poas;



  factory CampaignTrendPoint.fromJson(Map<String, dynamic> json) {

    return CampaignTrendPoint(

      day: json['day'] as String? ?? '',

      adSpend: (json['ad_spend'] as num?)?.toDouble() ?? 0,

      poas: (json['poas'] as num?)?.toDouble(),

    );

  }

}



class CampaignDetail {

  const CampaignDetail({

    required this.channel,

    required this.campaignId,

    required this.campaignName,

    required this.windowDays,

    required this.adSpend,

    required this.attributedRevenue,

    required this.poas,

    required this.roas,

    required this.adWaste,

    this.recommendationId,

    required this.trendDays,

    required this.trend,

  });



  final String channel;

  final String campaignId;

  final String campaignName;

  final int windowDays;

  final double adSpend;

  final double attributedRevenue;

  final double? poas;

  final double? roas;

  final bool adWaste;

  final String? recommendationId;

  final int trendDays;

  final List<CampaignTrendPoint> trend;



  factory CampaignDetail.fromJson(Map<String, dynamic> json) {

    final trendJson = json['trend'] as List<dynamic>? ?? const [];

    return CampaignDetail(

      channel: json['channel'] as String? ?? 'meta',

      campaignId: json['campaign_id'] as String? ?? '',

      campaignName: json['campaign_name'] as String? ?? '',

      windowDays: (json['window_days'] as num?)?.toInt() ?? 7,

      adSpend: (json['ad_spend'] as num?)?.toDouble() ?? 0,

      attributedRevenue: (json['attributed_revenue'] as num?)?.toDouble() ?? 0,

      poas: (json['poas'] as num?)?.toDouble(),

      roas: (json['roas'] as num?)?.toDouble(),

      adWaste: json['ad_waste'] as bool? ?? false,

      recommendationId: json['recommendation_id'] as String?,

      trendDays: (json['trend_days'] as num?)?.toInt() ?? 30,

      trend: trendJson.whereType<Map<String, dynamic>>().map(CampaignTrendPoint.fromJson).toList(),

    );

  }

}



class MerChannelRow {

  const MerChannelRow({

    required this.channel,

    required this.label,

    required this.adSpend,

    required this.mer,

  });



  final String channel;

  final String label;

  final double adSpend;

  final double? mer;



  factory MerChannelRow.fromJson(Map<String, dynamic> json) {

    return MerChannelRow(

      channel: json['channel'] as String? ?? '',

      label: json['label'] as String? ?? '',

      adSpend: (json['ad_spend'] as num?)?.toDouble() ?? 0,

      mer: (json['mer'] as num?)?.toDouble(),

    );

  }

}



class MerTrendPoint {

  const MerTrendPoint({

    required this.day,

    required this.netRevenue,

    required this.adSpend,

    required this.mer,

    required this.metaSpend,

    required this.googleSpend,

    required this.unattributedSpend,

  });



  final String day;

  final double netRevenue;

  final double adSpend;

  final double? mer;

  final double metaSpend;

  final double googleSpend;

  final double unattributedSpend;



  factory MerTrendPoint.fromJson(Map<String, dynamic> json) {

    return MerTrendPoint(

      day: json['day'] as String? ?? '',

      netRevenue: (json['net_revenue'] as num?)?.toDouble() ?? 0,

      adSpend: (json['ad_spend'] as num?)?.toDouble() ?? 0,

      mer: (json['mer'] as num?)?.toDouble(),

      metaSpend: (json['meta_spend'] as num?)?.toDouble() ?? 0,

      googleSpend: (json['google_spend'] as num?)?.toDouble() ?? 0,

      unattributedSpend: (json['unattributed_spend'] as num?)?.toDouble() ?? 0,

    );

  }

}



class MarketingMerResponse {

  const MarketingMerResponse({

    required this.windowDays,

    required this.trendDays,

    required this.netRevenue,

    required this.blendedMer,

    required this.metaConnected,

    required this.googleAdsConnected,

    required this.channels,

    required this.trend,

    required this.merTooltip,

  });



  final int windowDays;

  final int trendDays;

  final double netRevenue;

  final double? blendedMer;

  final bool metaConnected;

  final bool googleAdsConnected;

  final List<MerChannelRow> channels;

  final List<MerTrendPoint> trend;

  final String merTooltip;



  factory MarketingMerResponse.fromJson(Map<String, dynamic> json) {

    final channelsJson = json['channels'] as List<dynamic>? ?? const [];

    final trendJson = json['trend'] as List<dynamic>? ?? const [];

    final tooltips = json['tooltips'] as Map<String, dynamic>? ?? const {};



    return MarketingMerResponse(

      windowDays: (json['window_days'] as num?)?.toInt() ?? 30,

      trendDays: (json['trend_days'] as num?)?.toInt() ?? 30,

      netRevenue: (json['net_revenue'] as num?)?.toDouble() ?? 0,

      blendedMer: (json['blended_mer'] as num?)?.toDouble(),

      metaConnected: json['meta_connected'] as bool? ?? false,

      googleAdsConnected: json['google_ads_connected'] as bool? ?? false,

      channels: channelsJson.whereType<Map<String, dynamic>>().map(MerChannelRow.fromJson).toList(),

      trend: trendJson.whereType<Map<String, dynamic>>().map(MerTrendPoint.fromJson).toList(),

      merTooltip: tooltips['mer'] as String? ?? '',

    );

  }

}



class CampaignDetailKey {

  const CampaignDetailKey({

    required this.channel,

    required this.campaignId,

    this.windowDays = 7,

  });



  final String channel;

  final String campaignId;

  final int windowDays;



  @override

  bool operator ==(Object other) =>

      other is CampaignDetailKey &&

      other.channel == channel &&

      other.campaignId == campaignId &&

      other.windowDays == windowDays;



  @override

  int get hashCode => Object.hash(channel, campaignId, windowDays);

}



class MarketingRepository {

  MarketingRepository(this._dio);



  final Dio _dio;



  Future<MarketingOverview> getOverview({int windowDays = 7}) async {

    final response = await _dio.get<Map<String, dynamic>>(

      '/api/v1/marketing/overview',

      queryParameters: {'window_days': windowDays},

    );

    return MarketingOverview.fromJson(response.data!);

  }



  Future<CampaignDetail?> getCampaignDetail(CampaignDetailKey key) async {

    final encodedChannel = Uri.encodeComponent(key.channel);

    final encodedCampaignId = Uri.encodeComponent(key.campaignId);

    final response = await _dio.get<Map<String, dynamic>>(

      '/api/v1/marketing/campaigns/$encodedChannel/$encodedCampaignId',

      queryParameters: {

        'window_days': key.windowDays,

        'trend_days': 30,

      },

    );

    return CampaignDetail.fromJson(response.data!);

  }



  Future<MarketingMerResponse> getMer({int windowDays = 30, int trendDays = 30}) async {

    final response = await _dio.get<Map<String, dynamic>>(

      '/api/v1/marketing/mer',

      queryParameters: {

        'window_days': windowDays,

        'trend_days': trendDays,

      },

    );

    return MarketingMerResponse.fromJson(response.data!);

  }

}



final marketingRepositoryProvider = Provider<MarketingRepository>((ref) {

  return MarketingRepository(ref.watch(apiClientProvider).dio);

});



final marketingOverviewProvider =

    FutureProvider.autoDispose.family<MarketingOverview, int>((ref, windowDays) async {

  return ref.watch(marketingRepositoryProvider).getOverview(windowDays: windowDays);

});



final campaignDetailProvider =

    FutureProvider.autoDispose.family<CampaignDetail?, CampaignDetailKey>((ref, key) async {

  return ref.watch(marketingRepositoryProvider).getCampaignDetail(key);

});



final marketingMerProvider = FutureProvider.autoDispose<MarketingMerResponse>((ref) async {

  return ref.watch(marketingRepositoryProvider).getMer();

});



String formatMarketingRatio(double? value) {

  if (value == null) return '—';

  return value.toStringAsFixed(2);

}



String formatMarketingCurrency(double value) {

  if (value >= 1000) {

    return '\$${(value / 1000).toStringAsFixed(1)}k';

  }

  return '\$${value.round()}';

}

