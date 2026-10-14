import { describe, expect, it } from 'vitest';
import { calcInvoice } from './tax';

const base = { interState: false, taxApplicable: true, roundOff: false };

describe('GST engine', () => {
  it('spec case: 2 × ₹100 exclusive @18% intra-state', () => {
    const r = calcInvoice({ ...base, lines: [{ quantity: 2, unitPrice: 100, priceIncludesTax: false, gstRate: 18 }] });
    expect(r.taxable).toBe(200);
    expect(r.tax).toBe(36);
    expect(r.cgst).toBe(18);
    expect(r.sgst).toBe(18);
    expect(r.igst).toBe(0);
    expect(r.grandTotal).toBe(236);
  });

  it('spec case: inter-state puts all GST in IGST', () => {
    const r = calcInvoice({ ...base, interState: true, lines: [{ quantity: 2, unitPrice: 100, priceIncludesTax: false, gstRate: 18 }] });
    expect(r.igst).toBe(36);
    expect(r.cgst + r.sgst).toBe(0);
    expect(r.grandTotal).toBe(236);
  });

  it('inclusive price keeps the shelf price as the line total', () => {
    const r = calcInvoice({ ...base, lines: [{ quantity: 1, unitPrice: 118, priceIncludesTax: true, gstRate: 18 }] });
    expect(r.taxable).toBe(100);
    expect(r.tax).toBe(18);
    expect(r.grandTotal).toBe(118);
  });

  it('inclusive with awkward amount reconciles to the paisa', () => {
    const r = calcInvoice({ ...base, lines: [{ quantity: 3, unitPrice: 40, priceIncludesTax: true, gstRate: 40 }] });
    expect(r.taxable).toBe(85.71);
    expect(r.taxable + r.tax).toBeCloseTo(120, 10);
    expect(r.cgst).toBe(17.15);
    expect(r.sgst).toBe(17.14);
  });

  it('exempt items carry no tax', () => {
    const r = calcInvoice({ ...base, lines: [{ quantity: 4, unitPrice: 56, priceIncludesTax: true, gstRate: 0 }] });
    expect(r.tax).toBe(0);
    expect(r.grandTotal).toBe(224);
  });

  it('unregistered seller charges no GST', () => {
    const r = calcInvoice({ ...base, taxApplicable: false, lines: [{ quantity: 1, unitPrice: 100, priceIncludesTax: false, gstRate: 18 }] });
    expect(r.tax).toBe(0);
    expect(r.grandTotal).toBe(100);
  });

  it('line discount reduces the taxable value before tax', () => {
    const r = calcInvoice({ ...base, lines: [{ quantity: 2, unitPrice: 100, lineDiscount: 20, priceIncludesTax: false, gstRate: 18 }] });
    expect(r.taxable).toBe(180);
    expect(r.tax).toBe(32.4);
    expect(r.grandTotal).toBe(212.4);
  });

  it('invoice discount is allocated proportionally and sums exactly', () => {
    const r = calcInvoice({
      ...base,
      invoiceDiscount: 10,
      lines: [
        { quantity: 1, unitPrice: 33.33, priceIncludesTax: false, gstRate: 5 },
        { quantity: 1, unitPrice: 33.33, priceIncludesTax: false, gstRate: 18 },
        { quantity: 1, unitPrice: 33.34, priceIncludesTax: false, gstRate: 0 },
      ],
    });
    const shares = r.lines.reduce((s, l) => s + l.invoiceDiscountShare, 0);
    expect(shares).toBeCloseTo(10, 10);
    expect(r.taxable).toBeCloseTo(90, 10);
  });

  it('multi-line totals reconcile with lines and round-off', () => {
    const r = calcInvoice({
      ...base,
      roundOff: true,
      lines: [
        { quantity: 2, unitPrice: 56, priceIncludesTax: true, gstRate: 0 },
        { quantity: 1, unitPrice: 60, priceIncludesTax: true, gstRate: 5 },
        { quantity: 3, unitPrice: 14.5, priceIncludesTax: false, gstRate: 18 },
      ],
    });
    const lineSum = r.lines.reduce((s, l) => s + l.total, 0);
    expect(r.subtotal).toBeCloseTo(lineSum, 10);
    expect(r.grandTotal).toBe(Math.round(r.subtotal));
    expect(r.grandTotal).toBeCloseTo(r.taxable + r.tax + r.roundOff, 10);
  });

  it('rejects discounts larger than the amount', () => {
    expect(() => calcInvoice({ ...base, lines: [{ quantity: 1, unitPrice: 10, lineDiscount: 11, priceIncludesTax: false, gstRate: 5 }] })).toThrow();
  });
});
