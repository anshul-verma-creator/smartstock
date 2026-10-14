import { addDays, diffDays, relDays } from '@/lib/dates';
import { isWholeUnit, money0 } from '@/lib/format';
import {
  expiryRisk, expiryStatus, forecast7, reorder, suggestDiscount, sumUnits, velocity,
  type BatchRisk, type DailyQty, type ExpiryStatus, type ForecastDay, type ReorderSuggestion, type Velocity,
} from '@/lib/insights';
import { memo } from './store';
import { batchQty, customerDue, supplierBalance } from './engine';
import type { AppData, Batch, Location, Product } from './types';

export const today = (s: AppData) => s.anchor;

export const locationLabel = (l?: Location) => (l ? [l.block, l.rack, l.shelf].filter(Boolean).join(' → ') : '—');

export interface BatchView {
  batch: Batch;
  qty: number;
  shelf: number;
  back: number;
  daysLeft: number | null;
  status: ExpiryStatus;
  risk?: BatchRisk;
}

export interface ProductView {
  product: Product;
  qty: number;
  shelf: number;
  back: number;
  value: number;
  batches: BatchView[];
  velocity: Velocity;
  forecast: ForecastDay[];
  forecastTotal: number;
  reorder: ReorderSuggestion;
  coverDays: number | null;
  unsold: number;
  stockStatus: 'out' | 'low' | 'ok';
  earliest?: BatchView;
  demand: 'high' | 'normal' | 'slow' | 'unknown';
  margin: number;
  daily: DailyQty;
}

export const dailyByProduct = memo((s: AppData) => {
  const map = new Map<string, DailyQty>();
  const first = new Map<string, string>();
  // B2B surplus-rescue sales are one-off clearances, not shelf demand: keep them out of forecasts
  const surplus = new Set(s.rescues.filter((r) => r.type === 'surplus_sale').map((r) => r.id));
  for (const inv of s.invoices) {
    if (inv.status !== 'posted') continue;
    for (const l of inv.lines) {
      if (l.rescueEventId && surplus.has(l.rescueEventId)) continue;
      const m = map.get(l.productId) ?? {};
      m[inv.date] = (m[inv.date] ?? 0) + l.qty;
      map.set(l.productId, m);
      if (!first.has(l.productId) || inv.date < first.get(l.productId)!) first.set(l.productId, inv.date);
    }
  }
  return { map, first };
});

