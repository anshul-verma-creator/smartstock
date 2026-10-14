import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ProductVisual } from '@/components/brand/ProductVisual';
import { Button, Dialog, Field, Input, Segmented, Select, Textarea } from '@/components/ui';
import { locationLabel, productView } from '@/data/derived';
import { adjustStock, approveDiscount, postPurchase, requestRescue, transferStock, uid } from '@/data/engine';
import { dispatch, getState, useAppData } from '@/data/store';
import type { Product, RescueType, Shape, Unit } from '@/data/types';
import { addDays } from '@/lib/dates';
import { isWholeUnit, money, qty as fq, unitLabel } from '@/lib/format';

const nowTs = () => new Date().toISOString();

export function run(fn: () => void, ok: string, desc?: string) {
  try {
    fn();
    toast.success(ok, desc ? { description: desc } : undefined);
    return true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Something went wrong', { description: 'Nothing was saved.' });
    return false;
  }
}

// ───────────────────────── Update stock ─────────────────────────
type StockMode = 'receive' | 'count' | 'writeoff';
export function UpdateStockDialog({ productId, open, onOpenChange, initialMode = 'receive' }: { productId: string; open: boolean; onOpenChange: (o: boolean) => void; initialMode?: StockMode }) {
  const s = useAppData();
  const v = productView(s, productId)!;
  const p = v.product;
  const [mode, setMode] = useState<StockMode>(initialMode);
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState(String(p.cost));
  const [code, setCode] = useState('');
  const [expiry, setExpiry] = useState(p.shelfLife ? addDays(s.anchor, p.shelfLife) : '');
  const [loc, setLoc] = useState(s.locations.find((l) => l.kind === 'backroom')!.id);
  const [batchId, setBatchId] = useState(v.batches[0]?.batch.id ?? '');
  const [reason, setReason] = useState<'damaged' | 'lost' | 'expired'>('damaged');
  const [note, setNote] = useState('');
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setQty('');
      setNote('');
    }
  }, [open, initialMode]);
  const batch = v.batches.find((b) => b.batch.id === batchId);
  const step = isWholeUnit(p.unit) ? 1 : 0.5;

  const submit = () => {
    const n = Number(qty);
    const today = getState().anchor;
    let ok = false;
    if (mode === 'receive')
      ok = run(
        () => dispatch((d) => postPurchase(d, { supplierId: p.supplierId, billNumber: `STOCK-${Date.now().toString(36).toUpperCase()}`, date: today, ts: nowTs(), lines: [{ productId, qty: n, unitCost: Number(cost), batchCode: code || undefined, expiry: p.trackExpiry ? expiry : null, locationId: loc }] })),
        `Added ${fq(n)} ${unitLabel(p.unit)} of ${p.name}`,
        'Recorded as a purchase from the default supplier; the supplier balance is updated.',
      );
    if (mode === 'count') {
      const counted = n;
      const atLoc = s.balances.filter((b) => b.batchId === batchId);
      const have = atLoc.reduce((a, b) => a + b.qty, 0);
      const change = Math.round((counted - have) * 1000) / 1000;
      const target = atLoc.sort((a, b) => b.qty - a.qty)[0]?.locationId ?? p.locationId;
      ok = change === 0 ? (toast('Count matches the system — nothing to change'), true) : run(() => dispatch((d) => adjustStock(d, batchId, target, change, 'count_correction', note || 'Physical count', today, nowTs())), `Stock corrected by ${change > 0 ? '+' : ''}${fq(change)}`);
    }
    if (mode === 'writeoff') {
      const bal = s.balances.filter((b) => b.batchId === batchId && b.qty > 0).sort((a, b) => b.qty - a.qty);
      ok = run(
        () =>
          dispatch((d) => {
            let left = n;
            for (const b of bal) {
              if (left <= 0) break;
              const t = Math.min(left, b.qty);
              adjustStock(d, batchId, b.locationId, -t, reason, note || reason, today, nowTs());
              left -= t;
            }
            if (left > 0) throw new Error('That is more than the batch holds.');
          }),
        `Wrote off ${fq(n)} ${unitLabel(p.unit)}`,
        'Recorded as a write-off — it appears in monthly stock reconciliation.',
      );
    }
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Update stock · ${p.name}`}
      description={`On hand: ${fq(v.qty)} ${unitLabel(p.unit)} (${fq(v.shelf)} shelf, ${fq(v.back)} backroom)`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!(Number(qty) > 0) && !(mode === 'count' && qty !== '')}>
            {mode === 'receive' ? 'Add stock' : mode === 'count' ? 'Save count' : 'Write off'}
          </Button>
        </>
      }
    >
      <Segmented label="Stock update type" value={mode} onChange={setMode} options={[{ value: 'receive', label: 'Receive / new batch' }, { value: 'count', label: 'Count correction' }, { value: 'writeoff', label: 'Write-off' }]} className="mb-4" />
      <div className="grid gap-4 sm:grid-cols-2">
        {mode === 'receive' ? (
          <>
            <Field label={`Quantity (${unitLabel(p.unit)})`} htmlFor="us-q"><Input id="us-q" type="number" min={step} step={step} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus /></Field>
            <Field label="Unit cost (₹, excl. GST)" htmlFor="us-c"><Input id="us-c" type="number" min={0} step={0.01} value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
            {p.trackBatches && <Field label="Batch number" htmlFor="us-b"><Input id="us-b" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. BPL2611A" /></Field>}
            {p.trackExpiry && <Field label="Expiry date" htmlFor="us-e"><Input id="us-e" type="date" value={expiry} min={s.anchor} onChange={(e) => setExpiry(e.target.value)} /></Field>}
            <Field label="Put it in" htmlFor="us-l" className="sm:col-span-2">
              <Select id="us-l" value={loc} onChange={(e) => setLoc(e.target.value)}>
                {s.locations.map((l) => <option key={l.id} value={l.id}>{locationLabel(l)}</option>)}
              </Select>
            </Field>
          </>
        ) : (
          <>
            <Field label="Batch" htmlFor="us-bt" className="sm:col-span-2">
              <Select id="us-bt" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                {v.batches.map((b) => <option key={b.batch.id} value={b.batch.id}>{b.batch.internal ? `Lot received ${b.batch.receivedOn}` : b.batch.code} · {fq(b.qty)} on hand{b.batch.expiry ? ` · exp ${b.batch.expiry}` : ''}</option>)}
              </Select>
            </Field>
            {mode === 'count' ? (
              <Field label="Counted quantity" hint={batch ? `System says ${fq(batch.qty)}` : undefined} htmlFor="us-cnt"><Input id="us-cnt" type="number" min={0} step={step} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus /></Field>
            ) : (
              <>
                <Field label="Quantity to write off" htmlFor="us-w"><Input id="us-w" type="number" min={step} step={step} max={batch?.qty} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus /></Field>
                <Field label="Reason" htmlFor="us-r">
                  <Select id="us-r" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
                    <option value="damaged">Damaged</option><option value="lost">Lost / theft</option><option value="expired">Expired</option>
                  </Select>
                </Field>
              </>
            )}
            <Field label="Note (optional)" htmlFor="us-n" className="sm:col-span-2"><Input id="us-n" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          </>
        )}
      </div>
      {v.batches.length === 0 && mode !== 'receive' && <p className="mt-3 text-sm text-ink-2">No stock on hand to correct.</p>}
    </Dialog>
  );
}

// ───────────────────────── Move stock / location ─────────────────────────
export function MoveStockDialog({ productId, open, onOpenChange }: { productId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const s = useAppData();
  const v = productView(s, productId)!;
  const p = v.product;
  const back = s.locations.find((l) => l.kind === 'backroom')!;
  const perLoc = useMemo(() => {
    const m = new Map<string, number>();
    s.balances.filter((b) => s.batches.find((x) => x.id === b.batchId)?.productId === productId).forEach((b) => m.set(b.locationId, (m.get(b.locationId) ?? 0) + b.qty));
    return m;
  }, [s, productId]);
  const [from, setFrom] = useState(back.id);
  const [to, setTo] = useState(p.locationId);
  const [n, setN] = useState(String(Math.min(perLoc.get(back.id) ?? 0, Math.max(p.minStock - v.shelf, Math.ceil(v.velocity.perDay * 2), 1))));
  const [home, setHome] = useState(p.locationId);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Move stock · ${p.name}`}
      description="Transfers change where stock sits, never the total you own."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              const ok = run(() => dispatch((d) => {
                if (Number(n) > 0) transferStock(d, productId, from, to, Number(n), d.anchor, nowTs());
                d.products.find((x) => x.id === productId)!.locationId = home;
              }), Number(n) > 0 ? `Moved ${n} ${unitLabel(p.unit)} to ${locationLabel(s.locations.find((l) => l.id === to))}` : 'Shelf location updated');
              if (ok) onOpenChange(false);
            }}
          >
            Confirm move
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="From" htmlFor="mv-f">
          <Select id="mv-f" value={from} onChange={(e) => setFrom(e.target.value)}>
            {s.locations.map((l) => <option key={l.id} value={l.id}>{locationLabel(l)} ({fq(perLoc.get(l.id) ?? 0)})</option>)}
          </Select>
        </Field>
        <Field label="To" htmlFor="mv-t">
          <Select id="mv-t" value={to} onChange={(e) => setTo(e.target.value)}>
            {s.locations.map((l) => <option key={l.id} value={l.id}>{locationLabel(l)}</option>)}
          </Select>
        </Field>
        <Field label={`Quantity (${unitLabel(p.unit)})`} hint="Earliest-expiring batches move first. Enter 0 to only change the shelf location." htmlFor="mv-n">
          <Input id="mv-n" type="number" min={0} value={n} onChange={(e) => setN(e.target.value)} />
        </Field>
        <Field label="Product's shelf location" htmlFor="mv-h">
          <Select id="mv-h" value={home} onChange={(e) => setHome(e.target.value)}>
            {s.locations.filter((l) => l.kind === 'shelf').map((l) => <option key={l.id} value={l.id}>{locationLabel(l)}</option>)}
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}

