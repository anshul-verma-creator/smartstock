/**
 * Explainable, rule-based retail intelligence. No black boxes: every number here can be shown with its formula.
 *
 *  velocity      = 0.6 × (avg units/day, last 7 days) + 0.4 × (avg units/day, last 28 days)
 *  7-day forecast = velocity × day-of-week factor, normalised so the 7 days sum to 7 × velocity
 *  expiry risk   = FEFO: demand before each batch's expiry is used by earlier-expiring batches first;
 *                  unsold = qty − min(qty, velocity × days left − demand already used)
 *  reorder qty   = ceil(velocity × (lead time + 7-day review) + min stock − available), when at/under min or cover < lead time + 3
 */
import { addDays, diffDays } from './dates';

export const MIN_HISTORY_DAYS = 14;

export interface DailyQty {
  [date: string]: number;
}

export interface Velocity {
  perDay: number;
  avg7: number;
  avg28: number;
  daysOfHistory: number;
  sufficient: boolean;
}

export function velocity(daily: DailyQty, today: string, firstSaleDate?: string): Velocity {
  // completed days only: today is still in progress
  let s7 = 0;
  let s28 = 0;
  for (let i = 1; i <= 28; i++) {
    const q = daily[addDays(today, -i)] ?? 0;
    if (i <= 7) s7 += q;
    s28 += q;
  }
  const daysOfHistory = firstSaleDate ? Math.max(0, diffDays(today, firstSaleDate)) : 0;
  const avg7 = s7 / 7;
  const avg28 = s28 / 28;
  return {
    perDay: 0.6 * avg7 + 0.4 * avg28,
    avg7,
    avg28,
    daysOfHistory,
    sufficient: daysOfHistory >= MIN_HISTORY_DAYS && s28 > 0,
  };
}

export interface ForecastDay {
  date: string;
  units: number;
}

export function forecast7(daily: DailyQty, today: string, v: Velocity): ForecastDay[] {
  // day-of-week shape from the last 28 completed days
  const sums = new Array(7).fill(0);
  const counts = new Array(7).fill(0);
  for (let i = 1; i <= 28; i++) {
    const d = addDays(today, -i);
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    sums[dow] += daily[d] ?? 0;
    counts[dow] += 1;
  }
  const overall = sums.reduce((a, b) => a + b, 0) / 28 || 1;
  const factor = sums.map((s, i) => Math.min(1.6, Math.max(0.6, (s / Math.max(1, counts[i])) / overall)));
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1));
  const f = days.map((d) => factor[new Date(`${d}T00:00:00Z`).getUTCDay()]);
  const meanF = f.reduce((a, b) => a + b, 0) / 7;
  return days.map((date, i) => ({ date, units: Math.round(v.perDay * (f[i] / meanF) * 10) / 10 }));
}

export const sumUnits = (days: ForecastDay[]) => Math.round(days.reduce((s, d) => s + d.units, 0) * 10) / 10;

export interface BatchLike {
  id: string;
  qty: number;
  expiry: string | null;
}

export interface BatchRisk {
  id: string;
  qty: number;
  daysLeft: number | null;
  expectedSold: number;
  unsold: number;
}

/** Allocates expected demand across batches in first-expiry-first-out order (no double counting). */
export function expiryRisk(batches: BatchLike[], perDay: number, today: string): BatchRisk[] {
  const sorted = [...batches]
    .filter((b) => b.qty > 0)
    .sort((a, b) => (a.expiry ?? '9999') .localeCompare(b.expiry ?? '9999'));
  let used = 0;
  return sorted.map((b) => {
    if (!b.expiry) return { id: b.id, qty: b.qty, daysLeft: null, expectedSold: b.qty, unsold: 0 };
    const daysLeft = diffDays(b.expiry, today);
    if (daysLeft < 0) return { id: b.id, qty: b.qty, daysLeft, expectedSold: 0, unsold: b.qty };
    const capacity = Math.max(0, perDay * daysLeft - used);
    const sold = Math.min(b.qty, capacity);
    used += sold;
    return { id: b.id, qty: b.qty, daysLeft, expectedSold: Math.round(sold * 10) / 10, unsold: Math.round((b.qty - sold) * 10) / 10 };
  });
}

export type ExpiryStatus = 'expired' | 'today' | 'soon' | 'safe' | 'none';

export function expiryStatus(expiry: string | null, today: string, warnDays: number): ExpiryStatus {
  if (!expiry) return 'none';
  const d = diffDays(expiry, today);
  if (d < 0) return 'expired';
  if (d === 0) return 'today';
  if (d <= warnDays) return 'soon';
  return 'safe';
}

export interface ReorderSuggestion {
  needed: boolean;
  quantity: number;
  coverDays: number | null;
  reason: string;
}

export function reorder(available: number, minStock: number, perDay: number, leadTimeDays: number, wholeUnits: boolean): ReorderSuggestion {
  const coverDays = perDay > 0 ? available / perDay : null;
  const low = available <= minStock;
  const shortCover = coverDays !== null && coverDays < leadTimeDays + 3;
  if (!low && !shortCover) return { needed: false, quantity: 0, coverDays, reason: '' };
  const raw = perDay * (leadTimeDays + 7) + minStock - available;
  const q = Math.max(wholeUnits ? Math.ceil(raw) : Math.ceil(raw * 2) / 2, wholeUnits ? 1 : 0.5);
  const reason = low
    ? `Stock ${available} is at or below the minimum of ${minStock}.`
    : `Only ${coverDays?.toFixed(1)} days of cover, supplier needs ${leadTimeDays} days.`;
  return { needed: true, quantity: q, coverDays, reason };
}

/** Suggested rescue discount: smallest of 10/15/20/25% that is expected to clear the forecast unsold units. */
export function suggestDiscount(unsold: number, qty: number): number {
  if (unsold <= 0) return 0;
  const share = unsold / qty;
  if (share < 0.2) return 10;
  if (share < 0.4) return 15;
  if (share < 0.6) return 20;
  return 25;
}
