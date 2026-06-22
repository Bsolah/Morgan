import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../network/api_client.dart';

enum IntegrationStatus { connected, syncing, error, disconnected }

IntegrationStatus parseIntegrationStatus(String? raw) {
  return switch (raw) {
    'connected' => IntegrationStatus.connected,
    'syncing' => IntegrationStatus.syncing,
    'error' => IntegrationStatus.error,
    _ => IntegrationStatus.disconnected,
  };
}

class MetaIntegrationStatus {
  const MetaIntegrationStatus({
    required this.status,
    this.lastSyncAt,
    this.lastSuccessfulSyncAt,
    this.errorMessage,
    this.syncErrorMessage,
    this.adAccountId,
    this.adAccountName,
    this.needsAccountSelection = false,
    this.needsReauth = false,
    this.insightsBackfillCompleted = false,
  });

  final IntegrationStatus status;
  final DateTime? lastSyncAt;
  final DateTime? lastSuccessfulSyncAt;
  final String? errorMessage;
  final String? syncErrorMessage;
  final String? adAccountId;
  final String? adAccountName;
  final bool needsAccountSelection;
  final bool needsReauth;
  final bool insightsBackfillCompleted;

  factory MetaIntegrationStatus.fromJson(Map<String, dynamic> json) {
    return MetaIntegrationStatus(
      status: parseIntegrationStatus(json['status'] as String?),
      lastSyncAt: json['last_sync_at'] != null
          ? DateTime.tryParse(json['last_sync_at'] as String)
          : null,
      lastSuccessfulSyncAt: json['last_successful_sync_at'] != null
          ? DateTime.tryParse(json['last_successful_sync_at'] as String)
          : null,
      errorMessage: json['error_message'] as String?,
      syncErrorMessage: json['sync_error_message'] as String?,
      adAccountId: json['ad_account_id'] as String?,
      adAccountName: json['ad_account_name'] as String?,
      needsAccountSelection: json['needs_account_selection'] as bool? ?? false,
      needsReauth: json['needs_reauth'] as bool? ?? false,
      insightsBackfillCompleted: json['insights_backfill_completed'] as bool? ?? false,
    );
  }

  bool get isConnected =>
      status == IntegrationStatus.connected || status == IntegrationStatus.syncing;
}

class MetaAdAccountOption {
  const MetaAdAccountOption({
    required this.id,
    required this.name,
    this.currency,
    this.isSelected = false,
  });

  final String id;
  final String name;
  final String? currency;
  final bool isSelected;

  factory MetaAdAccountOption.fromJson(Map<String, dynamic> json) {
    return MetaAdAccountOption(
      id: json['id'] as String,
      name: json['name'] as String,
      currency: json['currency'] as String?,
      isSelected: json['is_selected'] as bool? ?? false,
    );
  }
}

class IntegrationsRepository {
  IntegrationsRepository(this._dio);

  final Dio _dio;

