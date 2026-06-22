import 'package:flutter/material.dart';

import '../../../core/integrations/integrations_repository.dart';
import 'integration_card_shared.dart';

class ShopifyIntegrationCard extends StatelessWidget {
  const ShopifyIntegrationCard({
    super.key,
    required this.status,
    this.dataCoveragePct = 0,
  });

  final ShopifyIntegrationStatus status;
  final int dataCoveragePct;

  @override
  Widget build(BuildContext context) {
    return UnifiedIntegrationCard(
      name: 'Shopify',
      icon: Icons.storefront_outlined,
      status: status.status,
      dataCoveragePct: dataCoveragePct,
      detailLines: [
        if (status.shopDomain != null) status.shopDomain!,
      ],
      syncMessage: status.status == IntegrationStatus.syncing
          ? (status.partialBriefAvailable
              ? 'Partial brief available while sync continues'
              : 'Syncing orders and catalog…')
          : null,
      errorMessage: status.errorMessage,
      lastSyncAt: status.lastSyncAt,
    );
  }
}