export const productViews = memo((s: AppData): ProductView[] => {
  const t = today(s);
  const { map, first } = dailyByProduct(s);
  const locKind = new Map(s.locations.map((l) => [l.id, l.kind]));
  const views = s.products.map((p) => {
    const batches: BatchView[] = s.batches
      .filter((b) => b.productId === p.id)
      .map((b) => {
        const bals = s.balances.filter((x) => x.batchId === b.id);
        const shelf = bals.filter((x) => locKind.get(x.locationId) === 'shelf').reduce((a, x) => a + x.qty, 0);
        const back = bals.filter((x) => locKind.get(x.locationId) === 'backroom').reduce((a, x) => a + x.qty, 0);
        return { batch: b, qty: shelf + back, shelf, back, daysLeft: b.expiry ? diffDays(b.expiry, t) : null, status: expiryStatus(b.expiry, t, s.business.expiryWarningDays) };
      })
      .filter((b) => b.qty > 0)
      .sort((a, b) => (a.batch.expiry ?? '9999').localeCompare(b.batch.expiry ?? '9999') || a.batch.receivedOn.localeCompare(b.batch.receivedOn));
    const daily = map.get(p.id) ?? {};
    const v = velocity(daily, t, first.get(p.id));
    const fc = forecast7(daily, t, v);
    const risks = expiryRisk(batches.map((b) => ({ id: b.batch.id, qty: b.qty, expiry: b.batch.expiry })), v.perDay, t);
    batches.forEach((b) => (b.risk = risks.find((r) => r.id === b.batch.id)));
    const qty = batches.reduce((a, b) => a + b.qty, 0);
    const sellable = batches.filter((b) => b.status !== 'expired').reduce((a, b) => a + b.qty, 0);
    const sup = s.suppliers.find((x) => x.id === p.supplierId);
    const ro = reorder(sellable, p.minStock, v.perDay, sup?.leadTimeDays ?? 2, isWholeUnit(p.unit));
    return {
      product: p, qty, shelf: batches.reduce((a, b) => a + b.shelf, 0), back: batches.reduce((a, b) => a + b.back, 0),
      value: batches.reduce((a, b) => a + b.qty * b.batch.unitCost, 0), batches, velocity: v, forecast: fc,
      forecastTotal: sumUnits(fc), reorder: ro, coverDays: v.perDay > 0 ? sellable / v.perDay : null,
      unsold: risks.filter((r) => r.daysLeft !== null).reduce((a, r) => a + r.unsold, 0),
      stockStatus: (sellable <= 0 ? 'out' : sellable <= p.minStock ? 'low' : 'ok') as ProductView['stockStatus'],
      earliest: batches.find((b) => b.status !== 'expired' && b.batch.expiry),
      demand: 'unknown' as ProductView['demand'], margin: p.price > 0 ? ((netPrice(p) - p.cost) / netPrice(p)) * 100 : 0, daily,
    };
  });
  const speeds = views.filter((v) => v.velocity.sufficient).map((v) => v.velocity.perDay).sort((a, b) => a - b);
  const p75 = speeds[Math.floor(speeds.length * 0.75)] ?? Infinity;
  views.forEach((v) => {
    if (!v.velocity.sufficient) v.demand = 'unknown';
    else if (v.velocity.perDay >= p75) v.demand = 'high';
    else if (v.velocity.perDay < 1 && (v.coverDays ?? 0) > 30) v.demand = 'slow';
    else v.demand = 'normal';
  });
  return views;
});

/** price net of GST (the revenue we keep) */
export const netPrice = (p: Product) => (p.includesTax ? p.price / (1 + p.gst / 100) : p.price);

export const productView = (s: AppData, id: string) => productViews(s).find((v) => v.product.id === id);

// ───────────────────────── period figures ─────────────────────────

export const periodSales = memo((s: AppData, from: string, to: string) => {
  const inv = s.invoices.filter((i) => i.status === 'posted' && i.date >= from && i.date <= to);
  const revenue = inv.reduce((a, i) => a + i.taxable, 0);
  const cost = inv.reduce((a, i) => a + i.cost, 0);
  const total = inv.reduce((a, i) => a + i.total, 0);
  const byProduct = new Map<string, { qty: number; revenue: number; cost: number; total: number }>();
  for (const i of inv)
    for (const l of i.lines) {
      const r = byProduct.get(l.productId) ?? { qty: 0, revenue: 0, cost: 0, total: 0 };
      r.qty += l.qty;
      r.revenue += l.taxable;
      r.cost += l.cost;
      r.total += l.total;
      byProduct.set(l.productId, r);
    }
  return {
    invoices: inv.length, revenue, cost, profit: revenue - cost, margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
    total, tax: inv.reduce((a, i) => a + i.tax, 0), discount: inv.reduce((a, i) => a + i.discount, 0),
    gross: inv.reduce((a, i) => a + i.gross, 0), credit: inv.reduce((a, i) => a + (i.total - i.payments.reduce((x, p) => x + p.amount, 0)), 0),
    byProduct, list: inv,
  };
});

export const dailySeries = memo((s: AppData, from: string, to: string) => {
  const out: { date: string; total: number; revenue: number; profit: number; invoices: number }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: d, total: 0, revenue: 0, profit: 0, invoices: 0 });
  const idx = new Map(out.map((o, i) => [o.date, i]));
  for (const i of s.invoices) {
    if (i.status !== 'posted') continue;
    const k = idx.get(i.date);
    if (k === undefined) continue;
    out[k].total += i.total;
    out[k].revenue += i.taxable;
    out[k].profit += i.taxable - i.cost;
    out[k].invoices += 1;
  }
  return out;
});

