/**
 * Builds the demonstration store by replaying 45 days of history through the posting engine,
 * so every chart, ledger and stock figure reconciles by construction. Deterministic for a given anchor date.
 */
import { addDays } from '@/lib/dates';
import { CATALOG, CUSTOMERS, LOCATIONS, SUPPLIERS, type CatalogItem } from './catalog';
import {
  approveDiscount, closeRescue, confirmRescue, customerDue, postPurchase, postSale, recordCustomerPayment,
  recordSupplierPayment, requestRescue,
} from './engine';
import type { AppData, PayMethod } from './types';

export const DATA_VERSION = 5;
const H = 45;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const rand = (seed: string) => {
  let t = hash(seed) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const DOW = [1.25, 0.92, 0.9, 0.95, 0.97, 1.05, 1.18]; // Sun..Sat

function demand(p: CatalogItem, t: number, anchor: string) {
  const d = addDays(anchor, t);
  const dow = DOW[new Date(`${d}T00:00:00Z`).getUTCDay()];
  const trend = 0.9 + (0.2 * (t + H)) / H;
  const noise = 0.55 + 0.9 * rand(`${p.sku}:${t}`);
  const q = p.mean * dow * trend * noise * (t === 0 ? 0.6 : 1);
  if (p.unit === 'kg') return Math.round(q * 2) / 2;
  return Math.floor(q + rand(`${p.sku}:r:${t}`));
}
const period = (p: CatalogItem) => (p.life ? Math.max(2, Math.min(10, p.life - 3)) : 10);
const lotCode = (p: CatalogItem, recv: string) => `${p.prefix ?? p.sku.replace(/[^A-Z0-9]/g, '').slice(0, 8)}-${recv.slice(2).replace(/-/g, '')}`;
const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+05:30`).toISOString();

export function generateDemo(anchor: string): AppData {
  const d: AppData = {
    version: DATA_VERSION,
    anchor,
    role: 'owner',
    business: {
      name: 'Sharma Kirana Store', owner: 'Anshul Sharma', phone: '94140 00000', address: '12, MI Road', city: 'Jaipur',
      stateCode: '08', stateName: 'Rajasthan', pincode: '302001', gstRegistered: true, gstin: '08ABCDE1234F1Z5',
      invoicePrefix: 'SKS', expiryWarningDays: 14, cashierMaxDiscountPct: 10, roundOff: true, blockExpiredSales: true,
      footer: 'Thank you, visit again!', isDemo: true,
    },
    locations: LOCATIONS.map((l) => ({ id: `loc_${l.code}`, kind: l.kind, block: l.block, rack: 'rack' in l ? l.rack : undefined, shelf: 'shelf' in l ? l.shelf : undefined })),
    suppliers: SUPPLIERS.map((s, i) => ({ id: `sup_${i + 1}`, name: s.name, contact: s.contact, phone: s.phone, email: s.email, address: s.address, leadTimeDays: s.lead, acceptsReturns: true })),
    customers: CUSTOMERS.map((c, i) => ({ id: `cus_${i + 1}`, ...c })),
    products: CATALOG.map((p) => ({
      id: `prd_${p.sku}`, sku: p.sku, name: p.name, brand: p.brand, category: p.cat, description: p.desc, unit: p.unit, cost: p.cost,
      price: p.price, mrp: p.price, gst: p.gst, includesTax: true, hsn: p.hsn, barcode: p.barcode, minStock: p.min,
      supplierId: `sup_${p.sup}`, locationId: `loc_${p.loc}`, trackBatches: p.tb, trackExpiry: p.te, shelfLife: p.life,
      visual: p.visual, status: 'active',
    })),
    batches: [], balances: [], movements: [], invoices: [], payments: [], purchases: [], orders: [], rescues: [], dismissed: [],
    seq: { invoice: 0, po: 0 },
  };
  const back = 'loc_BACK';

  // 1. purchases: historical lots sized to cover demand exactly, then final on-hand + extra rescue lots
  const groups = new Map<string, { sup: number; date: string; lines: Parameters<typeof postPurchase>[1]['lines'] }>();
  const addLine = (sup: number, date: string, line: Parameters<typeof postPurchase>[1]['lines'][number]) => {
    const k = `${date}|${sup}`;
    if (!groups.has(k)) groups.set(k, { sup, date, lines: [] });
    groups.get(k)!.lines.push(line);
  };
  for (const p of CATALOG) {
    const k = period(p);
    for (let t = -H; t <= 0; t += k) {
      let q = 0;
      for (let x = t; x <= Math.min(t + k - 1, 0); x++) q += demand(p, x, anchor);
      if (q <= 0) continue;
      const recv = addDays(anchor, t);
      addLine(p.sup, recv, { productId: `prd_${p.sku}`, qty: q, unitCost: p.cost, batchCode: lotCode(p, recv), expiry: p.te ? addDays(recv, p.life ?? 365) : null, locationId: `loc_${p.loc}` });
    }
    [...p.final, ...(p.extra ?? [])].forEach((f, i) => {
      const recv = addDays(anchor, f.recv);
      addLine(p.sup, recv, {
        productId: `prd_${p.sku}`, qty: f.qty, unitCost: p.cost, batchCode: f.code ?? `${p.sku.replace(/[^A-Z0-9]/g, '').slice(0, 8)}F${i}`,
        expiry: p.te ? (f.exp !== undefined ? addDays(anchor, f.exp) : addDays(recv, p.life ?? 365)) : null,
        locationId: f.at === 'back' ? back : `loc_${p.loc}`,
      });
    });
  }
  for (const g of [...groups.values()].sort((a, b) => a.date.localeCompare(b.date) || a.sup - b.sup)) {
    const pu = postPurchase(d, { supplierId: `sup_${g.sup}`, billNumber: `B${g.sup}-${g.date.slice(2).replace(/-/g, '')}`, date: g.date, ts: at(g.date, '07:30'), lines: g.lines });
    if (g.date < addDays(anchor, -20)) recordSupplierPayment(d, `sup_${g.sup}`, pu.total, g.sup === 1 || g.sup === 3 ? 'cash' : 'bank', `Bill ${pu.billNumber}`, g.date, at(g.date, '18:00'));
    else if (rand(`pay:${g.sup}${g.date}`) < 0.5) recordSupplierPayment(d, `sup_${g.sup}`, Math.round(pu.total * 50) / 100, 'upi', `Part payment ${pu.billNumber}`, g.date, at(g.date, '18:00'));
  }

  const batchByCode = (code: string) => d.batches.find((b) => b.code === code)!;
  const batchByRecv = (sku: string, offset: number) => d.batches.find((b) => b.productId === `prd_${sku}` && b.receivedOn === addDays(anchor, offset))!;

  // 2. replay each day: scripted rescue events, retail sales, khata settlements
  const nowIso = new Date().toISOString();
  for (let t = -H; t <= 0; t++) {
    const date = addDays(anchor, t);
    const ts = at(date, '10:00');
    if (t === -12) requestRescue(d, 'supplier_return', batchByCode('DH260930').id, 12, { reason: 'Slow week, 12 days to expiry; supplier accepts returns' }, date);
    if (t === -7) confirmRescue(d, d.rescues.find((r) => r.batchId === batchByCode('DH260930').id)!.id, 12, {}, date, ts);
    if (t === -10) requestRescue(d, 'surplus_sale', batchByRecv('SPRITE-600', -110).id, 24, { offerPrice: 20, reason: 'Slow-moving, 9 days to expiry' }, date);
    if (t === -8) confirmRescue(d, d.rescues.find((r) => r.type === 'surplus_sale' && r.status === 'listed')!.id, 24, { customerId: 'cus_9', method: 'bank' }, date, ts);
    if (t === -6 || t === -5) {
      const bt = batchByCode('BR261006');
      let ev = d.rescues.find((r) => r.batchId === bt.id && r.type === 'discount');
      if (!ev) {
        ev = requestRescue(d, 'discount', bt.id, 20, { discountPct: 20, reason: '3 days to expiry; forecast leaves about 8 unsold' }, date);
        approveDiscount(d, ev.id);
      }
      (t === -6 ? [4, 4] : [4, 3]).forEach((q, i) =>
        postSale(d, { lines: [{ productId: bt.productId, qty: q, rescueEventId: ev!.id }], payments: [], settle: 'cash', date, ts: at(date, i ? '15:20' : '11:40') }),
      );
    }
    if (t === -4) {
      const bt = batchByCode('BR261006');
      const don = requestRescue(d, 'donation', bt.id, 5, { counterparty: 'Roti Bank Jaipur', reason: 'Unsold but fresh, 1 day to expiry' }, date);
      confirmRescue(d, don.id, 5, {}, date, ts);
      closeRescue(d, d.rescues.find((r) => r.batchId === bt.id && r.type === 'discount')!.id, date);
    }

    const chunks: { inv: number; productId: string; batchId: string; qty: number }[] = [];
    let seq = 0;
    for (const p of CATALOG) {
      const q = demand(p, t, anchor);
      if (q <= 0) continue;
      const k = period(p);
      const recv = addDays(anchor, -H + Math.floor((t + H) / k) * k);
      const batch = batchByCode(lotCode(p, recv));
      let left = q;
      let i = 0;
      while (left > 0) {
        i++;
        seq++;
        const r = rand(`${p.sku}:${t}:c${i}`);
        const c = Math.min(left, p.unit === 'kg' ? 0.5 * (1 + Math.floor(r * 4)) : 1 + Math.floor(r * 2.4));
        chunks.push({ inv: Math.floor(rand(`${t}:s${seq}`) * 100000), productId: `prd_${p.sku}`, batchId: batch.id, qty: c });
        left = Math.round((left - c) * 1000) / 1000;
      }
    }
    const nInv = Math.max(3, Math.ceil(chunks.length / 2.3));
    const invoices = new Map<number, Map<string, { productId: string; batchId: string; qty: number }>>();
    for (const c of chunks) {
      const k = c.inv % nInv;
      if (!invoices.has(k)) invoices.set(k, new Map());
      const m = invoices.get(k)!;
      const ex = m.get(c.batchId);
      if (ex) ex.qty += c.qty;
      else m.set(c.batchId, { productId: c.productId, batchId: c.batchId, qty: c.qty });
    }
    for (const k of [...invoices.keys()].sort((a, b) => a - b)) {
      const r = rand(`pay:${t}:${k}`);
      const r2 = rand(`cust:${t}:${k}`);
      const minutes = 8.5 * 60 + Math.floor((k / nInv) * 12 * 60) + Math.floor(r2 * 40);
      let ts2 = at(date, `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
      if (t === 0 && ts2 > nowIso) ts2 = new Date(Date.now() - (nInv - k) * 180000).toISOString();
      const lines = [...invoices.get(k)!.values()];
      let settle: PayMethod | undefined;
      let payments: { method: PayMethod; amount: number }[] = [];
      let customerId: string | undefined;
      if (r < 0.4) settle = 'cash';
      else if (r < 0.78) settle = 'upi';
      else if (r < 0.86) settle = 'card';
      else if (r < 0.92) { settle = 'upi'; payments = [{ method: 'cash', amount: 10 }]; }
      else customerId = `cus_${1 + Math.floor(r2 * 8)}`;
      if (r < 0.92 && r2 < 0.12) customerId = `cus_${1 + (Math.floor(r2 * 66) % 8)}`;
      postSale(d, { lines, payments, settle, customerId, date, ts: ts2, cashier: k % 3 === 0 ? 'Ravi (cashier)' : 'Anshul Sharma' });
    }
    if ((t + H) % 5 === 4) {
      for (let i = 1; i <= 6; i++) {
        const due = customerDue(d, `cus_${i}`);
        if (due > 0) recordCustomerPayment(d, `cus_${i}`, Math.min(due, Math.round(due * (0.6 + 0.4 * rand(`rep:${t}:${i}`)))), i % 2 ? 'cash' : 'upi', 'Khata settlement', date, at(date, '19:15'));
      }
    }
  }

  // 3. open items that make today actionable
  requestRescue(d, 'discount', batchByCode('BR261012').id, 40, { discountPct: 15, reason: '40 packets with 3 days left; about 18 expected to sell at full price' }, anchor);
  requestRescue(d, 'surplus_sale', batchByRecv('SPRITE-600', -100).id, 40, { offerPrice: 21, reason: 'Slow-moving: about 0.6 sold per day, 20 days to expiry' }, anchor);
  requestRescue(d, 'supplier_return', batchByCode('ORS23J07').id, 6, { reason: 'Expired, return for credit note' }, anchor);
  d.seq.po = 1;
  d.orders.push({
    id: 'po_1', number: 'PO-0001', supplierId: 'sup_2', status: 'draft', createdOn: anchor, expected: addDays(anchor, 2),
    note: 'Draft from reorder suggestions', items: [
      { productId: 'prd_PARLE-G250', qty: 60, unitCost: 20 }, { productId: 'prd_TATA-SALT1', qty: 40, unitCost: 22 }, { productId: 'prd_COKE-750', qty: 48, unitCost: 24 },
    ],
  });
  return d;
}
