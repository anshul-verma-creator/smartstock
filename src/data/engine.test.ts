import { describe, expect, it } from 'vitest';
import { generateDemo } from './generate';
import { batchQty, confirmRescue, customerDue, postSale, recordCustomerPayment, requestRescue, transferStock, voidInvoice } from './engine';
import type { AppData } from './types';

const fresh = () => structuredClone(generateDemo('2026-10-14'));
const stock = (d: AppData, pid: string) => d.batches.filter((b) => b.productId === pid).reduce((a, b) => a + batchQty(d, b.id), 0);
const ts = '2026-10-14T10:00:00.000Z';

describe('posting engine', () => {
  it('a sale deducts stock exactly once, FEFO first', () => {
    const d = fresh();
    const before = stock(d, 'prd_AMUL-TZ1L');
    const inv = postSale(d, { lines: [{ productId: 'prd_AMUL-TZ1L', qty: 3 }], payments: [], settle: 'cash', date: d.anchor, ts });
    expect(stock(d, 'prd_AMUL-TZ1L')).toBe(before - 3);
    expect(inv.lines[0].batches[0].code).toBe('BPL2610A');
    expect(inv.total).toBe(168);
    expect(inv.paid).toBe(168);
  });

  it('refuses to oversell and leaves state untouched', () => {
    const d = fresh();
    expect(() => postSale(d, { lines: [{ productId: 'prd_PARLE-G250', qty: 999 }], payments: [], settle: 'cash', date: d.anchor, ts })).toThrow(/Not enough stock/);
  });

  it('blocks expired stock', () => {
    const d = fresh();
    const exp = d.batches.find((b) => b.code === 'ORS23J07')!;
    expect(() => postSale(d, { lines: [{ productId: 'prd_ORS-21G', qty: 1, batchId: exp.id }], payments: [], settle: 'cash', date: d.anchor, ts })).toThrow(/expired/);
  });

  it('credit needs a customer and creates dues; repayment reduces them without a new sale', () => {
    const d = fresh();
    expect(() => postSale(d, { lines: [{ productId: 'prd_TATA-SALT1', qty: 1 }], payments: [], date: d.anchor, ts })).toThrow(/customer/);
    const before = customerDue(d, 'cus_1');
    const n = d.invoices.length;
    const inv = postSale(d, { lines: [{ productId: 'prd_TATA-SALT1', qty: 2 }], payments: [{ method: 'cash', amount: 20 }], customerId: 'cus_1', date: d.anchor, ts });
    expect(inv.due).toBe(36);
    expect(customerDue(d, 'cus_1')).toBeCloseTo(before + 36, 6);
    recordCustomerPayment(d, 'cus_1', 36, 'upi', undefined, d.anchor, ts);
    expect(customerDue(d, 'cus_1')).toBeCloseTo(before, 6);
    expect(d.invoices.length).toBe(n + 1);
    expect(() => recordCustomerPayment(d, 'cus_1', before + 1000, 'cash', undefined, d.anchor, ts)).toThrow(/cannot be more/);
  });

  it('split payments must not exceed the total', () => {
    const d = fresh();
    expect(() => postSale(d, { lines: [{ productId: 'prd_TATA-SALT1', qty: 1 }], payments: [{ method: 'cash', amount: 20 }, { method: 'upi', amount: 20 }], date: d.anchor, ts })).toThrow(/more than the bill/);
  });

  it('void restores stock and records refunds, keeping the invoice', () => {
    const d = fresh();
    const before = stock(d, 'prd_MAGGI-70');
    const inv = postSale(d, { lines: [{ productId: 'prd_MAGGI-70', qty: 4 }], payments: [], settle: 'upi', date: d.anchor, ts });
    voidInvoice(d, inv.id, 'Billed twice', d.anchor, ts);
    expect(stock(d, 'prd_MAGGI-70')).toBe(before);
    expect(d.invoices.find((i) => i.id === inv.id)!.status).toBe('voided');
    expect(d.payments.some((p) => p.kind === 'refund' && p.invoiceId === inv.id && p.amount === inv.total)).toBe(true);
  });

  it('cashiers are held to the discount limit', () => {
    const d = fresh();
    d.role = 'cashier';
    expect(() => postSale(d, { lines: [{ productId: 'prd_AASH-ATTA5', qty: 1, lineDiscount: 60 }], payments: [], settle: 'cash', date: d.anchor, ts })).toThrow(/at most 10%/);
  });

  it('transfers move location but not total stock', () => {
    const d = fresh();
    const before = stock(d, 'prd_MAGGI-70');
    transferStock(d, 'prd_MAGGI-70', 'loc_BACK', 'loc_A12', 20, d.anchor, ts);
    expect(stock(d, 'prd_MAGGI-70')).toBe(before);
  });

  it('expired stock cannot be discounted, but can be returned to the supplier', () => {
    const d = fresh();
    const exp = d.batches.find((b) => b.code === 'ORS23J07')!;
    expect(() => requestRescue(d, 'discount', exp.id, 6, { discountPct: 20 }, d.anchor)).toThrow(/never be sold/);
    const ev = d.rescues.find((r) => r.batchId === exp.id && r.type === 'supplier_return')!;
    confirmRescue(d, ev.id, 6, {}, d.anchor, ts);
    expect(batchQty(d, exp.id)).toBe(0);
    expect(ev.recovered).toBe(108);
  });
});