  Future<MetaIntegrationStatus> getMetaStatus() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/integrations/meta');
    return MetaIntegrationStatus.fromJson(response.data!);
  }

  Future<String> getMetaOAuthStartUrl() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/integrations/meta/oauth/start',
      queryParameters: const {'platform': 'mobile'},
    );
    return response.data!['authorize_url'] as String;
  }

  Future<List<MetaAdAccountOption>> listMetaAdAccounts() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/integrations/meta/ad-accounts');
    final accounts = response.data!['ad_accounts'] as List<dynamic>? ?? [];
    return accounts
        .map((item) => MetaAdAccountOption.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<MetaIntegrationStatus> selectMetaAdAccount(String adAccountId) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/v1/integrations/meta/ad-account',
      data: {'ad_account_id': adAccountId},
    );
    final status = response.data!['status'] as Map<String, dynamic>;
    return MetaIntegrationStatus.fromJson(status);
  }

  Future<MetaIntegrationStatus> disconnectMeta() async {
    final response = await _dio.post<Map<String, dynamic>>('/api/v1/integrations/meta/disconnect');
    final status = response.data!['status'] as Map<String, dynamic>;
    return MetaIntegrationStatus.fromJson(status);
  }

  Future<PlaidIntegrationStatus> getPlaidStatus() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/integrations/plaid');
    return PlaidIntegrationStatus.fromJson(response.data!);
  }

  Future<PlaidLinkTokenResponse> createPlaidLinkToken() async {
    final response = await _dio.post<Map<String, dynamic>>('/api/v1/integrations/plaid/link-token');
    return PlaidLinkTokenResponse.fromJson(response.data!);
  }

  Future<PlaidIntegrationStatus> exchangePlaidPublicToken(String publicToken) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/v1/integrations/plaid/exchange-public-token',
      data: {'public_token': publicToken},
    );
    final status = response.data!['status'] as Map<String, dynamic>;
    return PlaidIntegrationStatus.fromJson(status);
  }

  Future<PlaidIntegrationStatus> disconnectPlaid() async {
    final response = await _dio.post<Map<String, dynamic>>('/api/v1/integrations/plaid/disconnect');
    final status = response.data!['status'] as Map<String, dynamic>;
    return PlaidIntegrationStatus.fromJson(status);
  }

  Future<QuickBooksIntegrationStatus> getQuickBooksStatus() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/integrations/quickbooks');
    return QuickBooksIntegrationStatus.fromJson(response.data!);
  }

  Future<String> getQuickBooksOAuthStartUrl() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/integrations/quickbooks/oauth/start',
      queryParameters: const {'platform': 'mobile'},
    );
    return response.data!['authorize_url'] as String;
  }

  Future<List<QuickBooksCompanyOption>> listQuickBooksCompanies() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/integrations/quickbooks/companies');
    final companies = response.data!['companies'] as List<dynamic>? ?? [];
    return companies
        .map((item) => QuickBooksCompanyOption.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<QuickBooksIntegrationStatus> selectQuickBooksCompany(String realmId) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/v1/integrations/quickbooks/company',
      data: {'realm_id': realmId},
    );
    final status = response.data!['status'] as Map<String, dynamic>;
    return QuickBooksIntegrationStatus.fromJson(status);
  }

  Future<QuickBooksIntegrationStatus> disconnectQuickBooks() async {
    final response = await _dio.post<Map<String, dynamic>>('/api/v1/integrations/quickbooks/disconnect');
    final status = response.data!['status'] as Map<String, dynamic>;
    return QuickBooksIntegrationStatus.fromJson(status);
  }

  Future<List<QuickBooksAccountMapping>> listQuickBooksAccountMappings() async {
    final response =
        await _dio.get<Map<String, dynamic>>('/api/v1/integrations/quickbooks/account-mappings');
    final mappings = response.data!['mappings'] as List<dynamic>? ?? [];
    return mappings
        .map((item) => QuickBooksAccountMapping.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<List<QuickBooksAccountMapping>> updateQuickBooksAccountMappings(
    List<QuickBooksAccountMappingUpdate> mappings,
  ) async {
    final response = await _dio.put<Map<String, dynamic>>(
      '/api/v1/integrations/quickbooks/account-mappings',
      data: {
        'mappings': mappings
            .map(
              (mapping) => {
                'qbo_account_id': mapping.qboAccountId,
                'morgan_category': mapping.morganCategory,
              },
            )
            .toList(),
      },
    );
    final rows = response.data!['mappings'] as List<dynamic>? ?? [];
    return rows
        .map((item) => QuickBooksAccountMapping.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<XeroIntegrationStatus> getXeroStatus() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/integrations/xero');
    return XeroIntegrationStatus.fromJson(response.data!);
  }

  Future<String> getXeroOAuthStartUrl() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/integrations/xero/oauth/start',
      queryParameters: const {'platform': 'mobile'},
    );
    return response.data!['authorize_url'] as String;
  }

  Future<List<XeroTenantOption>> listXeroTenants() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/integrations/xero/tenants');
    final tenants = response.data!['tenants'] as List<dynamic>? ?? [];
    return tenants
        .map((item) => XeroTenantOption.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<XeroIntegrationStatus> selectXeroTenant(String tenantId) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/v1/integrations/xero/tenant',
      data: {'tenant_id': tenantId},
    );
    final status = response.data!['status'] as Map<String, dynamic>;
    return XeroIntegrationStatus.fromJson(status);
  }

  Future<XeroIntegrationStatus> disconnectXero() async {
    final response = await _dio.post<Map<String, dynamic>>('/api/v1/integrations/xero/disconnect');
    final status = response.data!['status'] as Map<String, dynamic>;
    return XeroIntegrationStatus.fromJson(status);
  }

  Future<List<XeroAccountMapping>> listXeroAccountMappings() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/integrations/xero/account-mappings');
    final mappings = response.data!['mappings'] as List<dynamic>? ?? [];
    return mappings
        .map((item) => XeroAccountMapping.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<List<XeroAccountMapping>> updateXeroAccountMappings(
    List<XeroAccountMappingUpdate> mappings,
  ) async {
    final response = await _dio.put<Map<String, dynamic>>(
      '/api/v1/integrations/xero/account-mappings',
      data: {
        'mappings': mappings
            .map(
              (mapping) => {
                'xero_account_id': mapping.xeroAccountId,
                'morgan_category': mapping.morganCategory,
              },
            )
            .toList(),
      },
    );
    final rows = response.data!['mappings'] as List<dynamic>? ?? [];
    return rows
        .map((item) => XeroAccountMapping.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<GoogleAdsIntegrationStatus> getGoogleAdsStatus() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/integrations/google-ads');
    return GoogleAdsIntegrationStatus.fromJson(response.data!);
  }

  Future<String> getGoogleAdsOAuthStartUrl() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/integrations/google-ads/oauth/start',
      queryParameters: const {'platform': 'mobile'},
    );
    return response.data!['authorize_url'] as String;
  }

  Future<List<GoogleAdsAccountOption>> listGoogleAdsManagerAccounts() async {
    final response =
        await _dio.get<Map<String, dynamic>>('/api/v1/integrations/google-ads/manager-accounts');
    final accounts = response.data!['manager_accounts'] as List<dynamic>? ?? [];
    return accounts
        .map((item) => GoogleAdsAccountOption.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<List<GoogleAdsAccountOption>> listGoogleAdsClientAccounts() async {
    final response =
        await _dio.get<Map<String, dynamic>>('/api/v1/integrations/google-ads/client-accounts');
    final accounts = response.data!['client_accounts'] as List<dynamic>? ?? [];
    return accounts
        .map((item) => GoogleAdsAccountOption.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<GoogleAdsIntegrationStatus> selectGoogleAdsManagerAccount(String managerCustomerId) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/v1/integrations/google-ads/manager-account',
      data: {'manager_customer_id': managerCustomerId},
    );
    final status = response.data!['status'] as Map<String, dynamic>;
    return GoogleAdsIntegrationStatus.fromJson(status);
  }

  Future<GoogleAdsIntegrationStatus> selectGoogleAdsClientAccount(String clientCustomerId) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/v1/integrations/google-ads/client-account',
      data: {'client_customer_id': clientCustomerId},
    );
    final status = response.data!['status'] as Map<String, dynamic>;
    return GoogleAdsIntegrationStatus.fromJson(status);
  }

  Future<GoogleAdsIntegrationStatus> disconnectGoogleAds() async {
    final response = await _dio.post<Map<String, dynamic>>('/api/v1/integrations/google-ads/disconnect');
    final status = response.data!['status'] as Map<String, dynamic>;
    return GoogleAdsIntegrationStatus.fromJson(status);
  }

  Future<IntegrationsHubView> getIntegrationsHub() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/integrations/hub');
    return IntegrationsHubView.fromJson(response.data!);
  }
}

