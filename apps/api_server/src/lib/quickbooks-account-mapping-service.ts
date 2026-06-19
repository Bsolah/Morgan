import { and, desc, eq } from "drizzle-orm";
import {
  quickbooksAccountMappings,
  quickbooksAccounts,
  quickbooksPnlSnapshots,
  type Database,
} from "@morgan/db";
import {
  defaultMorganCategoryForAccount,
  isQuickBooksMorganCategory,
  type QuickBooksMorganCategory,
} from "@morgan/integrations";

export type QuickBooksAccountMappingView = {
  qbo_account_id: string;
  account_name: string;
  account_type: string | null;
  account_subtype: string | null;
  morgan_category: QuickBooksMorganCategory;
  is_custom_mapping: boolean;
};

export async function listQuickBooksAccountMappings(
  db: Database,
  storeId: string,
): Promise<QuickBooksAccountMappingView[]> {
  const accounts = await db
    .select()
    .from(quickbooksAccounts)
    .where(eq(quickbooksAccounts.storeId, storeId));

  if (accounts.length === 0) return [];

  const customMappings = await db
    .select()
    .from(quickbooksAccountMappings)
    .where(eq(quickbooksAccountMappings.storeId, storeId));

  const customByAccountId = new Map(customMappings.map((row) => [row.qboAccountId, row.morganCategory]));

  return accounts.map((account) => {
    const custom = customByAccountId.get(account.qboAccountId);
    const defaultCategory = defaultMorganCategoryForAccount({
      Id: account.qboAccountId,
      Name: account.accountName,
      AccountType: account.accountType ?? undefined,
      AccountSubType: account.accountSubtype ?? undefined,
    });

    return {
      qbo_account_id: account.qboAccountId,
      account_name: account.accountName,
      account_type: account.accountType,
      account_subtype: account.accountSubtype,
      morgan_category: custom ?? defaultCategory,
      is_custom_mapping: custom != null,
    };
  });
}

export async function updateQuickBooksAccountMappings(
  db: Database,
  storeId: string,
  integrationId: string,
  mappings: Array<{ qbo_account_id: string; morgan_category: string }>,
): Promise<QuickBooksAccountMappingView[]> {
  for (const mapping of mappings) {
    if (!isQuickBooksMorganCategory(mapping.morgan_category)) {
      throw new Error("invalid_category");
    }

    await db
      .insert(quickbooksAccountMappings)
      .values({
        storeId,
        integrationId,
        qboAccountId: mapping.qbo_account_id,
        morganCategory: mapping.morgan_category,
      })
      .onConflictDoUpdate({
        target: [quickbooksAccountMappings.storeId, quickbooksAccountMappings.qboAccountId],
        set: {
          morganCategory: mapping.morgan_category,
          updatedAt: new Date(),
        },
      });
  }

  return listQuickBooksAccountMappings(db, storeId);
}

export async function buildQuickBooksCategoryMaps(db: Database, storeId: string): Promise<{
  byAccountId: Map<string, QuickBooksMorganCategory>;
  byAccountName: Map<string, QuickBooksMorganCategory>;
}> {
  const rows = await listQuickBooksAccountMappings(db, storeId);
  const byAccountId = new Map<string, QuickBooksMorganCategory>();
  const byAccountName = new Map<string, QuickBooksMorganCategory>();

  for (const row of rows) {
    byAccountId.set(row.qbo_account_id, row.morgan_category);
    byAccountName.set(row.account_name.toLowerCase(), row.morgan_category);
  }

  return { byAccountId, byAccountName };
}

export async function getLatestQuickBooksCogsTotal(db: Database, storeId: string): Promise<number | null> {
  const [row] = await db
    .select({ cogsTotal: quickbooksPnlSnapshots.cogsTotal })
    .from(quickbooksPnlSnapshots)
    .where(eq(quickbooksPnlSnapshots.storeId, storeId))
    .orderBy(desc(quickbooksPnlSnapshots.asOfDay))
    .limit(1);

  if (!row) return null;
  return Number(row.cogsTotal);
}

export async function getQuickBooksCogsRateForStore(
  db: Database,
  storeId: string,
  shopifyRevenueMtd: number,
): Promise<number | null> {
  const { computeQboCogsRate } = await import("@morgan/integrations");

  const [snapshot] = await db
    .select()
    .from(quickbooksPnlSnapshots)
    .where(eq(quickbooksPnlSnapshots.storeId, storeId))
    .orderBy(desc(quickbooksPnlSnapshots.asOfDay))
    .limit(1);

  if (!snapshot) return null;

  const cogsTotal = Number(snapshot.cogsTotal);
  const revenueBase = shopifyRevenueMtd > 0 ? shopifyRevenueMtd : Number(snapshot.totalIncome);
  return computeQboCogsRate(cogsTotal, revenueBase);
}
