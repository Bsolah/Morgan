import type { Database } from "@morgan/db";
import { organizations, stores } from "@morgan/db";

export const STUB_ORG_ID = "00000000-0000-4000-8000-000000000001";
export const STUB_STORE_ID = "00000000-0000-4000-8000-000000000002";

export async function ensureStubStoreForTests(db: Database): Promise<void> {
  await db
    .insert(organizations)
    .values({ id: STUB_ORG_ID, name: "Stub Org" })
    .onConflictDoNothing();

  await db
    .insert(stores)
    .values({
      id: STUB_STORE_ID,
      orgId: STUB_ORG_ID,
      shopDomain: "demo.myshopify.com",
    })
    .onConflictDoNothing();
}