final integrationsRepositoryProvider = Provider<IntegrationsRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return IntegrationsRepository(apiClient.dio);
});

final metaIntegrationStatusProvider = FutureProvider<MetaIntegrationStatus>((ref) async {
  final repo = ref.watch(integrationsRepositoryProvider);
  return repo.getMetaStatus();
});

final plaidIntegrationStatusProvider = FutureProvider<PlaidIntegrationStatus>((ref) async {
  final repo = ref.watch(integrationsRepositoryProvider);
  return repo.getPlaidStatus();
});

final quickbooksIntegrationStatusProvider = FutureProvider<QuickBooksIntegrationStatus>((ref) async {
  final repo = ref.watch(integrationsRepositoryProvider);
  return repo.getQuickBooksStatus();
});

final xeroIntegrationStatusProvider = FutureProvider<XeroIntegrationStatus>((ref) async {
  final repo = ref.watch(integrationsRepositoryProvider);
  return repo.getXeroStatus();
});

final googleAdsIntegrationStatusProvider = FutureProvider<GoogleAdsIntegrationStatus>((ref) async {
  final repo = ref.watch(integrationsRepositoryProvider);
  return repo.getGoogleAdsStatus();
});

class IntegrationHubCardView {
  const IntegrationHubCardView({
    required this.provider,
    required this.label,
    required this.status,
    this.lastSyncAt,
    this.errorMessage,
    required this.dataCoveragePct,
    this.comingSoon = false,
    this.details = const {},
  });