// ───────────────────────── Rescue request ─────────────────────────
const RESCUE_COPY: Record<RescueType, { title: string; cta: string; help: string }> = {
  supplier_return: { title: 'Return to supplier', cta: 'Request return', help: 'Creates a return request. Stock leaves only when you confirm the supplier accepted it.' },
  surplus_sale: { title: 'List surplus stock', cta: 'Create listing', help: 'A local listing for nearby retailers. It is not a marketplace integration; confirm the sale when a buyer agrees.' },
  discount: { title: 'Apply expiry discount', cta: 'Request discount', help: 'Needs owner or manager approval. Once approved, the POS sells this batch first at the reduced price.' },
  donation: { title: 'Donate stock', cta: 'Record donation request', help: 'Only fresh, unexpired stock can be donated. Confirm once handed over.' },
};

export function RescueDialog({ open, onOpenChange, batchId, type: initialType, pct }: { open: boolean; onOpenChange: (o: boolean) => void; batchId: string; type?: RescueType; pct?: number }) {
  const s = useAppData();
  const batch = s.batches.find((b) => b.id === batchId);
  const product = s.products.find((p) => p.id === batch?.productId);
  const v = product ? productView(s, product.id) : undefined;
  const bv = v?.batches.find((b) => b.batch.id === batchId);
  const expired = bv?.status === 'expired';
  const [type, setType] = useState<RescueType>(initialType ?? (expired ? 'supplier_return' : 'discount'));
  const [n, setN] = useState(String(bv?.qty ?? ''));
  const [discount, setDiscount] = useState(String(pct ?? 15));
  const [offer, setOffer] = useState(String(Math.round((batch?.unitCost ?? 0) * 0.92)));
  const [reason, setReason] = useState('');
  const [counterparty, setCounterparty] = useState('');
  useEffect(() => {
    if (open) {
      setType(initialType ?? (expired ? 'supplier_return' : 'discount'));
      setN(String(bv?.qty ?? ''));
      if (pct) setDiscount(String(pct));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!batch || !product || !bv) return null;
  const canApprove = s.role === 'owner' || s.role === 'manager';
  const sup = s.suppliers.find((x) => x.id === batch.supplierId);
  const options = (['supplier_return', 'discount', 'surplus_sale', 'donation'] as RescueType[]).filter((t) => !expired || t === 'supplier_return');
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={RESCUE_COPY[type].title}
      description={`${product.name} · batch ${batch.internal ? 'lot' : batch.code} · ${fq(bv.qty)} ${unitLabel(product.unit)} on hand`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          {type === 'discount' && canApprove && (
            <Button
              variant="dark"
              onClick={() => {
                const ok = run(() => dispatch((d) => {
                  const ev = requestRescue(d, 'discount', batchId, Number(n), { discountPct: Number(discount), reason: reason || 'Expiry discount' }, d.anchor);
                  approveDiscount(d, ev.id);
                }), `${discount}% discount approved`, 'The POS now sells this batch first at the discounted price.');
                if (ok) onOpenChange(false);
              }}
            >
              Request &amp; approve
            </Button>
          )}
          <Button
            variant="primary"
            onClick={() => {
              const ok = run(
                () => dispatch((d) => requestRescue(d, type, batchId, Number(n), { discountPct: Number(discount), offerPrice: Number(offer), reason, counterparty, supplierId: batch.supplierId }, d.anchor)),
                type === 'surplus_sale' ? 'Surplus listing created' : 'Rescue request saved',
                'Track it under Stock Rescue.',
              );
              if (ok) onOpenChange(false);
            }}
          >
            {RESCUE_COPY[type].cta}
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-4 rounded-[18px] bg-white/55 p-3">
        <ProductVisual visual={product.visual} brand={product.brand} className="h-16 w-12" />
        <div className="text-sm">
          <div className="font-medium">{bv.status === 'expired' ? 'Expired — never sold' : bv.daysLeft !== null ? `${bv.daysLeft} days to expiry` : 'No expiry'}</div>
          <div className="text-ink-2">Cost at risk {money(bv.qty * batch.unitCost)}{(bv.risk?.unsold ?? 0) > 0 && ` · ~${Math.round(bv.risk!.unsold)} forecast unsold`}</div>
        </div>
      </div>
      {options.length > 1 && <Segmented label="Rescue option" value={type} onChange={setType} className="mb-4 flex-wrap" options={options.map((o) => ({ value: o, label: RESCUE_COPY[o].title.replace(' stock', '').replace('Apply expiry ', '') }))} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Quantity" htmlFor="rs-n"><Input id="rs-n" type="number" min={1} max={bv.qty} value={n} onChange={(e) => setN(e.target.value)} /></Field>
        {type === 'discount' && (
          <Field label="Discount %" hint={`New price ${money(product.price * (1 - Number(discount) / 100))} (was ${money(product.price)})`} htmlFor="rs-d">
            <Input id="rs-d" type="number" min={1} max={90} value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </Field>
        )}
        {type === 'surplus_sale' && (
          <Field label="Offer price per unit (₹)" hint={`Your cost ${money(batch.unitCost)} · shelf price ${money(product.price)}`} htmlFor="rs-o">
            <Input id="rs-o" type="number" min={1} value={offer} onChange={(e) => setOffer(e.target.value)} />
          </Field>
        )}
        {type === 'supplier_return' && <Field label="Supplier"><Input value={sup?.name ?? '—'} readOnly /></Field>}
        {type === 'donation' && <Field label="Recipient" htmlFor="rs-c"><Input id="rs-c" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="e.g. Roti Bank Jaipur" /></Field>}
        <Field label="Reason" className="sm:col-span-2" htmlFor="rs-r"><Textarea id="rs-r" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. 3 days to expiry, slow week" /></Field>
      </div>
      <p className="mt-3 text-xs text-ink-2">{RESCUE_COPY[type].help}</p>
    </Dialog>
  );
}

// ───────────────────────── Product form (add / edit) ─────────────────────────
const SHAPES: Shape[] = ['carton', 'packet', 'box', 'bottle', 'jar', 'tub', 'bag', 'bar', 'tube', 'strip'];
const PALETTE = ['#2F7BD8', '#D7262E', '#F6A33B', '#2E9E58', '#F4D03F', '#4A2C1D', '#7B4FA0', '#1E5BB8', '#E9B44C', '#F3F6FA'];

export function ProductFormDialog({ open, onOpenChange, productId, barcode, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; productId?: string; barcode?: string; onSaved?: (id: string) => void }) {
  const s = useAppData();
  const existing = productId ? s.products.find((p) => p.id === productId) : undefined;
  const blank = (): Product => ({
    id: '', sku: '', name: '', brand: '', category: 'Staples', unit: 'pcs', cost: 0, price: 0, gst: 5, includesTax: true, hsn: '', barcode: barcode ?? '',
    minStock: s.business.expiryWarningDays ? 10 : 10, supplierId: s.suppliers[0].id, locationId: s.locations.find((l) => l.kind === 'shelf')!.id,
    trackBatches: false, trackExpiry: false, visual: { shape: 'packet', color: '#F6A33B', accent: '#FFFFFF', label: '' }, status: 'active', description: '',
  });
  const [f, setF] = useState<Product>(existing ?? blank());
  const [err, setErr] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open) {
      setF(existing ? structuredClone(existing) : blank());
      setErr({});
    }
  }, [open, productId, barcode]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setF((x) => ({ ...x, [k]: v }));
  const categories = [...new Set(s.products.map((p) => p.category))];

  const save = () => {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 2) e.name = 'Enter the product name.';
    if (!f.sku.trim()) e.sku = 'Enter a SKU (your short code for the product).';
    if (s.products.some((p) => p.id !== f.id && p.sku.toLowerCase() === f.sku.trim().toLowerCase())) e.sku = 'Another product already uses this SKU.';
    if (f.barcode && !/^[0-9A-Za-z-]{4,32}$/.test(f.barcode)) e.barcode = 'Barcodes use 4–32 letters or digits.';
    if (f.barcode && s.products.some((p) => p.id !== f.id && p.barcode === f.barcode)) e.barcode = 'Another product already uses this barcode.';
    if (!(f.price > 0)) e.price = 'Selling price must be above zero.';
    if (f.cost < 0) e.cost = 'Cost cannot be negative.';
    if (f.price > 0 && f.cost > f.price) e.cost = 'Cost is higher than the selling price — check both values.';
    if (f.hsn && !/^[0-9]{4,8}$/.test(f.hsn)) e.hsn = 'HSN codes have 4–8 digits.';
    setErr(e);
    if (Object.keys(e).length) return;
    const id = f.id || `prd_${uid('p')}`;
    dispatch((d) => {
      const next = { ...f, id, sku: f.sku.trim().toUpperCase(), name: f.name.trim(), visual: { ...f.visual, label: f.visual.label || f.name.split(' ')[0] } };
      const i = d.products.findIndex((p) => p.id === id);
      if (i >= 0) d.products[i] = next;
      else d.products.push(next);
    });
    toast.success(existing ? 'Product updated' : 'Product added', { description: existing ? undefined : 'Add opening stock from the product page.' });
    onOpenChange(false);
    onSaved?.(id);
  };

  const units: Unit[] = ['pcs', 'pack', 'box', 'strip', 'bottle', 'dozen', 'kg', 'g', 'l', 'ml'];
  return (
    <Dialog
      wide
      open={open}
      onOpenChange={onOpenChange}
      title={existing ? `Edit ${existing.name}` : 'Add product'}
      description={barcode && !existing ? `New barcode ${barcode} — fill in the details to add it.` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" onClick={save}>{existing ? 'Save changes' : 'Add product'}</Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[1fr_180px]">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product name" error={err.name} className="sm:col-span-2" htmlFor="pf-n"><Input id="pf-n" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
          <Field label="SKU" error={err.sku} htmlFor="pf-s"><Input id="pf-s" value={f.sku} onChange={(e) => set('sku', e.target.value.toUpperCase())} /></Field>
          <Field label="Barcode" error={err.barcode} htmlFor="pf-b"><Input id="pf-b" value={f.barcode ?? ''} inputMode="numeric" onChange={(e) => set('barcode', e.target.value)} /></Field>
          <Field label="Brand" htmlFor="pf-br"><Input id="pf-br" value={f.brand ?? ''} onChange={(e) => set('brand', e.target.value)} /></Field>
          <Field label="Category" htmlFor="pf-c">
            <Input id="pf-c" list="pf-cats" value={f.category} onChange={(e) => set('category', e.target.value)} />
            <datalist id="pf-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="Unit" htmlFor="pf-u"><Select id="pf-u" value={f.unit} onChange={(e) => set('unit', e.target.value as Unit)}>{units.map((u) => <option key={u} value={u}>{u}</option>)}</Select></Field>
          <Field label="Minimum stock" hint="Alert when stock falls to this level" htmlFor="pf-m"><Input id="pf-m" type="number" min={0} value={f.minStock} onChange={(e) => set('minStock', Number(e.target.value))} /></Field>
          <Field label="Purchase cost (₹, excl. GST)" error={err.cost} htmlFor="pf-co"><Input id="pf-co" type="number" min={0} step={0.01} value={f.cost} onChange={(e) => set('cost', Number(e.target.value))} /></Field>
          <Field label="Selling price (₹)" error={err.price} hint={f.price > 0 ? `Margin ${(((f.price / (1 + f.gst / 100) - f.cost) / (f.price / (1 + f.gst / 100))) * 100).toFixed(1)}% (net of GST)` : undefined} htmlFor="pf-p">
            <Input id="pf-p" type="number" min={0} step={0.01} value={f.price} onChange={(e) => set('price', Number(e.target.value))} />
          </Field>
          <Field label="GST rate" htmlFor="pf-g"><Select id="pf-g" value={f.gst} onChange={(e) => set('gst', Number(e.target.value))}>{[0, 5, 12, 18, 28, 40].map((r) => <option key={r} value={r}>{r}%</option>)}</Select></Field>
          <Field label="Price includes GST?" htmlFor="pf-i"><Select id="pf-i" value={f.includesTax ? 'y' : 'n'} onChange={(e) => set('includesTax', e.target.value === 'y')}><option value="y">Yes (MRP-style)</option><option value="n">No, add GST on top</option></Select></Field>
          <Field label="HSN code" error={err.hsn} htmlFor="pf-h"><Input id="pf-h" value={f.hsn ?? ''} onChange={(e) => set('hsn', e.target.value)} /></Field>
          <Field label="Supplier" htmlFor="pf-su"><Select id="pf-su" value={f.supplierId} onChange={(e) => set('supplierId', e.target.value)}>{s.suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
          <Field label="Shelf location" htmlFor="pf-l"><Select id="pf-l" value={f.locationId} onChange={(e) => set('locationId', e.target.value)}>{s.locations.filter((l) => l.kind === 'shelf').map((l) => <option key={l.id} value={l.id}>{locationLabel(l)}</option>)}</Select></Field>
          <div className="flex flex-wrap gap-4 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#ff8a00]" checked={f.trackBatches} onChange={(e) => set('trackBatches', e.target.checked)} /> Track batch numbers</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#ff8a00]" checked={f.trackExpiry} onChange={(e) => set('trackExpiry', e.target.checked)} /> Track expiry dates</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#ff8a00]" checked={f.status === 'active'} onChange={(e) => set('status', e.target.checked ? 'active' : 'inactive')} /> Active (can be sold)</label>
          </div>
        </div>
        <div className="space-y-3">
          <div className="grid place-items-center rounded-[20px] bg-white/55 p-3">
            <ProductVisual visual={{ ...f.visual, label: f.visual.label || f.name.split(' ')[0] || 'Item' }} brand={f.brand} className="h-36 w-28" />
          </div>
          <Field label="Pack style" htmlFor="pf-sh"><Select id="pf-sh" value={f.visual.shape} onChange={(e) => set('visual', { ...f.visual, shape: e.target.value as Shape })}>{SHAPES.map((x) => <option key={x}>{x}</option>)}</Select></Field>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Pack colour">
            {PALETTE.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={f.visual.color === c} aria-label={`Colour ${c}`} onClick={() => set('visual', { ...f.visual, color: c })} className="focus-ring h-6 w-6 rounded-full ring-1 ring-black/10 aria-checked:ring-2 aria-checked:ring-ink" style={{ background: c }} />
            ))}
          </div>
          <Field label="Label on pack" htmlFor="pf-lb"><Input id="pf-lb" value={f.visual.label} onChange={(e) => set('visual', { ...f.visual, label: e.target.value.slice(0, 10) })} /></Field>
        </div>
      </div>
    </Dialog>
  );
}
