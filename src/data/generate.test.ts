import { describe, expect, it } from 'vitest';
import { generateDemo } from './generate';

describe('demo dataset', () => {
  const t0 = performance.now();
  const d = generateDemo('2026-10-14');
  const ms = performance.now() - t0;
  const stock = (sku: string) => d.balances.filter((b) => d.batches.find((x) => x.id === b.batchId)!.productId === `prd_${sku}`).reduce((s, b) => s + b.qty, 0);

  it('builds quickly and reconciles on-hand stock to the plan', () => {
    expect(ms).toBeLessThan(4000);
    expect(stock('AMUL-TZ1L')).toBe(248);
    expect(stock('BRIT-BRD400')).toBe(40);
    expect(stock('HARPIC-500')).toBe(0);
  });

  it('balances equal the movement ledger', () => {
    const ledger = new Map<string, number>();
    d.movements.forEach((m) => ledger.set(`${m.batchId}|${m.locationId}`, (ledger.get(`${m.batchId}|${m.locationId}`) ?? 0) + m.qty));
    for (const b of d.balances) expect(Math.round((ledger.get(`${b.batchId}|${b.locationId}`) ?? 0) * 1000) / 1000).toBe(b.qty);
  });

  it('invoice totals reconcile', () => {
    for (const inv of d.invoices) {
      expect(inv.total).toBeCloseTo(inv.taxable + inv.tax + inv.roundOff, 6);
      expect(inv.paid + inv.due).toBeCloseTo(inv.total, 6);
    }
    console.log('invoices', d.invoices.length, 'ms', Math.round(ms), 'revenue', Math.round(d.invoices.reduce((s, i) => s + i.total, 0)));
  });
});
