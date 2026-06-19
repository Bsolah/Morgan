import { shopifyAdminGraphql } from "./admin-graphql.js";

export type BulkOperationStatus = {
  id: string;
  status: "CREATED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELED";
  errorCode?: string | null;
  objectCount?: string | null;
  url?: string | null;
  partialDataUrl?: string | null;
};

export function buildOrdersBackfillBulkQuery(sinceIsoDate: string): string {
  const since = sinceIsoDate.slice(0, 10);
  return `{
  orders(query: "created_at:>=${since}") {
    edges {
      node {
        id
        name
        createdAt
        updatedAt
        cancelledAt
        displayFinancialStatus
        displayFulfillmentStatus
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        subtotalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        totalDiscountsSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        customerJourneySummary {
          firstVisit {
            landingPage
            source
            utmParameters {
              campaign
              medium
              source
            }
          }
        }
        lineItems(first: 50) {
          edges {
            node {
              id
              sku
              quantity
              originalUnitPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    }
  }
}`;
}

export async function startOrdersBulkOperation(
  shopDomain: string,
  accessToken: string,
  sinceIsoDate: string,
): Promise<BulkOperationStatus> {
  const query = buildOrdersBackfillBulkQuery(sinceIsoDate);
  const data = await shopifyAdminGraphql<{
    bulkOperationRunQuery: {
      bulkOperation: BulkOperationStatus | null;
      userErrors: Array<{ field: string[] | null; message: string }>;
    };
  }>(
    shopDomain,
    accessToken,
    `mutation StartOrdersBackfill($query: String!) {
      bulkOperationRunQuery(query: $query) {
        bulkOperation {
          id
          status
          errorCode
          objectCount
          url
        }
        userErrors {
          field
          message
        }
      }
    }`,
    { query },
  );

  const payload = data.bulkOperationRunQuery;
  if (payload.userErrors.length > 0) {
    throw new Error(payload.userErrors.map((error) => error.message).join("; "));
  }
  if (!payload.bulkOperation) {
    throw new Error("Shopify bulk operation did not start");
  }

  return payload.bulkOperation;
}

export async function getCurrentBulkOperation(
  shopDomain: string,
  accessToken: string,
): Promise<BulkOperationStatus | null> {
  const data = await shopifyAdminGraphql<{
    currentBulkOperation: BulkOperationStatus | null;
  }>(
    shopDomain,
    accessToken,
    `query CurrentBulkOperation {
      currentBulkOperation {
        id
        status
        errorCode
        objectCount
        url
        partialDataUrl
      }
    }`,
  );

  return data.currentBulkOperation;
}

export async function downloadBulkOperationJsonl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download bulk operation results: ${res.status}`);
  }
  return res.text();
}

export function parseBulkOrderRecords(jsonl: string, startLine = 0): {
  records: Array<Record<string, unknown>>;
  nextLine: number;
} {
  const lines = jsonl.split("\n").filter((line) => line.trim().length > 0);
  const records: Array<Record<string, unknown>> = [];

  for (let index = startLine; index < lines.length; index++) {
    records.push(JSON.parse(lines[index]!) as Record<string, unknown>);
  }

  return {
    records,
    nextLine: lines.length,
  };
}

export function extractShopifyOrderId(record: Record<string, unknown>): string | null {
  const id = record.id;
  if (typeof id !== "string") return null;
  const parts = id.split("/");
  return parts[parts.length - 1] ?? id;
}
