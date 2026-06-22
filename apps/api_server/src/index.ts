import { buildApp } from "./app.js";
import { env } from "./config.js";
import { closeDb } from "./lib/db.js";
import { closeIngestRuntime } from "./lib/ingest-runtime.js";
import { startOrderBackfillRunner, stopOrderBackfillRunner } from "./lib/order-backfill-runner.js";
import { startProductCatalogRunner, stopProductCatalogRunner } from "./lib/product-catalog-runner.js";
import { startPayoutSyncRunner, stopPayoutSyncRunner } from "./lib/payout-sync-runner.js";
import {
  startCompliancePurgeRunner,
  stopCompliancePurgeRunner,
} from "./lib/compliance-purge-runner.js";
import {
  startMetaInsightsSyncRunner,
  stopMetaInsightsSyncRunner,
} from "./lib/meta-insights-sync-runner.js";
import {
  startMetaTokenRefreshRunner,
  stopMetaTokenRefreshRunner,
} from "./lib/meta-token-refresh-runner.js";
import {
  startPlaidTransactionSyncRunner,
  stopPlaidTransactionSyncRunner,
} from "./lib/plaid-transaction-sync-runner.js";
import {
  startBriefingRunner,
  stopBriefingRunner,
} from "./lib/briefing-runner.js";
import {
  startRevenueForecastRunner,
  stopRevenueForecastRunner,
} from "./lib/revenue-forecast-runner.js";
import {
  startSkuDemandForecastRunner,
  stopSkuDemandForecastRunner,
} from "./lib/sku-demand-forecast-runner.js";
import {
  startCashRunwayRunner,
  stopCashRunwayRunner,
} from "./lib/cash-runway-runner.js";
import {
  startQuickBooksTokenRefreshRunner,
  stopQuickBooksTokenRefreshRunner,
} from "./lib/quickbooks-token-refresh-runner.js";
import {
  startQuickBooksSyncRunner,
  stopQuickBooksSyncRunner,
} from "./lib/quickbooks-sync-runner.js";
import {
  startGoogleAdsInsightsSyncRunner,
  stopGoogleAdsInsightsSyncRunner,
} from "./lib/google-ads-insights-sync-runner.js";
import {
  startGoogleAdsTokenRefreshRunner,
  stopGoogleAdsTokenRefreshRunner,
} from "./lib/google-ads-token-refresh-runner.js";
import {
  startXeroTokenRefreshRunner,
  stopXeroTokenRefreshRunner,
} from "./lib/xero-token-refresh-runner.js";
import {
  startWeeklyEmailDigestRunner,
  stopWeeklyEmailDigestRunner,
} from "./lib/weekly-email-digest-runner.js";
import {
  startProfitLeakScanRunner,
  stopProfitLeakScanRunner,
} from "./lib/profit-leak-scan-runner.js";
import { startXeroSyncRunner, stopXeroSyncRunner } from "./lib/xero-sync-runner.js";
import {
  startMetricsRecalcRunner,
  stopMetricsRecalcRunner,
} from "./lib/metrics-recalc-runner.js";

const app = await buildApp();
startOrderBackfillRunner();
startProductCatalogRunner();
startPayoutSyncRunner();
startCompliancePurgeRunner();
startMetaTokenRefreshRunner();
startMetaInsightsSyncRunner();
startPlaidTransactionSyncRunner();
startCashRunwayRunner();
startBriefingRunner();
startWeeklyEmailDigestRunner();
startProfitLeakScanRunner();
startMetricsRecalcRunner();
startRevenueForecastRunner();
startSkuDemandForecastRunner();
startQuickBooksTokenRefreshRunner();
startQuickBooksSyncRunner();
startGoogleAdsTokenRefreshRunner();
startGoogleAdsInsightsSyncRunner();
startXeroTokenRefreshRunner();
startXeroSyncRunner();

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info(`Morgan API listening on http://localhost:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    stopOrderBackfillRunner();
    stopProductCatalogRunner();
    stopPayoutSyncRunner();
    stopCompliancePurgeRunner();
    stopMetaTokenRefreshRunner();
    stopMetaInsightsSyncRunner();
    stopPlaidTransactionSyncRunner();
    stopCashRunwayRunner();
    stopBriefingRunner();
    stopWeeklyEmailDigestRunner();
    stopProfitLeakScanRunner();
    stopMetricsRecalcRunner();
    stopRevenueForecastRunner();
    stopSkuDemandForecastRunner();
    stopQuickBooksTokenRefreshRunner();
    stopQuickBooksSyncRunner();
    stopGoogleAdsTokenRefreshRunner();
    stopGoogleAdsInsightsSyncRunner();
    stopXeroTokenRefreshRunner();
    stopXeroSyncRunner();
    await closeIngestRuntime();
    await closeDb();
    process.exit(0);
  });
}