  final String provider;
  final String label;
  final IntegrationStatus status;
  final DateTime? lastSyncAt;
  final String? errorMessage;
  final int dataCoveragePct;
  final bool comingSoon;
  final Map<String, dynamic> details;

  factory IntegrationHubCardView.fromJson(Map<String, dynamic> json) {
    return IntegrationHubCardView(
      provider: json['provider'] as String,
      label: json['label'] as String,
      status: parseIntegrationStatus(json['status'] as String?),
      lastSyncAt: json['last_sync_at'] != null
          ? DateTime.tryParse(json['last_sync_at'] as String)
          : null,
      errorMessage: json['error_message'] as String?,
      dataCoveragePct: json['data_coverage_pct'] as int? ?? 0,
      comingSoon: json['coming_soon'] as bool? ?? false,
      details: Map<String, dynamic>.from(json['details'] as Map? ?? {}),
    );
  }
}

class IntegrationsHubView {
  const IntegrationsHubView({
    required this.integrations,
    required this.overallDataCoveragePct,
    this.summaryMessage,
  });

  final List<IntegrationHubCardView> integrations;
  final int overallDataCoveragePct;
  final String? summaryMessage;

  factory IntegrationsHubView.fromJson(Map<String, dynamic> json) {
    final cards = (json['integrations'] as List<dynamic>? ?? [])
        .map((item) => IntegrationHubCardView.fromJson(item as Map<String, dynamic>))
        .toList();

    return IntegrationsHubView(
      integrations: cards,
      overallDataCoveragePct: json['overall_data_coverage_pct'] as int? ?? 0,
      summaryMessage: json['summary_message'] as String?,
    );
  }

  IntegrationHubCardView? cardFor(String provider) {
    for (final card in integrations) {
      if (card.provider == provider) return card;
    }
    return null;
  }
}

class ShopifyIntegrationStatus {
  const ShopifyIntegrationStatus({
    required this.status,
    this.shopDomain,
    this.lastSyncAt,
    this.errorMessage,
    this.ordersSyncCompleted = false,
    this.partialBriefAvailable = false,
    this.productsSyncCompleted = false,
  });

  final IntegrationStatus status;
  final String? shopDomain;
  final DateTime? lastSyncAt;
  final String? errorMessage;
  final bool ordersSyncCompleted;
  final bool partialBriefAvailable;
  final bool productsSyncCompleted;

