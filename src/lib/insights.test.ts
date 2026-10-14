import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { expiryRisk, forecast7, reorder, sumUnits, velocity } from './insights';

const today = '2026-10-14';
const flat = (perDay: number, days = 40) =>
  Object.fromEntries(Array.from({ length: days }, (_, i) => [addDays(today, -(i + 1)), perDay]));

describe('insights', () => {
  it('velocity blends 7 and 28 day averages', () => {
    const v = velocity(flat(13), today, addDays(today, -40));
    expect(v.perDay).toBeCloseTo(13, 10);
    expect(v.sufficient).toBe(true);
  });

  it('flags insufficient history', () => {
    const v = velocity(flat(5, 5), today, addDays(today, -5));
    expect(v.sufficient).toBe(false);
  });

  it('7-day forecast sums to its headline', () => {
    const daily = flat(13);
    const v = velocity(daily, today, addDays(today, -40));
    const f = forecast7(daily, today, v);
    expect(f).toHaveLength(7);
    expect(sumUnits(f)).toBeCloseTo(91, 0);
  });

  it('spec bread case: 40 packets, 3 days, 6/day → ~22 unsold', () => {
    const r = expiryRisk([{ id: 'b', qty: 40, expiry: addDays(today, 3) }], 6, today);
    expect(r[0].unsold).toBe(22);
  });

  it('FEFO allocation does not double count demand across batches', () => {
    const r = expiryRisk(
      [
        { id: 'a', qty: 48, expiry: addDays(today, 12) },
        { id: 'b', qty: 120, expiry: addDays(today, 29) },
        { id: 'c', qty: 80, expiry: addDays(today, 45) },
      ],
      92 / 7,
      today,
    );
    expect(r[0].unsold).toBe(0);
    expect(r.reduce((s, x) => s + x.expectedSold, 0)).toBeLessThanOrEqual(248);
  });

  it('expired batches are fully at risk', () => {
    const r = expiryRisk([{ id: 'x', qty: 6, expiry: addDays(today, -3) }], 2, today);
    expect(r[0].unsold).toBe(6);
  });

  it('reorder suggests enough for lead time + review period', () => {
    const s = reorder(4, 10, 2, 2, true);
    expect(s.needed).toBe(true);
    expect(s.quantity).toBe(Math.ceil(2 * 9 + 10 - 4));
  });
});
