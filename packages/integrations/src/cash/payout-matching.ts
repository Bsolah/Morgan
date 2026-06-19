export const PAYOUT_AMOUNT_TOLERANCE_PCT = 1;
export const PAYOUT_MATCH_AUTO_THRESHOLD = 90;
export const PAYOUT_MATCH_MIN_BUSINESS_DAYS = 1;
export const PAYOUT_MATCH_MAX_BUSINESS_DAYS = 3;

export type PayoutCandidate = {
  id: string;
  issuedAt: string;
  netAmount: number;
  currency: string;
  status: string;
};

export type DepositCandidate = {
  id: string;
  transactionDate: string;
  amount: number;
  currency: string;
  name: string;
  merchantName: string | null;
  category: string;
  pending: boolean;
};

export type PayoutDepositMatchCandidate = {
  payoutId: string;
  depositId: string;
  confidenceScore: number;
};

function parseDay(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isBusinessDay(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

export function addBusinessDays(startDay: string, businessDays: number): string {
  const cursor = parseDay(startDay);
  let remaining = businessDays;

  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isBusinessDay(cursor)) {
      remaining -= 1;
    }
  }

  return formatDay(cursor);
}

export function businessDaysBetween(startDay: string, endDay: string): number | null {
  const start = parseDay(startDay);
  const end = parseDay(endDay);

  if (end < start) return null;

  let count = 0;
  const cursor = new Date(start.getTime());

  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isBusinessDay(cursor)) {
      count += 1;
    }
  }

  return count;
}

export function amountWithinTolerance(
  payoutAmount: number,
  depositAmount: number,
  tolerancePct = PAYOUT_AMOUNT_TOLERANCE_PCT,
): boolean {
  if (payoutAmount <= 0 || depositAmount <= 0) return false;
  const deltaPct = (Math.abs(depositAmount - payoutAmount) / payoutAmount) * 100;
  return deltaPct <= tolerancePct;
}

function amountMatchScore(payoutAmount: number, depositAmount: number): number {
  const deltaPct = (Math.abs(depositAmount - payoutAmount) / payoutAmount) * 100;
  if (deltaPct > PAYOUT_AMOUNT_TOLERANCE_PCT) return 0;
  if (deltaPct === 0) return 100;
  return Math.max(80, 100 - deltaPct * 20);
}

function dateMatchScore(payoutDay: string, depositDay: string): number {
  const businessDays = businessDaysBetween(payoutDay, depositDay);
  if (businessDays == null) return 0;
  if (businessDays < PAYOUT_MATCH_MIN_BUSINESS_DAYS || businessDays > PAYOUT_MATCH_MAX_BUSINESS_DAYS) {
    return 0;
  }

  if (businessDays === 1) return 100;
  if (businessDays === 2) return 95;
  return 90;
}

function categoryBonus(category: string): number {
  return category === "shopify_payout" ? 100 : 70;
}

export function scorePayoutDepositMatch(
  payout: PayoutCandidate,
  deposit: DepositCandidate,
): number | null {
  if (!isPayoutEligibleForMatching(payout)) return null;
  if (!isDepositEligibleForMatching(deposit)) return null;
  if (payout.currency !== deposit.currency) return null;
  if (!amountWithinTolerance(payout.netAmount, deposit.amount)) return null;

  const amountScore = amountMatchScore(payout.netAmount, deposit.amount);
  const dateScore = dateMatchScore(payout.issuedAt.slice(0, 10), deposit.transactionDate);
  if (dateScore === 0) return null;

  const categoryScore = categoryBonus(deposit.category);
  const pendingPenalty = deposit.pending ? 5 : 0;

  const weighted = amountScore * 0.6 + dateScore * 0.35 + categoryScore * 0.05;
  return Math.round(Math.max(0, Math.min(100, weighted - pendingPenalty)) * 100) / 100;
}

export function isPayoutEligibleForMatching(payout: PayoutCandidate): boolean {
  const status = payout.status.toLowerCase();
  return status === "paid" || status === "in_transit";
}

export function isDepositEligibleForMatching(deposit: DepositCandidate): boolean {
  return deposit.amount > 0;
}

export function findAutoPayoutDepositMatches(
  payouts: PayoutCandidate[],
  deposits: DepositCandidate[],
  threshold = PAYOUT_MATCH_AUTO_THRESHOLD,
): PayoutDepositMatchCandidate[] {
  const candidates: PayoutDepositMatchCandidate[] = [];

  for (const payout of payouts) {
    for (const deposit of deposits) {
      const confidenceScore = scorePayoutDepositMatch(payout, deposit);
      if (confidenceScore == null || confidenceScore < threshold) continue;
      candidates.push({
        payoutId: payout.id,
        depositId: deposit.id,
        confidenceScore,
      });
    }
  }

  candidates.sort((left, right) => right.confidenceScore - left.confidenceScore);

  const usedPayouts = new Set<string>();
  const usedDeposits = new Set<string>();
  const selected: PayoutDepositMatchCandidate[] = [];

  for (const candidate of candidates) {
    if (usedPayouts.has(candidate.payoutId) || usedDeposits.has(candidate.depositId)) continue;
    usedPayouts.add(candidate.payoutId);
    usedDeposits.add(candidate.depositId);
    selected.push(candidate);
  }

  return selected;
}