  factory ShopifyIntegrationStatus.fromHubDetails(Map<String, dynamic> json) {
    return ShopifyIntegrationStatus(
      status: parseIntegrationStatus(json['status'] as String?),
      shopDomain: json['shop_domain'] as String?,
      lastSyncAt: json['last_sync_at'] != null
          ? DateTime.tryParse(json['last_sync_at'] as String)
          : null,
      errorMessage: json['error_message'] as String?,
      ordersSyncCompleted: json['orders_sync_completed'] as bool? ?? false,
      partialBriefAvailable: json['partial_brief_available'] as bool? ?? false,
      productsSyncCompleted: json['products_sync_completed'] as bool? ?? false,
    );
  }
}

final integrationsHubProvider = FutureProvider<IntegrationsHubView>((ref) async {
  final repo = ref.watch(integrationsRepositoryProvider);
  return repo.getIntegrationsHub();
});

const metaOAuthErrorMessages = <String, String>{
  'invalid_state': 'Connection failed — try again.',
  'token_exchange_failed': 'Connection failed — try again.',
  'not_configured': 'Meta Ads connection is not available right now.',
  'server_error': 'Connection failed — try again.',
  'access_denied': 'Meta authorization was cancelled.',
  'no_ad_accounts': 'No Meta ad accounts were found for this Facebook account.',
};

String metaOAuthErrorMessage(String? code) {
  if (code == null || code.isEmpty) return metaOAuthErrorMessages['server_error']!;
  return metaOAuthErrorMessages[code] ?? metaOAuthErrorMessages['server_error']!;
}

const quickBooksOAuthErrorMessages = <String, String>{
  'invalid_state': 'Connection failed — try again.',
  'token_exchange_failed': 'Connection failed — try again.',
  'not_configured': 'QuickBooks connection is not available right now.',
  'server_error': 'Connection failed — try again.',
  'access_denied': 'QuickBooks authorization was cancelled.',
  'missing_realm': 'QuickBooks did not return a company. Try connecting again.',
  'reauth_required': 'QuickBooks needs to be reconnected.',
};

String quickBooksOAuthErrorMessage(String? code) {
  if (code == null || code.isEmpty) return quickBooksOAuthErrorMessages['server_error']!;
  return quickBooksOAuthErrorMessages[code] ?? quickBooksOAuthErrorMessages['server_error']!;
}

const googleAdsOAuthErrorMessages = <String, String>{
  'invalid_state': 'Connection failed — try again.',
  'token_exchange_failed': 'Connection failed — try again.',
  'not_configured': 'Google Ads connection is not available right now.',
  'server_error': 'Connection failed — try again.',
  'access_denied': 'Google authorization was cancelled.',
  'no_accounts': 'No Google Ads accounts were found for this Google account.',
};

String googleAdsOAuthErrorMessage(String? code) {
  if (code == null || code.isEmpty) return googleAdsOAuthErrorMessages['server_error']!;
  return googleAdsOAuthErrorMessages[code] ?? googleAdsOAuthErrorMessages['server_error']!;
}

String metaOAuthCallbackScheme() {
  return AppConfig.deepLinkScheme;
}

class PlaidIntegrationStatus {
  const PlaidIntegrationStatus({
    required this.status,
    this.lastSyncAt,
    this.initialSyncCompleted = false,
    this.pendingUncategorizedCount = 0,
    this.errorMessage,
    this.institutionName,
    this.accountName,
    this.accountMask,
    this.accountSubtype,
    this.privacyDisclosure = plaidPrivacyDisclosure,
  });

  final IntegrationStatus status;
  final DateTime? lastSyncAt;
  final bool initialSyncCompleted;
  final int pendingUncategorizedCount;
  final String? errorMessage;
  final String? institutionName;
  final String? accountName;
  final String? accountMask;
  final String? accountSubtype;
  final String privacyDisclosure;

  bool get isConnected =>
      status == IntegrationStatus.connected || status == IntegrationStatus.syncing;

  String? get displayLabel {
    if (institutionName == null && accountMask == null) return null;
    final institution = institutionName ?? 'Bank account';
    if (accountMask == null || accountMask!.isEmpty) return institution;
    return '$institution ·••• $accountMask';
  }

