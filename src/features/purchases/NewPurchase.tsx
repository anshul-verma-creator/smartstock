import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ProductThumb } from '@/components/brand/ProductVisual';
import { Button, Field, Input, Panel, PanelHeader, Select } from '@/components/ui';
import { PageHeader } from '@/components/layout/AppShell';
import { locationLabel } from '@/data/derived';
import { postPurchase, uid } from '@/data/engine';
import { dispatch, useAppData } from '@/data/store';
import type { PayMethod } from '@/data/types';
import { addDays } from '@/lib/dates';
import { isWholeUnit, money } from '@/lib/format';
import { run } from '@/features/product/dialogs';

interface Row {
  key: string;
  productId: string;
  qty: string;
  cost: string;
  gst: string;
  batch: string;
  expiry: string;
  loc: string;
}

export default function NewPurchase() {
  const s = useAppData();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const po = s.orders.find((o) => o.id === params.get('po'));
  const pre = s.products.find((p) => p.id === params.get('product'));
  const back = s.locations.find((l) => l.kind === 'backroom')!.id;
  const mk = (productId: string, q?: number, cost?: number): Row => {
    const p = s.products.find((x) => x.id === productId);
    return { key: uid('r'), productId, qty: q ? String(q) : '', cost: String(cost ?? p?.cost ?? ''), gst: String(p?.gst ?? 0), batch: '', expiry: p?.trackExpiry && p.shelfLife ? addDays(s.anchor, p.shelfLife) : '', loc: back };
  };
  const [supplierId, setSupplierId] = useState(po?.supplierId ?? params.get('supplier') ?? pre?.supplierId ?? s.suppliers[0].id);
  const [bill, setBill] = useState('');
  const [date, setDate] = useState(s.anchor);
  const [rows, setRows] = useState<Row[]>(() => (po ? po.items.map((i) => mk(i.productId, i.qty, i.unitCost)) : pre ? [mk(pre.id, Number(params.get('qty')) || undefined)] : [mk('')]));
  const [payMethod, setPayMethod] = useState<PayMethod | ''>('');
  const [payAmt, setPayAmt] = useState('');
  const [errors, setErrors] = useState<string>('');

  const totals = useMemo(() => {
    let taxable = 0;
    let tax = 0;
    rows.forEach((r) => {
      const t = Math.round((Number(r.qty) || 0) * (Number(r.cost) || 0) * 100) / 100;
      taxable += t;
      tax += Math.round(t * (Number(r.gst) || 0)) / 100;
    });
    return { taxable, tax, total: Math.round((taxable + tax) * 100) / 100 };
  }, [rows]);
  const upd = (k: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === k ? { ...r, ...patch } : r)));
  const supplierProducts = [...s.products].sort((a, b) => Number(b.supplierId === supplierId) - Number(a.supplierId === supplierId) || a.name.localeCompare(b.name));

  const save = () => {
    if (!bill.trim()) return setErrors('Enter the supplier’s bill number so the bill can be matched later.');
    if (s.purchases.some((p) => p.supplierId === supplierId && p.billNumber.toLowerCase() === bill.trim().toLowerCase())) return setErrors('This bill number is already recorded for this supplier.');
    setErrors('');
    const ok = run(
      () =>
        dispatch((d) => {
          postPurchase(d, {
            supplierId, billNumber: bill.trim(), date, ts: new Date().toISOString(),
            lines: rows.filter((r) => r.productId).map((r) => ({ productId: r.productId, qty: Number(r.qty), unitCost: Number(r.cost), gst: Number(r.gst), batchCode: r.batch || undefined, expiry: r.expiry || null, locationId: r.loc })),
            pay: payMethod && Number(payAmt) > 0 ? { method: payMethod, amount: Number(payAmt) } : undefined,
          });
          if (po) d.orders.find((o) => o.id === po.id)!.status = 'received';
        }),
      'Purchase recorded',
      'Stock added and supplier balance updated.',
    );
    if (ok) navigate('/purchases');
  };

  return (
    <div className="space-y-5">
      <Link to="/purchases" className="link text-xs"><ArrowLeft size={13} />Purchases</Link>
      <PageHeader eyebrow={po ? `Receiving ${po.number}` : 'Purchase bill'} title="Record purchase" sub="Enter what arrived. Each line becomes a batch (or a lot), adds stock, and is added to what you owe the supplier." />
      <Panel>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Supplier" htmlFor="np-s" className="md:col-span-2"><Select id="np-s" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>{s.suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
          <Field label="Supplier bill no." htmlFor="np-b" error={errors}><Input id="np-b" value={bill} onChange={(e) => setBill(e.target.value)} placeholder="e.g. GT/2026/1184" /></Field>
          <Field label="Bill date" htmlFor="np-d"><Input id="np-d" type="date" max={s.anchor} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
      </Panel>
      <Panel className="p-3 sm:p-5">
        <PanelHeader title="Items received" className="px-1" />
        <div className="space-y-3">
          {rows.map((r) => {
            const p = s.products.find((x) => x.id === r.productId);
            return (
              <div key={r.key} className="grid items-end gap-3 rounded-[18px] bg-white/55 p-3 ring-1 ring-black/[.03] md:grid-cols-12">
                <Field label="Product" className="md:col-span-3">
                  <div className="flex items-center gap-2">
                    {p && <ProductThumb visual={p.visual} brand={p.brand} className="h-9 w-9" />}
                    <Select value={r.productId} onChange={(e) => { const np = s.products.find((x) => x.id === e.target.value); upd(r.key, { productId: e.target.value, cost: String(np?.cost ?? ''), gst: String(np?.gst ?? 0), expiry: np?.trackExpiry && np.shelfLife ? addDays(s.anchor, np.shelfLife) : '' }); }} aria-label="Product">
                      <option value="">Choose…</option>
                      {supplierProducts.map((x) => <option key={x.id} value={x.id}>{x.name}{x.supplierId === supplierId ? '' : ' (other supplier)'}</option>)}
                    </Select>
                  </div>
                </Field>
                <Field label={`Qty${p ? ` (${p.unit})` : ''}`} className="md:col-span-1"><Input type="number" min={0} step={p && !isWholeUnit(p.unit) ? 0.5 : 1} value={r.qty} onChange={(e) => upd(r.key, { qty: e.target.value })} aria-label="Quantity" /></Field>
                <Field label="Cost ₹ (excl. GST)" className="md:col-span-2"><Input type="number" min={0} step={0.01} value={r.cost} onChange={(e) => upd(r.key, { cost: e.target.value })} aria-label="Unit cost" /></Field>
                <Field label="GST %" className="md:col-span-1"><Select value={r.gst} onChange={(e) => upd(r.key, { gst: e.target.value })} aria-label="GST rate">{[0, 5, 12, 18, 28, 40].map((g) => <option key={g} value={g}>{g}</option>)}</Select></Field>
                <Field label={p?.trackBatches ? 'Batch no. *' : 'Batch no.'} className="md:col-span-1"><Input value={r.batch} onChange={(e) => upd(r.key, { batch: e.target.value.toUpperCase() })} disabled={!!p && !p.trackBatches} placeholder={p && !p.trackBatches ? 'auto' : ''} aria-label="Batch number" /></Field>
                <Field label={p?.trackExpiry ? 'Expiry *' : 'Expiry'} className="md:col-span-2"><Input type="date" value={r.expiry} min={date} onChange={(e) => upd(r.key, { expiry: e.target.value })} disabled={!!p && !p.trackExpiry} aria-label="Expiry date" /></Field>
                <Field label="Store in" className="md:col-span-1"><Select value={r.loc} onChange={(e) => upd(r.key, { loc: e.target.value })} aria-label="Location">{s.locations.map((l) => <option key={l.id} value={l.id}>{locationLabel(l)}</option>)}</Select></Field>
                <div className="flex justify-end md:col-span-1"><Button size="icon" variant="ghost" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label="Remove line" disabled={rows.length === 1}><Trash2 size={16} /></Button></div>
              </div>
            );
          })}
        </div>
        <Button className="mt-3" onClick={() => setRows((rs) => [...rs, mk('')])}><Plus size={15} />Add line</Button>
      </Panel>
      <Panel>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Paid now" htmlFor="np-pm"><Select id="np-pm" value={payMethod} onChange={(e) => setPayMethod(e.target.value as PayMethod | '')}><option value="">Not paid yet (on credit)</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank</option></Select></Field>
            {payMethod && <Field label="Amount (₹)" htmlFor="np-pa"><Input id="np-pa" type="number" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} placeholder={String(totals.total)} /></Field>}
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-ink-2">Taxable value</span><span className="num">{money(totals.taxable)}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">GST on purchase</span><span className="num">{money(totals.tax)}</span></div>
            <div className="flex justify-between border-t pt-2 text-lg hairline"><span>Bill total</span><span className="num font-medium">{money(totals.total)}</span></div>
            <p className="text-xs text-ink-3">{s.business.gstRegistered ? 'GST-registered: stock is valued excluding GST (input tax credit).' : 'Not GST-registered: GST paid is included in stock cost.'}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
          <Button variant="primary" size="lg" onClick={save} disabled={!rows.some((r) => r.productId && Number(r.qty) > 0)}>Save purchase · {money(totals.total)}</Button>
        </div>
      </Panel>
    </div>
  );
}
