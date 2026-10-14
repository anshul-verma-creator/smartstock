/**
 * In-browser posting engine for the frontend demo. It applies the same rules as the database posting
 * functions in supabase/migrations (FEFO allocation, central GST engine, payments, ledgers, audit-style
 * movements) so the UI behaves truthfully before the backend is connected. Every function mutates a draft.
 */
import { calcInvoice } from '@/lib/tax';
import { diffDays } from '@/lib/dates';
import { isWholeUnit } from '@/lib/format';
import type { AppData, Batch, Invoice, MovementType, PayMethod, Purchase, RescueEvent, RescueType } from './types';

let counter = 0;
export const uid = (p: string) => `${p}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export class PostingError extends Error {}
const fail = (m: string): never => {
  throw new PostingError(m);
};

export function fyShort(date: string) {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const start = m >= 4 ? y : y - 1;
  return `${String(start % 100).padStart(2, '0')}${String((start + 1) % 100).padStart(2, '0')}`;
}

export function moveStock(
  d: AppData, productId: string, batchId: string, locationId: string, type: MovementType, qty: number,
  note: string, date: string, ts: string, ref?: string,
) {
  if (qty === 0) return;
  const batch = d.batches.find((b) => b.id === batchId)!;
  let bal = d.balances.find((b) => b.batchId === batchId && b.locationId === locationId);
  if (!bal) {
    if (qty < 0) fail('Not enough stock at that location.');
    bal = { batchId, locationId, qty: 0 };
    d.balances.push(bal);
  }
  const next = Math.round((bal.qty + qty) * 1000) / 1000;
  if (next < 0) fail(`Not enough stock of ${d.products.find((p) => p.id === productId)?.name} at that location.`);
  bal.qty = next;
  d.movements.push({ id: uid('mv'), date, ts, productId, batchId, locationId, type, qty, unitCost: batch.unitCost, note, ref });
}

export const batchQty = (d: AppData, batchId: string) =>
  d.balances.filter((b) => b.batchId === batchId).reduce((s, b) => s + b.qty, 0);

// ───────────────────────── sales ─────────────────────────

export interface SaleLineInput {
  productId: string;
  qty: number;
  lineDiscount?: number;
  batchId?: string;
  rescueEventId?: string;
}

export interface SaleInput {
  lines: SaleLineInput[];
  customerId?: string;
  invoiceDiscount?: number;
  payments: { method: PayMethod; amount: number; reference?: string }[];
  settle?: PayMethod;
  date: string;
  ts: string;
  cashier?: string;
  interState?: boolean;
  /** internal: surplus listing price override */
  surplus?: boolean;
}

export function postSale(d: AppData, input: SaleInput): Invoice {
  const b = d.business;
  if (input.lines.length === 0) fail('Add at least one item to the bill.');
  const customer = input.customerId ? d.customers.find((c) => c.id === input.customerId) : undefined;
  if (input.customerId && !customer) fail('The selected customer was not found.');

  let manualDiscount = input.invoiceDiscount ?? 0;
  const prepared = input.lines.map((l) => {
    const p = d.products.find((x) => x.id === l.productId);
    if (!p) return fail('A product in the bill no longer exists.');
    if (p.status !== 'active') fail(`${p.name} is inactive and cannot be sold.`);
    if (!(l.qty > 0)) fail(`Enter a quantity above zero for ${p.name}.`);
    if (isWholeUnit(p.unit) && !Number.isInteger(l.qty)) fail(`${p.name} is sold in whole units.`);
    let price = p.price;
    let disc = Math.round((l.lineDiscount ?? 0) * 100) / 100;
    let batchId = l.batchId;
    if (l.rescueEventId) {
      const ev = d.rescues.find((r) => r.id === l.rescueEventId);
      if (!ev || ev.productId !== p.id) return fail('Invalid rescue offer on the bill.');
      if (ev.type === 'discount' && ev.status === 'approved') {
        disc = Math.round(Math.round(l.qty * price * 100) / 100 * (ev.discountPct ?? 0)) / 100;
      } else if (ev.type === 'surplus_sale' && input.surplus) {
        price = ev.offerPrice!;
        disc = 0;
      } else fail(`The rescue offer for ${p.name} is no longer active.`);
      batchId = ev.batchId;
    } else manualDiscount += disc;
    return { p, l, price, disc, batchId };
  });

  const grossTotal = prepared.reduce((s, x) => s + x.l.qty * x.price, 0);
  if (d.role === 'cashier' && grossTotal > 0 && (manualDiscount * 100) / grossTotal > b.cashierMaxDiscountPct + 0.005) {
    fail(`Cashiers can give at most ${b.cashierMaxDiscountPct}% discount. Ask a manager to approve a larger discount.`);
  }

  const inter = input.interState ?? false;
  const calc = calcInvoice({
    lines: prepared.map((x) => ({ quantity: x.l.qty, unitPrice: x.price, lineDiscount: x.disc, priceIncludesTax: x.p.includesTax, gstRate: x.p.gst })),
    invoiceDiscount: input.invoiceDiscount ?? 0,
    interState: inter,
    taxApplicable: b.gstRegistered,
    roundOff: b.roundOff,
  });

  // validate stock first (all-or-nothing)
  const plan = prepared.map((x) => {
    const candidates = d.batches
      .filter((bt) => bt.productId === x.p.id && (!x.batchId || bt.id === x.batchId))
      .filter((bt) => !b.blockExpiredSales || !bt.expiry || bt.expiry >= input.date)
      .sort((a, c) => (a.expiry ?? '9999').localeCompare(c.expiry ?? '9999') || a.receivedOn.localeCompare(c.receivedOn));
    let need = x.l.qty;
    const takes: { batch: Batch; locationId: string; qty: number }[] = [];
    for (const bt of candidates) {
      const bals = d.balances
        .filter((bl) => bl.batchId === bt.id && bl.qty > 0)
        .sort((a, c) => Number(d.locations.find((l) => l.id === a.locationId)?.kind === 'backroom') - Number(d.locations.find((l) => l.id === c.locationId)?.kind === 'backroom'));
      for (const bl of bals) {
        if (need <= 0) break;
        const t = Math.min(need, bl.qty);
        takes.push({ batch: bt, locationId: bl.locationId, qty: Math.round(t * 1000) / 1000 });
        need = Math.round((need - t) * 1000) / 1000;
      }
      if (need <= 0) break;
    }
    if (need > 0) {
      const avail = x.l.qty - need;
      const expired = d.batches
        .filter((bt) => bt.productId === x.p.id && bt.expiry && bt.expiry < input.date)
        .reduce((s, bt) => s + batchQty(d, bt.id), 0);
      fail(expired > 0
        ? `Only ${avail} of ${x.p.name} can be sold; ${expired} are expired and blocked from sale.`
        : `Not enough stock for ${x.p.name}: ${avail} available, ${x.l.qty} requested.`);
    }
    return takes;
  });

  let paid = 0;
  const payments = [...input.payments];
  for (const p of payments) {
    if (!(p.amount > 0)) fail('Each payment amount must be greater than zero.');
    paid += p.amount;
  }
  paid = Math.round(paid * 100) / 100;
  if (input.settle && calc.grandTotal - paid > 0) {
    payments.push({ method: input.settle, amount: Math.round((calc.grandTotal - paid) * 100) / 100 });
    paid = calc.grandTotal;
  }
  if (paid > calc.grandTotal + 0.001) fail(`Payments (₹${paid}) are more than the bill total (₹${calc.grandTotal}).`);
  const due = Math.round((calc.grandTotal - paid) * 100) / 100;
  if (due > 0 && !customer) fail('Select a customer to record an unpaid (pay later) amount.');

  d.seq.invoice += 1;
  const id = uid('inv');
  const number = `${b.invoicePrefix}/${fyShort(input.date)}/${String(d.seq.invoice).padStart(5, '0')}`;
  let costTotal = 0;
  const lines = prepared.map((x, i) => {
    let cost = 0;
    const batches: { batchId: string; code: string; qty: number }[] = [];
    for (const t of plan[i]) {
      moveStock(d, x.p.id, t.batch.id, t.locationId, 'sale', -t.qty, number, input.date, input.ts, id);
      cost += t.qty * t.batch.unitCost;
      const ex = batches.find((bb) => bb.batchId === t.batch.id);
      if (ex) ex.qty += t.qty;
      else batches.push({ batchId: t.batch.id, code: t.batch.code, qty: t.qty });
    }
    cost = Math.round(cost * 100) / 100;
    costTotal += cost;
    const r = calc.lines[i];
    if (x.l.rescueEventId) {
      const ev = d.rescues.find((e) => e.id === x.l.rescueEventId)!;
      if (ev.type === 'discount') {
        ev.confirmedQty += x.l.qty;
        ev.recovered = Math.round((ev.recovered + r.taxable) * 100) / 100;
      }
    }
    return {
      productId: x.p.id, name: x.p.name, sku: x.p.sku, hsn: x.p.hsn, unit: x.p.unit, qty: x.l.qty, unitPrice: x.price,
      includesTax: x.p.includesTax, gst: b.gstRegistered ? x.p.gst : 0, lineDiscount: r.lineDiscount,
      invoiceDiscountShare: r.invoiceDiscountShare, taxable: r.taxable, cgst: r.cgst, sgst: r.sgst, igst: r.igst,
      cess: r.cess, total: r.total, cost, batches, rescueEventId: x.l.rescueEventId,
    };
  });

  const inv: Invoice = {
    id, number, date: input.date, ts: input.ts, status: 'posted', customerId: customer?.id, customerName: customer?.name,
    supplyType: inter ? 'inter' : 'intra', lines, gross: calc.gross, discount: calc.discount, taxable: calc.taxable,
    cgst: calc.cgst, sgst: calc.sgst, igst: calc.igst, cess: calc.cess, tax: calc.tax, roundOff: calc.roundOff,
    total: calc.grandTotal, paid, due, cost: Math.round(costTotal * 100) / 100, payments, cashier: input.cashier ?? d.business.owner,
  };
  d.invoices.push(inv);
  for (const p of payments) {
    d.payments.push({ id: uid('pay'), date: input.date, ts: input.ts, direction: 'in', kind: 'sale_receipt', method: p.method, amount: p.amount, reference: p.reference, customerId: customer?.id, invoiceId: id });
  }
  return inv;
}

export function voidInvoice(d: AppData, invoiceId: string, reason: string, date: string, ts: string) {
  const inv = d.invoices.find((i) => i.id === invoiceId);
  if (!inv) return fail('Invoice not found.');
  if (inv.status === 'voided') return;
  if (d.role !== 'owner' && d.role !== 'manager') fail('Only an owner or manager can void an invoice.');
  if (reason.trim().length < 3) fail('Enter a reason for voiding (at least 3 characters).');
  for (const l of inv.lines) {
    // return units to the same batches (shelf of the product)
    for (const bt of l.batches) {
      const loc = d.products.find((p) => p.id === l.productId)!.locationId;
      moveStock(d, l.productId, bt.batchId, loc, 'void_reversal', bt.qty, `Void ${inv.number}`, date, ts, inv.id);
    }
    if (l.rescueEventId) {
      const ev = d.rescues.find((e) => e.id === l.rescueEventId);
      if (ev && ev.type === 'discount') {
        ev.confirmedQty = Math.max(0, ev.confirmedQty - l.qty);
        ev.recovered = Math.max(0, Math.round((ev.recovered - l.taxable) * 100) / 100);
      }
    }
  }
  const received = d.payments.filter((p) => p.invoiceId === inv.id && p.direction === 'in');
  const byMethod = new Map<PayMethod, number>();
  received.forEach((p) => byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount));
  byMethod.forEach((amount, method) =>
    d.payments.push({ id: uid('pay'), date, ts, direction: 'out', kind: 'refund', method, amount, reference: `Void ${inv.number}`, customerId: inv.customerId, invoiceId: inv.id }),
  );
  inv.status = 'voided';
  inv.due = 0;
  inv.voidReason = reason.trim();
}

// ───────────────────────── customers & suppliers ─────────────────────────

export const customerDue = (d: AppData, customerId: string) =>
  Math.round(d.invoices.filter((i) => i.customerId === customerId && i.status === 'posted').reduce((s, i) => s + i.due, 0) * 100) / 100;

export function recordCustomerPayment(d: AppData, customerId: string, amount: number, method: PayMethod, reference: string | undefined, date: string, ts: string) {
  const c = d.customers.find((x) => x.id === customerId);
  if (!c) return fail('Customer not found.');
  amount = Math.round(amount * 100) / 100;
  if (!(amount > 0)) fail('Enter an amount greater than zero.');
  const due = customerDue(d, customerId);
  if (amount > due) fail(`${c.name} owes ₹${due}. The payment cannot be more than the outstanding amount.`);
  let left = amount;
  for (const inv of d.invoices.filter((i) => i.customerId === customerId && i.status === 'posted' && i.due > 0).sort((a, b) => a.ts.localeCompare(b.ts))) {
    if (left <= 0) break;
    const t = Math.min(left, inv.due);
    inv.due = Math.round((inv.due - t) * 100) / 100;
    inv.paid = Math.round((inv.paid + t) * 100) / 100;
    left = Math.round((left - t) * 100) / 100;
  }
  d.payments.push({ id: uid('pay'), date, ts, direction: 'in', kind: 'customer_repayment', method, amount, reference, customerId });
}

export const purchaseDue = (pu: Purchase) => Math.round((pu.total - pu.paid) * 100) / 100;

export function supplierBalance(d: AppData, supplierId: string) {
  const purchases = d.purchases.filter((p) => p.supplierId === supplierId).reduce((s, p) => s + p.total, 0);
  const paid = d.payments.filter((p) => p.supplierId === supplierId && p.kind === 'supplier_payment').reduce((s, p) => s + p.amount, 0);
  const returns = d.rescues.filter((r) => r.type === 'supplier_return' && r.status === 'confirmed' && r.supplierId === supplierId).reduce((s, r) => s + r.recovered, 0);
  return Math.round((purchases - paid - returns) * 100) / 100;
}

export function recordSupplierPayment(d: AppData, supplierId: string, amount: number, method: PayMethod, reference: string | undefined, date: string, ts: string) {
  if (d.role !== 'owner' && d.role !== 'manager') fail('Only an owner or manager can pay suppliers.');
  amount = Math.round(amount * 100) / 100;
  if (!(amount > 0)) fail('Enter an amount greater than zero.');
  const bal = supplierBalance(d, supplierId);
  if (amount > bal + 0.001) fail(`You owe this supplier ₹${Math.max(0, bal)}. The payment cannot be more than that.`);
  let left = amount;
  for (const pu of d.purchases.filter((p) => p.supplierId === supplierId && purchaseDue(p) > 0).sort((a, b) => a.date.localeCompare(b.date))) {
    if (left <= 0) break;
    const t = Math.min(left, purchaseDue(pu));
    pu.paid = Math.round((pu.paid + t) * 100) / 100;
    left = Math.round((left - t) * 100) / 100;
  }
  d.payments.push({ id: uid('pay'), date, ts, direction: 'out', kind: 'supplier_payment', method, amount, reference, supplierId });
}

// ───────────────────────── purchases & stock ─────────────────────────

export interface PurchaseLineInput {
  productId: string;
  qty: number;
  unitCost: number;
  gst?: number;
  batchCode?: string;
  expiry?: string | null;
  locationId?: string;
}

export function postPurchase(
  d: AppData,
  input: { supplierId: string; billNumber: string; date: string; ts: string; lines: PurchaseLineInput[]; pay?: { method: PayMethod; amount: number } },
): Purchase {
  if (!d.suppliers.find((s) => s.id === input.supplierId)) fail('Choose a supplier for this purchase.');
  if (input.lines.length === 0) fail('Add at least one item to the purchase.');
  const back = d.locations.find((l) => l.kind === 'backroom')!.id;
  const id = uid('pur');
  let taxable = 0;
  let tax = 0;
  const lines = input.lines.map((l, i) => {
    const p = d.products.find((x) => x.id === l.productId);
    if (!p) return fail('A product in the purchase was not found.');
    if (!(l.qty > 0)) fail(`Enter a quantity above zero for ${p.name}.`);
    if (isWholeUnit(p.unit) && !Number.isInteger(l.qty)) fail(`${p.name} is counted in whole units.`);
    if (!(l.unitCost >= 0)) fail(`Enter a valid cost for ${p.name}.`);
    if (p.trackBatches && !l.batchCode?.trim()) fail(`Enter the batch number for ${p.name}.`);
    let expiry = l.expiry ?? null;
    if (p.trackExpiry && !expiry && p.shelfLife) {
      const dt = new Date(`${input.date}T00:00:00Z`);
      dt.setUTCDate(dt.getUTCDate() + p.shelfLife);
      expiry = dt.toISOString().slice(0, 10);
    }
    if (p.trackExpiry && !expiry) fail(`Enter the expiry date for ${p.name}.`);
    if (expiry && expiry < input.date) fail(`${p.name}: expiry date is before the bill date.`);
    const gst = l.gst ?? p.gst;
    const cost = d.business.gstRegistered ? l.unitCost : Math.round(l.unitCost * (1 + gst / 100) * 10000) / 10000;
    let batch = p.trackBatches ? d.batches.find((bt) => bt.productId === p.id && bt.code === l.batchCode!.trim()) : undefined;
    if (batch) {
      if (expiry && batch.expiry !== expiry) fail(`Batch ${batch.code} of ${p.name} already exists with a different expiry date.`);
      const onHand = batchQty(d, batch.id);
      batch.unitCost = Math.round(((onHand * batch.unitCost + l.qty * cost) / (onHand + l.qty)) * 10000) / 10000;
    } else {
      batch = {
        id: uid('bt'), productId: p.id, code: l.batchCode?.trim() || `LOT-${input.date.slice(2).replace(/-/g, '')}-${i + 1}${id.slice(-3).toUpperCase()}`,
        expiry, unitCost: cost, receivedOn: input.date, supplierId: input.supplierId, internal: !p.trackBatches, markdownPct: 0,
      };
      d.batches.push(batch);
    }
    moveStock(d, p.id, batch.id, l.locationId ?? p.locationId ?? back, 'purchase', l.qty, input.billNumber, input.date, input.ts, id);
    p.cost = l.unitCost;
    const lt = Math.round(l.qty * l.unitCost * 100) / 100;
    const tx = Math.round(lt * gst) / 100;
    taxable += lt;
    tax += tx;
    return { productId: p.id, batchId: batch.id, qty: l.qty, unitCost: l.unitCost, gst };
  });
  const total = Math.round((taxable + tax) * 100) / 100;
  const pu: Purchase = { id, billNumber: input.billNumber, date: input.date, supplierId: input.supplierId, lines, taxable: Math.round(taxable * 100) / 100, tax: Math.round(tax * 100) / 100, total, paid: 0 };
  d.purchases.push(pu);
  if (input.pay && input.pay.amount > 0) {
    const amt = Math.min(total, Math.round(input.pay.amount * 100) / 100);
    pu.paid = amt;
    d.payments.push({ id: uid('pay'), date: input.date, ts: input.ts, direction: 'out', kind: 'supplier_payment', method: input.pay.method, amount: amt, reference: `With bill ${input.billNumber}`, supplierId: input.supplierId });
  }
  return pu;
}

export function adjustStock(d: AppData, batchId: string, locationId: string, change: number, reason: 'count_correction' | 'damaged' | 'lost' | 'expired' | 'found', note: string, date: string, ts: string) {
  if (d.role === 'cashier') fail('You do not have permission to change stock.');
  if (!change) fail('Enter a non-zero quantity change.');
  if (['damaged', 'lost', 'expired'].includes(reason) && change > 0) fail('Write-offs reduce stock.');
  const batch = d.batches.find((b) => b.id === batchId)!;
  const type: MovementType = ['damaged', 'lost', 'expired'].includes(reason) ? 'write_off' : 'adjustment';
  moveStock(d, batch.productId, batchId, locationId, type, change, note || reason.replace('_', ' '), date, ts);
}

export function transferStock(d: AppData, productId: string, from: string, to: string, qty: number, date: string, ts: string) {
  if (from === to) fail('Choose two different locations.');
  if (!(qty > 0)) fail('Enter a quantity above zero.');
  let left = qty;
  const ref = uid('tr');
  const bals = d.balances
    .filter((b) => b.locationId === from && b.qty > 0 && d.batches.find((x) => x.id === b.batchId)?.productId === productId)
    .sort((a, b) => (d.batches.find((x) => x.id === a.batchId)!.expiry ?? '9999').localeCompare(d.batches.find((x) => x.id === b.batchId)!.expiry ?? '9999'));
  const available = bals.reduce((s, b) => s + b.qty, 0);
  if (available < qty) fail(`Only ${available} available at the source location.`);
  for (const b of bals) {
    if (left <= 0) break;
    const t = Math.min(left, b.qty);
    moveStock(d, productId, b.batchId, from, 'transfer_out', -t, 'Transfer', date, ts, ref);
    moveStock(d, productId, b.batchId, to, 'transfer_in', t, 'Transfer', date, ts, ref);
    left -= t;
  }
}

function takeFromBatch(d: AppData, batchId: string, qty: number, type: MovementType, note: string, date: string, ts: string, ref: string) {
  let left = qty;
  const bals = d.balances.filter((b) => b.batchId === batchId && b.qty > 0)
    .sort((a, b) => Number(d.locations.find((l) => l.id === b.locationId)?.kind === 'backroom') - Number(d.locations.find((l) => l.id === a.locationId)?.kind === 'backroom'));
  if (bals.reduce((s, b) => s + b.qty, 0) < qty) fail('Not enough units left in this batch.');
  for (const b of bals) {
    if (left <= 0) break;
    const t = Math.min(left, b.qty);
    moveStock(d, d.batches.find((x) => x.id === batchId)!.productId, batchId, b.locationId, type, -t, note, date, ts, ref);
    left -= t;
  }
}

// ───────────────────────── stock rescue ─────────────────────────

export function requestRescue(
  d: AppData, type: RescueType, batchId: string, qty: number,
  details: { supplierId?: string; offerPrice?: number; discountPct?: number; reason?: string; counterparty?: string }, date: string,
): RescueEvent {
  if (d.role === 'cashier') fail('You do not have permission to start a stock rescue.');
  const batch = d.batches.find((b) => b.id === batchId);
  if (!batch) return fail('Batch not found.');
  const product = d.products.find((p) => p.id === batch.productId)!;
  const onHand = batchQty(d, batchId);
  if (!(qty > 0)) fail('Enter a quantity above zero.');
  if (qty > onHand) fail(`Only ${onHand} units are in this batch.`);
  const expired = !!batch.expiry && diffDays(batch.expiry, date) < 0;
  if (type !== 'supplier_return' && expired) fail('Expired stock can never be sold, discounted or donated. Return it or write it off.');
  if (type === 'surplus_sale' && !(details.offerPrice! > 0)) fail('Enter an offer price.');
  if (type === 'discount' && !(details.discountPct! >= 1 && details.discountPct! <= 90)) fail('Discount must be between 1% and 90%.');
  if (type === 'discount' && d.rescues.some((r) => r.batchId === batchId && r.type === 'discount' && ['requested', 'approved'].includes(r.status))) fail('This batch already has an active discount.');
  const supplierId = type === 'supplier_return' ? details.supplierId ?? batch.supplierId ?? product.supplierId : undefined;
  const ev: RescueEvent = {
    id: uid('rs'), type, status: type === 'surplus_sale' ? 'listed' : 'requested', productId: product.id, batchId, supplierId,
    qty, unitCost: batch.unitCost, offerPrice: details.offerPrice, discountPct: details.discountPct, confirmedQty: 0, recovered: 0,
    reason: details.reason ?? '', counterparty: details.counterparty, createdOn: date,
  };
  d.rescues.push(ev);
  return ev;
}

export function approveDiscount(d: AppData, eventId: string) {
  if (d.role !== 'owner' && d.role !== 'manager') fail('Only an owner or manager can approve a discount.');
  const ev = d.rescues.find((r) => r.id === eventId);
  if (!ev || ev.type !== 'discount' || ev.status !== 'requested') return fail('This request cannot be approved.');
  ev.status = 'approved';
  d.batches.find((b) => b.id === ev.batchId)!.markdownPct = ev.discountPct ?? 0;
}

export function confirmRescue(d: AppData, eventId: string, qty: number, details: { customerId?: string; method?: PayMethod; counterparty?: string }, date: string, ts: string) {
  const ev = d.rescues.find((r) => r.id === eventId);
  if (!ev) return fail('Rescue request not found.');
  if (!['requested', 'listed'].includes(ev.status) || ev.type === 'discount') fail('This rescue is not waiting for confirmation.');
  if (!(qty > 0 && qty <= ev.qty)) fail(`Confirm between 1 and ${ev.qty} units.`);
  if (ev.type === 'supplier_return') {
    takeFromBatch(d, ev.batchId, qty, 'purchase_return', 'Returned to supplier', date, ts, ev.id);
    ev.recovered = Math.round(qty * ev.unitCost * 100) / 100;
  } else if (ev.type === 'surplus_sale') {
    if (!details.customerId) fail('Choose the buyer (add them as a customer first).');
    const inv = postSale(d, { lines: [{ productId: ev.productId, qty, rescueEventId: ev.id }], customerId: details.customerId, payments: [], settle: details.method, date, ts, surplus: true });
    ev.recovered = inv.lines[0].taxable;
    ev.counterparty = d.customers.find((c) => c.id === details.customerId)?.name;
  } else {
    takeFromBatch(d, ev.batchId, qty, 'rescue_out', `Donated${details.counterparty || ev.counterparty ? ` to ${details.counterparty || ev.counterparty}` : ''}`, date, ts, ev.id);
    ev.recovered = 0;
  }
  ev.status = 'confirmed';
  ev.confirmedQty = qty;
  ev.confirmedOn = date;
  if (details.counterparty) ev.counterparty = details.counterparty;
}

export function closeRescue(d: AppData, eventId: string, date: string) {
  const ev = d.rescues.find((r) => r.id === eventId);
  if (!ev || !['requested', 'listed', 'approved'].includes(ev.status)) return fail('This rescue is already closed.');
  if (ev.status === 'approved') {
    d.batches.find((b) => b.id === ev.batchId)!.markdownPct = 0;
    ev.status = ev.confirmedQty > 0 ? 'confirmed' : 'cancelled';
    ev.confirmedOn = date;
  } else ev.status = 'cancelled';
}