  factory PlaidIntegrationStatus.fromJson(Map<String, dynamic> json) {
    return PlaidIntegrationStatus(
      status: parseIntegrationStatus(json['status'] as String?),
      lastSyncAt: json['last_sync_at'] != null
          ? DateTime.tryParse(json['last_sync_at'] as String)
          : null,
      initialSyncCompleted: json['initial_sync_completed'] as bool? ?? false,
      pendingUncategorizedCount: json['pending_uncategorized_count'] as int? ?? 0,
      errorMessage: json['error_message'] as String?,
      institutionName: json['institution_name'] as String?,
      accountName: json['account_name'] as String?,
      accountMask: json['account_mask'] as String?,
      accountSubtype: json['account_subtype'] as String?,
      privacyDisclosure: json['privacy_disclosure'] as String? ?? plaidPrivacyDisclosure,
    );
  }
}

const plaidPrivacyDisclosure =
    'We read transactions to forecast cash, never move money';

class PlaidLinkTokenResponse {
  const PlaidLinkTokenResponse({
    required this.linkToken,
    required this.expiration,
    required this.privacyDisclosure,
  });

  final String linkToken;
  final String expiration;
  final String privacyDisclosure;

  factory PlaidLinkTokenResponse.fromJson(Map<String, dynamic> json) {
    return PlaidLinkTokenResponse(
      linkToken: json['link_token'] as String,
      expiration: json['expiration'] as String,
      privacyDisclosure: json['privacy_disclosure'] as String? ?? plaidPrivacyDisclosure,
    );
  }
}

class QuickBooksIntegrationStatus {
  const QuickBooksIntegrationStatus({
    required this.status,
    this.lastSyncAt,
    this.errorMessage,
    this.companyId,
    this.companyName,
    this.needsCompanySelection = false,
    this.needsReauth = false,
    this.reauthDueAt,
    this.booksInitialSyncCompleted = false,
    this.syncFailureCount = 0,
  });

  final IntegrationStatus status;
  final DateTime? lastSyncAt;
  final String? errorMessage;
  final String? companyId;
  final String? companyName;
  final bool needsCompanySelection;
  final bool needsReauth;
  final DateTime? reauthDueAt;
  final bool booksInitialSyncCompleted;
  final int syncFailureCount;

  bool get isConnected =>
      status == IntegrationStatus.connected || status == IntegrationStatus.syncing;

  factory QuickBooksIntegrationStatus.fromJson(Map<String, dynamic> json) {
    return QuickBooksIntegrationStatus(
      status: parseIntegrationStatus(json['status'] as String?),
      lastSyncAt: json['last_sync_at'] != null
          ? DateTime.tryParse(json['last_sync_at'] as String)
          : null,
      errorMessage: json['error_message'] as String?,
      companyId: json['company_id'] as String?,
      companyName: json['company_name'] as String?,
      needsCompanySelection: json['needs_company_selection'] as bool? ?? false,
      needsReauth: json['needs_reauth'] as bool? ?? false,
      reauthDueAt: json['reauth_due_at'] != null
          ? DateTime.tryParse(json['reauth_due_at'] as String)
          : null,
      booksInitialSyncCompleted: json['books_initial_sync_completed'] as bool? ?? false,
      syncFailureCount: json['sync_failure_count'] as int? ?? 0,
    );
  }
}

class QuickBooksCompanyOption {
  const QuickBooksCompanyOption({
    required this.id,
    required this.name,
    this.country,
    this.isSelected = false,
  });

  final String id;
  final String name;
  final String? country;
  final bool isSelected;

  factory QuickBooksCompanyOption.fromJson(Map<String, dynamic> json) {
    return QuickBooksCompanyOption(
      id: json['id'] as String,
      name: json['name'] as String,
      country: json['country'] as String?,
      isSelected: json['is_selected'] as bool? ?? false,
    );
  }
}

const quickBooksMorganCategories = [
  'cogs',
  'shipping',
  'marketing',
  'opex',
  'other',
  'unmapped',
];

