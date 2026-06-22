export type ConflictGroup = "stock_up" | "stock_down" | "price_up" | "price_down";

export type ConflictAwareCandidate = {
  category: string;
  subject_sku?: string | null;
  rank_score: number;
};

export function conflictGroupForCategory(category: string): ConflictGroup | null {
  switch (category) {
    case "inventory_reorder":
      return "stock_up";
    case "inventory_liquidate":
    case "dead_stock":
      return "stock_down";
    case "discount_bleed":
      return "price_down";
    case "price_decrease":
      return "price_down";
    case "price_increase":
      return "price_up";
    default:
      return null;
  }
}

const CONFLICTING_GROUPS: Array<[ConflictGroup, ConflictGroup]> = [
  ["stock_up", "stock_down"],
  ["price_up", "price_down"],
];

function groupsConflict(left: ConflictGroup, right: ConflictGroup): boolean {
  return CONFLICTING_GROUPS.some(
    ([a, b]) => (a === left && b === right) || (a === right && b === left),
  );
}

export function candidatesConflict(
  left: ConflictAwareCandidate,
  right: ConflictAwareCandidate,
): boolean {
  const leftSku = left.subject_sku?.trim().toLowerCase();
  const rightSku = right.subject_sku?.trim().toLowerCase();
  if (!leftSku || !rightSku || leftSku !== rightSku) {
    return false;
  }

  const leftGroup = conflictGroupForCategory(left.category);
  const rightGroup = conflictGroupForCategory(right.category);
  if (!leftGroup || !rightGroup || leftGroup === rightGroup) {
    return false;
  }

  return groupsConflict(leftGroup, rightGroup);
}

export function selectNonConflictingCandidates<T extends ConflictAwareCandidate>(
  ranked: T[],
): T[] {
  const selected: T[] = [];

  for (const candidate of ranked) {
    const hasConflict = selected.some((picked) => candidatesConflict(candidate, picked));
    if (!hasConflict) {
      selected.push(candidate);
    }
  }

  return selected;
}
