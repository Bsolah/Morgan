import 'package:flutter/material.dart';

import '../../../core/integrations/integrations_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_surface.dart';
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
    final p = context.morgan;
    final theme = Theme.of(context);

    return MorganSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IntegrationStatusIcon(status: status.status),
              const SizedBox(width: MorganSpace.sm),
              Icon(Icons.storefront_outlined, color: p.accent, size: 20),
              const SizedBox(width: MorganSpace.sm),
              Expanded(child: Text('Shopify', style: theme.textTheme.titleMedium)),
              IntegrationStatusChip(status: status.status),
            ],
          ),
          const SizedBox(height: MorganSpace.sm),
          if (status.shopDomain != null)
            Text(status.shopDomain!, style: theme.textTheme.bodySmall),
          if (status.status == IntegrationStatus.syncing)
            Text(
              status.partialBriefAvailable
                  ? 'Partial brief available while sync continues'
                  : 'Syncing orders and catalog…',
              style: theme.textTheme.bodySmall?.copyWith(color: p.accent),
            ),
          IntegrationLastSyncLine(lastSyncAt: status.lastSyncAt),
          if (status.errorMessage != null) ...[
            const SizedBox(height: MorganSpace.xs),
            Text(
              status.errorMessage!,
              style: theme.textTheme.bodySmall?.copyWith(color: p.loss),
            ),
          ],
          const SizedBox(height: MorganSpace.md),
          IntegrationDataCoverageBar(percent: dataCoveragePct, compact: true),
        ],
      ),
    );
  }
}