String quickBooksMorganCategoryLabel(String category) {
  return switch (category) {
    'cogs' => 'COGS',
    'shipping' => 'Shipping',
    'marketing' => 'Marketing',
    'opex' => 'Operating expenses',
    'other' => 'Other',
    _ => 'Unmapped',
  };
}

class QuickBooksAccountMapping {
  const QuickBooksAccountMapping({
    required this.qboAccountId,
    required this.accountName,
    required this.morganCategory,
    this.accountType,
    this.accountSubtype,
    this.isCustomMapping = false,
  });

  final String qboAccountId;
  final String accountName;
  final String? accountType;
  final String? accountSubtype;
  final String morganCategory;
  final bool isCustomMapping;

  factory QuickBooksAccountMapping.fromJson(Map<String, dynamic> json) {
    return QuickBooksAccountMapping(
      qboAccountId: json['qbo_account_id'] as String,
      accountName: json['account_name'] as String,
      accountType: json['account_type'] as String?,
      accountSubtype: json['account_subtype'] as String?,
      morganCategory: json['morgan_category'] as String,
      isCustomMapping: json['is_custom_mapping'] as bool? ?? false,
    );
  }
}

class QuickBooksAccountMappingUpdate {
  const QuickBooksAccountMappingUpdate({
    required this.qboAccountId,
    required this.morganCategory,
  });

  final String qboAccountId;
  final String morganCategory;
}

class XeroIntegrationStatus {
  const XeroIntegrationStatus({
    required this.status,
    this.lastSyncAt,
    this.errorMessage,
    this.tenantId,
    this.tenantName,
    this.needsTenantSelection = false,
    this.needsReauth = false,
    this.reauthDueAt,
    this.booksInitialSyncCompleted = false,
    this.syncFailureCount = 0,
  });

  final IntegrationStatus status;
  final DateTime? lastSyncAt;
  final String? errorMessage;
  final String? tenantId;
  final String? tenantName;
  final bool needsTenantSelection;
  final bool needsReauth;
  final DateTime? reauthDueAt;
  final bool booksInitialSyncCompleted;
  final int syncFailureCount;

  bool get isConnected =>
      status == IntegrationStatus.connected || status == IntegrationStatus.syncing;

  factory XeroIntegrationStatus.fromJson(Map<String, dynamic> json) {
    return XeroIntegrationStatus(
      status: parseIntegrationStatus(json['status'] as String?),
      lastSyncAt: json['last_sync_at'] != null
          ? DateTime.tryParse(json['last_sync_at'] as String)
          : null,
      errorMessage: json['error_message'] as String?,
      tenantId: json['tenant_id'] as String?,
      tenantName: json['tenant_name'] as String?,
      needsTenantSelection: json['needs_tenant_selection'] as bool? ?? false,
      needsReauth: json['needs_reauth'] as bool? ?? false,
      reauthDueAt: json['reauth_due_at'] != null
          ? DateTime.tryParse(json['reauth_due_at'] as String)
          : null,
      booksInitialSyncCompleted: json['books_initial_sync_completed'] as bool? ?? false,
      syncFailureCount: json['sync_failure_count'] as int? ?? 0,
    );
  }
}

class XeroTenantOption {
  const XeroTenantOption({
    required this.id,
    required this.name,
    this.tenantType,
    this.isSelected = false,
  });

  final String id;
  final String name;
  final String? tenantType;
  final bool isSelected;

  factory XeroTenantOption.fromJson(Map<String, dynamic> json) {
    return XeroTenantOption(
      id: json['id'] as String,
      name: json['name'] as String,
      tenantType: json['tenant_type'] as String?,
      isSelected: json['is_selected'] as bool? ?? false,
    );
  }
}

class XeroAccountMapping {
  const XeroAccountMapping({
    required this.xeroAccountId,
    required this.accountName,
    required this.morganCategory,
    this.accountType,
    this.accountSubtype,
    this.isCustomMapping = false,
  });

  final String xeroAccountId;
  final String accountName;
  final String? accountType;
  final String? accountSubtype;
  final String morganCategory;
  final bool isCustomMapping;

