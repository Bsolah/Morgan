import { and, desc, eq } from "drizzle-orm";
import {
  xeroAccountMappings,
  xeroAccounts,
  xeroPnlSnapshots,
  type Database,
} from "@morgan/db";
import {
  defaultMorganCategoryForXeroAccount,
  isAccountingMorganCategory,
  type AccountingMorganCategory,
} from "@morgan/integrations";

export type XeroAccountMappingView = {
  xero_account_id: string;
  account_name: string;
  account_type: string | null;
  account_subtype: string | null;
  morgan_category: AccountingMorganCategory;
  is_custom_mapping: boolean;
};

export async function listXeroAccountMappings(
  db: Database,
  storeId: string,
): Promise<XeroAccountMappingView[]> {
  const accounts = await db
    .select()
    .from(xeroAccounts)
    .where(eq(xeroAccounts.storeId, storeId));

  if (accounts.length === 0) return [];

  const customMappings = await db
    .select()
    .from(xeroAccountMappings)
    .where(eq(xeroAccountMappings.storeId, storeId));

  const customByAccountId = new Map(customMappings.map((row) => [row.xeroAccountId, row.morganCategory]));

  return accounts.map((account) => {
    const custom = customByAccountId.get(account.xeroAccountId);
    const defaultCategory = defaultMorganCategoryForXeroAccount({
      AccountID: account.xeroAccountId,
      Name: account.accountName,
      Type: account.accountType ?? undefined,
      Class: account.accountSubtype ?? undefined,
    });

    return {
      xero_account_id: account.xeroAccountId,
      account_name: account.accountName,
      account_type: account.accountType,
      account_subtype: account.accountSubtype,
      morgan_category: custom ?? defaultCategory,
      is_custom_mapping: custom != null,
    };
  });
}

export async function updateXeroAccountMappings(
  db: Database,
  storeId: string,
  integrationId: string,
  mappings: Array<{ xero_account_id: string; morgan_category: string }>,
): Promise<XeroAccountMappingView[]> {
  for (const mapping of mappings) {
    if (!isAccountingMorganCategory(mapping.morgan_category)) {
      throw new Error("invalid_category");
    }

    await db
      .insert(xeroAccountMappings)
      .values({
        storeId,
        integrationId,
        xeroAccountId: mapping.xero_account_id,
        morganCategory: mapping.morgan_category,
      })
      .onConflictDoUpdate({
        target: [xeroAccountMappings.storeId, xeroAccountMappings.xeroAccountId],
        set: {
          morganCategory: mapping.morgan_category,
          updatedAt: new Date(),
        },
      });
  }

  return listXeroAccountMappings(db, storeId);
}

export async function buildXeroCategoryMaps(db: Database, storeId: string): Promise<{
  byAccountId: Map<string, AccountingMorganCategory>;
  byAccountName: Map<string, AccountingMorganCategory>;
}> {
  const rows = await listXeroAccountMappings(db, storeId);
  const byAccountId = new Map<string, AccountingMorganCategory>();
  const byAccountName = new Map<string, AccountingMorganCategory>();

  for (const row of rows) {
    byAccountId.set(row.xero_account_id, row.morgan_category);
    byAccountName.set(row.account_name.toLowerCase(), row.morgan_category);
  }

  return { byAccountId, byAccountName };
}

export async function getXeroCogsRateForStore(
  db: Database,
  storeId: string,
  shopifyRevenueMtd: number,
): Promise<number | null> {
  const { computeQboCogsRate } = await import("@morgan/integrations");

  const [snapshot] = await db
    .select()
    .from(xeroPnlSnapshots)
    .where(eq(xeroPnlSnapshots.storeId, storeId))
    .orderBy(desc(xeroPnlSnapshots.asOfDay))
    .limit(1);

  if (!snapshot) return null;

  const cogsTotal = Number(snapshot.cogsTotal);
  const revenueBase = shopifyRevenueMtd > 0 ? shopifyRevenueMtd : Number(snapshot.totalIncome);
  return computeQboCogsRate(cogsTotal, revenueBase);
}
