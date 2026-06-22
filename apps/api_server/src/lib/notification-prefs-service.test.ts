import { describe, expect, it, vi } from "vitest";
import { DEFAULT_NOTIFICATION_PREFS } from "./alerts-data.js";
import {
  getStoreNotificationPrefs,
  updateStoreNotificationPrefs,
} from "./notification-prefs-service.js";

type FinanceRow = {
  storeId: string;
  notificationPrefs: unknown;
};

function mockDb(initialRow: FinanceRow | null = null) {
  let row = initialRow;

  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => (row ? [row] : [])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((input: Partial<FinanceRow> & { storeId: string }) => {
        const returning = vi.fn(async () => {
          if (!row) {
            row = {
              storeId: input.storeId,
              notificationPrefs: input.notificationPrefs ?? null,
            };
          }
          return [row];
        });

        const onConflictDoUpdate = vi.fn(() => ({
          set: vi.fn(async (update: { notificationPrefs: unknown }) => {
            row = {
              storeId: input.storeId,
              notificationPrefs: update.notificationPrefs,
            };
          }),
        }));

        return { returning, onConflictDoUpdate };
      }),
    })),
  };
}

describe("notification prefs service", () => {
  it("returns defaults when no row exists", async () => {
    const db = mockDb(null);
    const prefs = await getStoreNotificationPrefs(db as never, "store-1");

    expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it("merges stored prefs with defaults", async () => {
    const db = mockDb({ storeId: "store-1", notificationPrefs: { push_daily_brief: false } });
    const prefs = await getStoreNotificationPrefs(db as never, "store-1");

    expect(prefs.push_daily_brief).toBe(false);
    expect(prefs.push_warnings).toBe(true);
    expect(prefs.quiet_hours_start).toBe(22);
    expect(prefs.quiet_hours_end).toBe(7);
  });

  it("persists partial updates", async () => {
    const db = mockDb(null);
    const updated = await updateStoreNotificationPrefs(db as never, "store-1", {
      push_warnings: false,
      quiet_hours_start: 21,
    });

    expect(updated.push_warnings).toBe(false);
    expect(updated.quiet_hours_start).toBe(21);
    expect(updated.push_daily_brief).toBe(true);
  });
});