  factory XeroAccountMapping.fromJson(Map<String, dynamic> json) {
    return XeroAccountMapping(
      xeroAccountId: json['xero_account_id'] as String,
      accountName: json['account_name'] as String,
      accountType: json['account_type'] as String?,
      accountSubtype: json['account_subtype'] as String?,
      morganCategory: json['morgan_category'] as String,
      isCustomMapping: json['is_custom_mapping'] as bool? ?? false,
    );
  }
}

class XeroAccountMappingUpdate {
  const XeroAccountMappingUpdate({
    required this.xeroAccountId,
    required this.morganCategory,
  });

  final String xeroAccountId;
  final String morganCategory;
}

const xeroOAuthErrorMessages = <String, String>{
  'invalid_state': 'Connection failed — try again.',
  'token_exchange_failed': 'Connection failed — try again.',
  'not_configured': 'Xero connection is not available right now.',
  'server_error': 'Connection failed — try again.',
  'access_denied': 'Xero authorization was cancelled.',
  'missing_tenant': 'Xero did not return an organisation. Try connecting again.',
  'tenant_selection_required': 'Select a Xero organisation to finish connecting.',
};

String xeroOAuthErrorMessage(String? code) {
  if (code == null || code.isEmpty) return xeroOAuthErrorMessages['server_error']!;
  return xeroOAuthErrorMessages[code] ?? xeroOAuthErrorMessages['server_error']!;
}

class GoogleAdsIntegrationStatus {
  const GoogleAdsIntegrationStatus({
    required this.availability,
    required this.status,
    this.lastSyncAt,
    this.errorMessage,
    this.syncErrorMessage,
    this.managerCustomerId,
    this.managerCustomerName,
    this.clientCustomerId,
    this.clientCustomerName,
    this.needsManagerSelection = false,
    this.needsClientSelection = false,
    this.insightsBackfillCompleted = false,
  });

  final String availability;
  final IntegrationStatus status;
  final DateTime? lastSyncAt;
  final String? errorMessage;
  final String? syncErrorMessage;
  final String? managerCustomerId;
  final String? managerCustomerName;
  final String? clientCustomerId;
  final String? clientCustomerName;
  final bool needsManagerSelection;
  final bool needsClientSelection;
  final bool insightsBackfillCompleted;

  bool get isConnected =>
      status == IntegrationStatus.connected || status == IntegrationStatus.syncing;

  factory GoogleAdsIntegrationStatus.fromJson(Map<String, dynamic> json) {
    return GoogleAdsIntegrationStatus(
      availability: json['availability'] as String? ?? 'available',
      status: parseIntegrationStatus(json['status'] as String?),
      lastSyncAt: json['last_sync_at'] != null
          ? DateTime.tryParse(json['last_sync_at'] as String)
          : null,
      errorMessage: json['error_message'] as String?,
      syncErrorMessage: json['sync_error_message'] as String?,
      managerCustomerId: json['manager_customer_id'] as String?,
      managerCustomerName: json['manager_customer_name'] as String?,
      clientCustomerId: json['client_customer_id'] as String?,
      clientCustomerName: json['client_customer_name'] as String?,
      needsManagerSelection: json['needs_manager_selection'] as bool? ?? false,
      needsClientSelection: json['needs_client_selection'] as bool? ?? false,
      insightsBackfillCompleted: json['insights_backfill_completed'] as bool? ?? false,
    );
  }
}

class GoogleAdsAccountOption {
  const GoogleAdsAccountOption({
    required this.id,
    required this.name,
    this.currency,
    this.managerCustomerId,
    this.isSelected = false,
  });

  final String id;
  final String name;
  final String? currency;
  final String? managerCustomerId;
  final bool isSelected;

  factory GoogleAdsAccountOption.fromJson(Map<String, dynamic> json) {
    return GoogleAdsAccountOption(
      id: json['id'] as String,
      name: json['name'] as String,
      currency: json['currency'] as String?,
      managerCustomerId: json['manager_customer_id'] as String?,
      isSelected: json['is_selected'] as bool? ?? false,
    );
  }
}