export const collections = memo((s: AppData, from: string, to: string) => {
  const r = { cash: 0, upi: 0, card: 0, bank: 0, repayments: 0, refunds: 0, supplier: 0 };
  for (const p of s.payments) {
    if (p.date < from || p.date > to) continue;
    if (p.kind === 'sale_receipt' || p.kind === 'customer_repayment') r[p.method] += p.amount;
    if (p.kind === 'customer_repayment') r.repayments += p.amount;
    if (p.kind === 'refund') r.refunds += p.amount;
    if (p.kind === 'supplier_payment') r.supplier += p.amount;
  }
  return r;
});

export const rescueStats = memo((s: AppData, from: string, to: string) => {
  const res = { supplier_return: 0, surplus_sale: 0, discount: 0, donation: 0, units: 0 };
  for (const r of s.rescues) {
    if (r.status !== 'confirmed' || !r.confirmedOn || r.confirmedOn < from || r.confirmedOn > to) continue;
    if (r.type === 'supplier_return') {
      res.supplier_return += r.recovered;
      res.units += r.confirmedQty;
    }
    if (r.type === 'donation') res.units += r.confirmedQty;
  }
  for (const i of s.invoices) {
    if (i.status !== 'posted' || i.date < from || i.date > to) continue;
    for (const l of i.lines) {
      if (!l.rescueEventId) continue;
      const ev = s.rescues.find((r) => r.id === l.rescueEventId);
      if (!ev) continue;
      if (ev.type === 'discount') res.discount += l.taxable;
      if (ev.type === 'surplus_sale') res.surplus_sale += l.taxable;
      res.units += l.qty;
    }
  }
  return { ...res, total: res.supplier_return + res.surplus_sale + res.discount };
});

export const stockAtRisk = memo((s: AppData) => {
  const byCat = new Map<string, number>();
  let total = 0;
  let unsoldCost = 0;
  let batches = 0;
  for (const v of productViews(s))
    for (const b of v.batches) {
      if (b.status === 'safe' || b.status === 'none') continue;
      const c = b.qty * b.batch.unitCost;
      total += c;
      batches += 1;
      unsoldCost += (b.risk?.unsold ?? 0) * b.batch.unitCost;
      byCat.set(v.product.category, (byCat.get(v.product.category) ?? 0) + c);
    }
  return { total, unsoldCost, batches, byCat: [...byCat.entries()].sort((a, b) => b[1] - a[1]) };
});

export const customerDues = memo((s: AppData) =>
  s.customers.map((c) => {
    const open = s.invoices.filter((i) => i.customerId === c.id && i.status === 'posted' && i.due > 0);
    const oldest = open.reduce<string | undefined>((m, i) => (!m || i.date < m ? i.date : m), undefined);
    const overdueDays = oldest ? diffDays(today(s), oldest) - c.creditDays : 0;
    return { customer: c, due: customerDue(s, c.id), open: open.length, oldest, overdueDays };
  }),
);

export const supplierBalances = memo((s: AppData) => s.suppliers.map((x) => ({ supplier: x, balance: supplierBalance(s, x.id) })));

// ───────────────────────── alerts (single source for dashboard, bell and Alerts page) ─────────────────────────

export type AlertKind = 'expired' | 'expiring' | 'out' | 'low' | 'refill' | 'overdue' | 'payable' | 'stockout' | 'rescue';
export interface Alert {
  key: string;
  kind: AlertKind;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  productId?: string;
  batchId?: string;
  to: string;
  action: string;
}

export const alerts = memo((s: AppData): Alert[] => {
  const out: Alert[] = [];
  const t = today(s);
  for (const v of productViews(s)) {
    const p = v.product;
    for (const b of v.batches) {
      if (b.status === 'expired')
        out.push({ key: `expired:${b.batch.id}:${b.qty}`, kind: 'expired', severity: 'critical', title: `${p.name} — batch ${b.batch.code} expired`, detail: `${b.qty} units ${relDays(b.daysLeft!)}. Blocked from sale; return to supplier or write off.`, productId: p.id, batchId: b.batch.id, to: `/rescue?batch=${b.batch.id}`, action: 'Return or write off' });
      else if (b.status === 'today' || b.status === 'soon') {
        const unsold = b.risk?.unsold ?? 0;
        out.push({ key: `expiring:${b.batch.id}:${b.qty}`, kind: 'expiring', severity: (b.daysLeft ?? 99) <= 3 ? 'critical' : 'warning', title: `${p.name} ${relDays(b.daysLeft!)}`, detail: `Batch ${b.batch.code}: ${b.qty} units. ${unsold > 0 ? `About ${Math.round(unsold)} may remain unsold at current sales.` : 'Expected to sell before expiry — sell first.'}`, productId: p.id, batchId: b.batch.id, to: `/products/${p.id}#batches`, action: unsold > 0 ? 'Rescue stock' : 'Review batch' });
      }
    }
    if (v.stockStatus === 'out') out.push({ key: `out:${p.id}`, kind: 'out', severity: 'critical', title: `${p.name} is out of stock`, detail: v.velocity.perDay > 0 ? `Usually sells ${v.velocity.perDay.toFixed(1)} per day.` : 'No sellable stock on hand.', productId: p.id, to: `/purchases/new?product=${p.id}`, action: 'Create purchase' });
    else if (v.stockStatus === 'low') out.push({ key: `low:${p.id}:${v.qty}`, kind: 'low', severity: 'warning', title: `${p.name} is low — ${v.qty} left`, detail: `Minimum is ${p.minStock}. ${v.reorder.needed ? `Reorder about ${v.reorder.quantity}.` : ''}`, productId: p.id, to: `/purchases/new?product=${p.id}`, action: 'Create reorder' });
    else if (v.coverDays !== null && v.velocity.sufficient && v.coverDays < 3)
      out.push({ key: `stockout:${p.id}:${Math.floor(v.coverDays)}`, kind: 'stockout', severity: 'warning', title: `${p.name} may run out in ${Math.max(1, Math.round(v.coverDays))} day${Math.round(v.coverDays) > 1 ? 's' : ''}`, detail: `Forecast estimate from ${v.velocity.perDay.toFixed(1)} sold per day.`, productId: p.id, to: `/purchases/new?product=${p.id}`, action: 'Create reorder' });
    if (v.shelf < p.minStock && v.back > 0 && v.stockStatus !== 'out')
      out.push({ key: `refill:${p.id}:${v.shelf}`, kind: 'refill', severity: 'info', title: `Refill shelf: ${p.name}`, detail: `${v.shelf} on shelf, ${v.back} in backroom.`, productId: p.id, to: `/products/${p.id}?move=1`, action: 'Move stock' });
  }
  for (const c of customerDues(s))
    if (c.due > 0 && c.overdueDays > 0)
      out.push({ key: `overdue:${c.customer.id}:${c.due}`, kind: 'overdue', severity: c.overdueDays > 7 ? 'warning' : 'info', title: `${c.customer.name} owes ${money0(c.due)}`, detail: `Oldest bill is ${c.overdueDays} days past the ${c.customer.creditDays}-day credit period.`, to: `/customers/${c.customer.id}`, action: 'Record payment' });
  for (const sb of supplierBalances(s))
    if (sb.balance > 2000)
      out.push({ key: `payable:${sb.supplier.id}:${Math.round(sb.balance)}`, kind: 'payable', severity: 'info', title: `${money0(sb.balance)} due to ${sb.supplier.name}`, detail: 'Pending supplier payment.', to: `/suppliers/${sb.supplier.id}`, action: 'Pay supplier' });
  for (const r of s.rescues)
    if (r.status === 'requested' && r.type === 'discount')
      out.push({ key: `rescue:${r.id}`, kind: 'rescue', severity: 'warning', title: `Approve ${r.discountPct}% discount: ${s.products.find((p) => p.id === r.productId)?.name}`, detail: r.reason, productId: r.productId, to: '/rescue', action: 'Review discount' });
  void t;
  const rank = { critical: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
});

export const activeAlerts = (s: AppData) => alerts(s).filter((a) => !s.dismissed.includes(a.key));

// ───────────────────────── recommendations ─────────────────────────

export interface Recommendation {
  id: string;
  kind: 'sell_first' | 'reorder' | 'discount' | 'move' | 'return' | 'surplus';
  productId: string;
  batchId?: string;
  title: string;
  why: string;
  action: string;
  to: string;
  value?: number;
}

export const recommendations = memo((s: AppData): Recommendation[] => {
  const out: Recommendation[] = [];
  for (const v of productViews(s)) {
    const p = v.product;
    const active = s.rescues.filter((r) => r.productId === p.id && ['requested', 'listed', 'approved'].includes(r.status));
    for (const b of v.batches) {
      if (b.status === 'expired' && !active.some((r) => r.batchId === b.batch.id))
        out.push({ id: `ret:${b.batch.id}`, kind: 'return', productId: p.id, batchId: b.batch.id, title: `Return ${b.qty} × ${p.name}`, why: `Batch ${b.batch.code} expired; it can never be sold.`, action: 'Request return', to: `/rescue?batch=${b.batch.id}&type=supplier_return`, value: b.qty * b.batch.unitCost });
      else if ((b.risk?.unsold ?? 0) > 0 && b.status !== 'expired' && !active.some((r) => r.batchId === b.batch.id)) {
        const pct = suggestDiscount(b.risk!.unsold, b.qty);
        out.push({ id: `disc:${b.batch.id}`, kind: 'discount', productId: p.id, batchId: b.batch.id, title: `${pct}% off ${p.name}`, why: `${b.qty} units, ${relDays(b.daysLeft!)}; about ${Math.round(b.risk!.unsold)} may stay unsold at ${v.velocity.perDay.toFixed(1)}/day.`, action: 'Apply discount', to: `/rescue?batch=${b.batch.id}&type=discount&pct=${pct}`, value: b.risk!.unsold * b.batch.unitCost });
      }
    }
    if (v.batches.length > 1 && v.earliest && v.earliest.status !== 'safe')
      out.push({ id: `fefo:${p.id}`, kind: 'sell_first', productId: p.id, batchId: v.earliest.batch.id, title: `Sell batch ${v.earliest.batch.code} first`, why: `${p.name}: ${relDays(v.earliest.daysLeft!)}, other batches last longer.`, action: 'View batches', to: `/products/${p.id}#batches` });
    if (v.reorder.needed) out.push({ id: `ro:${p.id}`, kind: 'reorder', productId: p.id, title: `Reorder ${v.reorder.quantity} × ${p.name}`, why: v.reorder.reason, action: 'Create reorder', to: `/purchases/new?product=${p.id}&qty=${v.reorder.quantity}` });
    if (v.shelf < p.minStock && v.back > 0) out.push({ id: `mv:${p.id}`, kind: 'move', productId: p.id, title: `Move ${Math.min(v.back, Math.max(p.minStock - v.shelf, Math.ceil(v.velocity.perDay * 2)))} × ${p.name} to the shelf`, why: `${v.shelf} on shelf, ${v.back} in backroom.`, action: 'Move stock', to: `/products/${p.id}?move=1` });
    if (v.demand === 'slow' && v.qty > 0 && !active.length && v.earliest?.daysLeft !== undefined && (v.earliest.daysLeft ?? 999) < 45)
      out.push({ id: `sur:${p.id}`, kind: 'surplus', productId: p.id, title: `List surplus ${p.name}`, why: `Slow mover: ${v.velocity.perDay.toFixed(1)}/day with ${Math.round(v.coverDays ?? 0)} days of cover.`, action: 'List surplus', to: `/rescue?product=${p.id}&type=surplus_sale` });
  }
  return out;
});

export const isLowOrOut = (v: ProductView) => v.stockStatus !== 'ok';
export const batchQtyOf = batchQty;
