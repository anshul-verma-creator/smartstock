import { Banknote, Check, CreditCard, Minus, Plus, Printer, ReceiptText, ScanLine, Search, ShoppingBag, Smartphone, Split, Tag, Trash2, UserPlus, Wallet, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ProductVisual } from '@/components/brand/ProductVisual';
import { Badge, Button, ButtonLink, cn, Dialog, Empty, Field, Input, Select } from '@/components/ui';
import { productViews, type ProductView } from '@/data/derived';
import { postSale, uid, type SaleLineInput } from '@/data/engine';
import { dispatch, getState, useAppData } from '@/data/store';
import type { Invoice, PayMethod } from '@/data/types';
import { calcInvoice } from '@/lib/tax';
import { isWholeUnit, money, qty, unitLabel } from '@/lib/format';
import { CameraScanner } from '@/features/scanner/ScannerDialog';
import { invoiceToReceipt, printNode, ThermalReceipt, type ReceiptModel } from './Receipt';
import { Printer3D, type PrinterStatus } from './Printer3D';

interface CartLine extends SaleLineInput {
  key: string;
}
type Mode = 'cash' | 'upi' | 'card' | 'credit' | 'split';
const MODES: { value: Mode; label: string; icon: React.ReactNode }[] = [
  { value: 'cash', label: 'Cash', icon: <Banknote size={16} /> },
  { value: 'upi', label: 'UPI', icon: <Smartphone size={16} /> },
  { value: 'card', label: 'Card', icon: <CreditCard size={16} /> },
  { value: 'credit', label: 'Pay later', icon: <Wallet size={16} /> },
  { value: 'split', label: 'Split', icon: <Split size={16} /> },
];

/** Posted idempotency keys → invoice id. A repeated checkout with the same key returns the same invoice. */
const posted = new Map<string, string>();

export default function POS() {
  const s = useAppData();
  const navigate = useNavigate();
  const views = productViews(s);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [billDisc, setBillDisc] = useState('');
  const [mode, setMode] = useState<Mode>('cash');
  const [tendered, setTendered] = useState('');
  const [reference, setReference] = useState('');
  const [payNow, setPayNow] = useState('');
  const [split, setSplit] = useState<{ method: PayMethod; amount: string }[]>([{ method: 'cash', amount: '' }, { method: 'upi', amount: '' }]);
  const [key, setKey] = useState(() => uid('chk'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<Invoice | null>(null);
  const [printer, setPrinter] = useState<PrinterStatus>('idle');
  const [feedKey, setFeedKey] = useState(0);
  const [newCust, setNewCust] = useState(false);
  const [camera, setCamera] = useState(false);
  const [mobileCart, setMobileCart] = useState(false);
  const search = useRef<HTMLInputElement>(null);

  const cats = useMemo(() => ['All', ...new Set(s.products.map((p) => p.category))], [s.products]);
  const frequent = useMemo(() => [...views].filter((v) => v.product.status === 'active').sort((a, b) => b.velocity.perDay - a.velocity.perDay), [views]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return frequent.filter((v) => (cat === 'All' || v.product.category === cat) && (!t || v.product.name.toLowerCase().includes(t) || v.product.sku.toLowerCase().includes(t) || v.product.barcode?.includes(t)));
  }, [frequent, q, cat]);

  // ── cart helpers ──
  const sellable = (v: ProductView) => v.batches.filter((b) => b.status !== 'expired').reduce((a, b) => a + b.qty, 0);
  const inCart = (pid: string) => cart.filter((l) => l.productId === pid).reduce((a, l) => a + l.qty, 0);

  const add = (v: ProductView, n = 1) => {
    if (done) startNew();
    const avail = sellable(v) - inCart(v.product.id);
    if (avail <= 0) return toast.error(`${v.product.name} has no sellable stock left`, { description: v.qty > 0 ? 'Remaining units are expired and blocked from sale.' : undefined });
    const step = isWholeUnit(v.product.unit) ? 1 : 0.5;
    let left = Math.min(n * step, avail);
    setCart((c) => {
      const next = [...c];
      // an approved expiry discount on the first-expiring batch is applied automatically (FEFO)
      const ev = getState().rescues.find((r) => r.productId === v.product.id && r.type === 'discount' && r.status === 'approved');
      if (ev) {
        const bq = v.batches.find((b) => b.batch.id === ev.batchId)?.qty ?? 0;
        const used = next.filter((l) => l.rescueEventId === ev.id).reduce((a, l) => a + l.qty, 0);
        const take = Math.min(left, bq - used);
        if (take > 0) {
          const ex = next.find((l) => l.rescueEventId === ev.id);
          if (ex) ex.qty += take;
          else next.push({ key: uid('l'), productId: v.product.id, qty: take, rescueEventId: ev.id });
          left -= take;
        }
      }
      if (left > 0) {
        const ex = next.find((l) => l.productId === v.product.id && !l.rescueEventId);
        if (ex) ex.qty = Math.round((ex.qty + left) * 1000) / 1000;
        else next.push({ key: uid('l'), productId: v.product.id, qty: left, lineDiscount: 0 });
      }
      return next.map((l) => ({ ...l }));
    });
    setError('');
  };

  const setLineQty = (k: string, n: number) => {
    setCart((c) =>
      c.flatMap((l) => {
        if (l.key !== k) return [l];
        if (n <= 0) return [];
        const v = views.find((x) => x.product.id === l.productId)!;
        const other = c.filter((x) => x.productId === l.productId && x.key !== k).reduce((a, x) => a + x.qty, 0);
        const max = l.rescueEventId ? v.batches.find((b) => b.batch.id === s.rescues.find((r) => r.id === l.rescueEventId)?.batchId)?.qty ?? 0 : sellable(v) - other;
        if (n > max) toast.error(`Only ${qty(max)} ${unitLabel(v.product.unit)} available`);
        return [{ ...l, qty: Math.min(n, max) }];
      }),
    );
  };

  // ── live totals (same tax engine as posting) ──
  const preview = useMemo(() => {
    const lines = cart.map((l) => {
      const p = s.products.find((x) => x.id === l.productId)!;
      const ev = l.rescueEventId ? s.rescues.find((r) => r.id === l.rescueEventId) : undefined;
      const gross = Math.round(l.qty * p.price * 100) / 100;
      const disc = ev ? Math.round(gross * (ev.discountPct ?? 0)) / 100 : l.lineDiscount ?? 0;
      return { p, l, disc, ev };
    });
    try {
      const r = calcInvoice({
        lines: lines.map((x) => ({ quantity: x.l.qty, unitPrice: x.p.price, lineDiscount: x.disc, priceIncludesTax: x.p.includesTax, gstRate: x.p.gst })),
        invoiceDiscount: Number(billDisc) || 0,
        interState: false,
        taxApplicable: s.business.gstRegistered,
        roundOff: s.business.roundOff,
      });
      return { ok: true as const, r, lines };
    } catch (e) {
      return { ok: false as const, msg: (e as Error).message, lines };
    }
  }, [cart, billDisc, s]);
  const total = preview.ok ? preview.r.grandTotal : 0;

  const payments = (): { list: { method: PayMethod; amount: number; reference?: string }[]; settle?: PayMethod } => {
    const ref = reference.trim() || undefined;
    if (mode === 'cash' || mode === 'upi' || mode === 'card') return ref ? { list: [{ method: mode, amount: total, reference: ref }] } : { list: [], settle: mode };
    if (mode === 'credit') return { list: Number(payNow) > 0 ? [{ method: 'cash', amount: Number(payNow) }] : [] };
    return { list: split.filter((x) => Number(x.amount) > 0).map((x) => ({ method: x.method, amount: Number(x.amount) })) };
  };
  const splitSum = split.reduce((a, x) => a + (Number(x.amount) || 0), 0);
  const change = mode === 'cash' && Number(tendered) > total ? Number(tendered) - total : 0;

  const checkout = () => {
    if (busy || !cart.length || !preview.ok) return;
    if (mode === 'cash' && tendered && Number(tendered) < total) return setError(`Cash received is less than the total ${money(total)}. Use Split or Pay later for the rest.`);
    if (mode === 'credit' && !customerId) return setError('Pay later needs a customer — select or add one.');
    if (mode === 'split' && Math.abs(splitSum - total) > 0.001 && !customerId) return setError(`Split payments add up to ${money(splitSum)}; the bill is ${money(total)}.`);
    setBusy(true);
    setError('');
    try {
      const existing = posted.get(key);
      const inv = existing
        ? getState().invoices.find((i) => i.id === existing)!
        : dispatch((d) => {
            const p = payments();
            return postSale(d, { lines: cart, customerId: customerId || undefined, invoiceDiscount: Number(billDisc) || 0, payments: p.list, settle: p.settle, date: d.anchor, ts: new Date().toISOString(), cashier: d.role === 'cashier' ? 'Ravi (cashier)' : d.business.owner });
          });
      posted.set(key, inv.id);
      setDone(inv);
      setPrinter('ready');
      setMobileCart(true);
      toast.success(`Bill ${inv.number} saved`, { description: `${money(inv.total)} · stock updated` });
    } catch (e) {
      setError((e as Error).message);
      toast.error('Bill not saved', { description: 'Your cart is kept. Fix the issue and try again.' });
    } finally {
      setBusy(false);
    }
  };

  const startNew = () => {
    setCart([]);
    setDone(null);
    setCustomerId('');
    setBillDisc('');
    setTendered('');
    setReference('');
    setPayNow('');
    setMode('cash');
    setPrinter('idle');
    setKey(uid('chk'));
    setMobileCart(false);
    search.current?.focus();
  };

  const print = async () => {
    if (!done) return;
    setPrinter('printing');
    setFeedKey((k) => k + 1);
    await new Promise((r) => setTimeout(r, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 50 : 1700));
    try {
      await printNode(<ThermalReceipt m={invoiceToReceipt(done)} b={s.business} />, 'thermal');
      setPrinter('dialog');
    } catch {
      setPrinter('failed');
    }
  };

  // keyboard: barcode scanners type the code + Enter into the search box
  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const t = q.trim();
    const exact = views.find((v) => v.product.barcode === t || v.product.sku.toLowerCase() === t.toLowerCase());
    if (exact) {
      add(exact);
      setQ('');
    } else if (shown.length === 1) {
      add(shown[0]);
      setQ('');
    } else if (t) toast.error(`No product for “${t}”`, { action: { label: 'Add product', onClick: () => navigate(`/inventory?new=1&barcode=${encodeURIComponent(t)}`) } });
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        search.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') checkout();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const receipt: ReceiptModel = done
    ? invoiceToReceipt(done)
    : {
        title: 'TAX INVOICE', date: s.anchor, customer: s.customers.find((c) => c.id === customerId)?.name,
        lines: preview.lines.map((x, i) => ({ name: x.p.name + (x.ev ? ` (${x.ev.discountPct}% off)` : ''), qty: x.l.qty, unit: x.p.unit, unitPrice: x.p.price, total: preview.ok ? preview.r.lines[i].total : 0, discount: preview.ok ? preview.r.lines[i].lineDiscount + preview.r.lines[i].invoiceDiscountShare : 0, gst: x.p.gst })),
        gross: preview.ok ? preview.r.gross : 0, discount: preview.ok ? preview.r.discount : 0, taxable: preview.ok ? preview.r.taxable : 0,
        cgst: preview.ok ? preview.r.cgst : 0, sgst: preview.ok ? preview.r.sgst : 0, igst: 0, roundOff: preview.ok ? preview.r.roundOff : 0, total,
        payments: [], due: 0, preview: true,
      };

  const cartPanel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between pb-3">
        <h2 className="text-[15px] font-medium">Current bill</h2>
        {cart.length > 0 && !done && <button onClick={() => setCart([])} className="text-xs text-ink-2 hover:text-bad">Clear</button>}
      </div>
      {/* customer */}
      <div className="mb-3 flex gap-2">
        <Select aria-label="Customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={!!done} className="h-9 flex-1 text-xs">
          <option value="">Walk-in customer</option>
          {s.customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}
        </Select>
        <Button size="icon" className="h-9 w-9" onClick={() => setNewCust(true)} aria-label="Add customer" disabled={!!done}><UserPlus size={15} /></Button>
      </div>
      {/* lines */}
      <div className="-mx-1 min-h-[120px] flex-1 overflow-y-auto px-1">
        {cart.length === 0 && !done && <Empty icon={<ShoppingBag size={20} />} title="No items yet">Scan a barcode, search, or tap a product.</Empty>}
        <ul className="space-y-2">
          {preview.lines.map((x, i) => {
            const r = preview.ok ? preview.r.lines[i] : undefined;
            const step = isWholeUnit(x.p.unit) ? 1 : 0.5;
            return (
              <li key={x.l.key} className="rounded-[16px] bg-white/60 p-2.5 ring-1 ring-black/[.03]">
                <div className="flex gap-2.5">
                  <ProductVisual visual={x.p.visual} brand={x.p.brand} className="h-12 w-9 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{x.p.name}</div>
                        <div className="text-[11px] text-ink-2">
                          {money(x.p.price)} / {x.p.unit} · GST {s.business.gstRegistered ? x.p.gst : 0}%
                          {x.ev && <Badge tone="brand" className="ml-1 px-1.5 py-0 text-[10px]">Rescue −{x.ev.discountPct}%</Badge>}
                        </div>
                      </div>
                      <div className="num text-right text-sm font-medium">{r ? money(r.total) : '—'}</div>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <div className="flex items-center rounded-[10px] bg-ink/[.05]">
                        <button disabled={!!done} onClick={() => setLineQty(x.l.key, Math.round((x.l.qty - step) * 1000) / 1000)} className="focus-ring grid h-7 w-7 place-items-center rounded-[10px] hover:bg-white" aria-label={`Decrease ${x.p.name}`}><Minus size={13} /></button>
                        <input
                          aria-label={`Quantity of ${x.p.name}`}
                          disabled={!!done}
                          value={x.l.qty}
                          onChange={(e) => setLineQty(x.l.key, Number(e.target.value) || 0)}
                          type="number"
                          step={step}
                          className="num h-7 w-12 bg-transparent text-center text-sm outline-none [appearance:textfield]"
                        />
                        <button disabled={!!done} onClick={() => setLineQty(x.l.key, Math.round((x.l.qty + step) * 1000) / 1000)} className="focus-ring grid h-7 w-7 place-items-center rounded-[10px] hover:bg-white" aria-label={`Increase ${x.p.name}`}><Plus size={13} /></button>
                        <span className="pr-2 text-[11px] text-ink-2">{x.p.unit}</span>
                      </div>
                      {!x.ev && (
                        <label className="flex items-center gap-1 text-[11px] text-ink-2">
                          <Tag size={11} />
                          <input
                            aria-label={`Discount on ${x.p.name} in rupees`}
                            disabled={!!done}
                            placeholder="₹ off"
                            value={x.l.lineDiscount || ''}
                            onChange={(e) => setCart((c) => c.map((l) => (l.key === x.l.key ? { ...l, lineDiscount: Math.max(0, Number(e.target.value) || 0) } : l)))}
                            className="num h-7 w-14 rounded-[8px] bg-ink/[.05] px-1.5 text-right outline-none focus:ring-1 focus:ring-brand"
                          />
                        </label>
                      )}
                      {!done && <button onClick={() => setLineQty(x.l.key, 0)} className="text-ink-3 hover:text-bad" aria-label={`Remove ${x.p.name}`}><Trash2 size={14} /></button>}
                    </div>
                    {r && (r.lineDiscount > 0 || r.tax > 0) && (
                      <div className="mt-1 text-[10.5px] text-ink-3">Taxable {money(r.taxable)}{r.tax > 0 ? ` · GST ${money(r.tax)}` : ''}{r.lineDiscount > 0 ? ` · discount ${money(r.lineDiscount)}` : ''}</div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* totals */}
      <div className="mt-3 space-y-1.5 border-t pt-3 text-sm hairline">
        {!done && (
          <div className="flex items-center justify-between">
            <label htmlFor="bill-disc" className="text-ink-2">Bill discount (₹)</label>
            <input id="bill-disc" value={billDisc} onChange={(e) => setBillDisc(e.target.value)} inputMode="decimal" placeholder="0" className="num h-7 w-20 rounded-[8px] bg-ink/[.05] px-2 text-right outline-none focus:ring-1 focus:ring-brand" />
          </div>
        )}
        {preview.ok && (
          <>
            <Line l="Items value" r={money(preview.r.gross)} />
            {preview.r.discount > 0 && <Line l="Discounts" r={`−${money(preview.r.discount)}`} />}
            <Line l="Taxable value" r={money(preview.r.taxable)} />
            {s.business.gstRegistered && <Line l={`GST (CGST ${money(preview.r.cgst)} + SGST ${money(preview.r.sgst)})`} r={money(preview.r.tax)} />}
            {preview.r.roundOff !== 0 && <Line l="Round off" r={money(preview.r.roundOff)} />}
          </>
        )}
        {!preview.ok && <p className="text-xs text-bad">{preview.msg}</p>}
      </div>
      <div className="mt-3 flex items-end justify-between">
        <span className="text-sm text-ink-2">Amount payable</span>
        <span className="num text-[30px] font-light tracking-tight">{money(done ? done.total : total)}</span>
      </div>

      {done ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3 rounded-[16px] bg-ok-soft p-3 text-sm text-ok">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ok text-white"><Check size={16} /></span>
            <div>
              <div className="font-semibold">Bill saved · <span className="font-mono">{done.number}</span></div>
              <div className="text-xs">Stock deducted{done.due > 0 ? ` · ${money(done.due)} added to customer dues` : ''}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="primary" onClick={startNew}><Plus size={15} />New bill</Button>
            <ButtonLink to={`/sales/${done.id}`}><ReceiptText size={15} />Invoice</ButtonLink>
            <Button onClick={print} loading={printer === 'printing'}><Printer size={15} />Print</Button>
          </div>
        </div>
      ) : (
        <>
          {/* payment */}
          <div role="radiogroup" aria-label="Payment method" className="mt-4 grid grid-cols-5 gap-1 rounded-[14px] bg-ink/[.05] p-1">
            {MODES.map((m) => (
              <button key={m.value} role="radio" aria-checked={mode === m.value} onClick={() => setMode(m.value)} className={cn('focus-ring flex flex-col items-center gap-0.5 rounded-[11px] py-1.5 text-[11px] font-medium transition', mode === m.value ? 'bg-white text-ink shadow-[0_2px_8px_-2px_rgba(0,0,0,.15)]' : 'text-ink-2 hover:text-ink')}>
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-2 text-sm">
            {mode === 'cash' && (
              <div className="flex items-center gap-2">
                <Input aria-label="Cash received" inputMode="decimal" placeholder="Cash received (optional)" value={tendered} onChange={(e) => setTendered(e.target.value)} className="h-9" />
                <span className="num w-32 text-right text-xs text-ink-2">{change > 0 ? <>Return <b className="text-ink">{money(change)}</b></> : 'Exact amount'}</span>
              </div>
            )}
            {(mode === 'upi' || mode === 'card') && (
              <Input aria-label="Payment reference" placeholder={mode === 'upi' ? 'UPI reference / UTR (optional)' : 'Card slip or last 4 digits (optional)'} value={reference} onChange={(e) => setReference(e.target.value)} className="h-9" />
            )}
            {(mode === 'upi' || mode === 'card') && <p className="text-[11px] text-ink-3">Collect on your {mode === 'upi' ? 'UPI QR' : 'card machine'} first. SmartStock records the payment; it does not process or verify it.</p>}
            {mode === 'credit' && (
              <div className="flex items-center gap-2">
                <Input aria-label="Paid now in cash" inputMode="decimal" placeholder="Paid now in cash (optional)" value={payNow} onChange={(e) => setPayNow(e.target.value)} className="h-9" />
                <span className="w-36 text-right text-xs text-ink-2">{customerId ? <>Due <b className="text-ink">{money(Math.max(0, total - (Number(payNow) || 0)))}</b></> : 'Select a customer'}</span>
              </div>
            )}
            {mode === 'split' && (
              <div className="space-y-2">
                {split.map((x, i) => (
                  <div key={i} className="flex gap-2">
                    <Select aria-label="Split method" value={x.method} onChange={(e) => setSplit((sp) => sp.map((y, j) => (j === i ? { ...y, method: e.target.value as PayMethod } : y)))} className="h-9 w-28 text-xs">
                      <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option>
                    </Select>
                    <Input aria-label="Split amount" inputMode="decimal" placeholder="Amount" value={x.amount} onChange={(e) => setSplit((sp) => sp.map((y, j) => (j === i ? { ...y, amount: e.target.value } : y)))} className="h-9" />
                  </div>
                ))}
                <p className="text-xs text-ink-2">Entered {money(splitSum)} of {money(total)}{splitSum < total && customerId ? ' · rest goes to customer dues' : ''}</p>
              </div>
            )}
          </div>
          {error && <p className="mt-3 rounded-[12px] bg-bad-soft px-3 py-2 text-xs text-bad" role="alert">{error}</p>}
          <Button variant="primary" size="lg" className="mt-4 w-full" disabled={!cart.length || !preview.ok} loading={busy} onClick={checkout}>
            Save bill · {money(total)}
          </Button>
          <p className="mt-2 text-center text-[11px] text-ink-3">Ctrl + Enter to save · F2 to search · the printer never saves a bill</p>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Point of sale</p>
          <h1 className="text-[34px] font-extralight tracking-[-0.02em] sm:text-[40px]">New bill</h1>
        </div>
        <div className="flex gap-2 text-xs text-ink-2">
          <Link to="/sales" className="link">Sales history</Link>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_380px_320px]">
        {/* ── left: product picker ── */}
        <section className="panel min-w-0 p-4 sm:p-5" aria-label="Products">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <Input ref={search} autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onSearchKey} placeholder="Search name, SKU or scan barcode…" className="h-11 pl-10 text-[15px]" aria-label="Search products or scan barcode" />
            </div>
            <Button size="icon" className="h-11 w-11" onClick={() => setCamera(true)} aria-label="Scan with camera"><ScanLine size={18} /></Button>
          </div>
          <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Categories">
            {cats.map((c) => (
              <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)} className={cn('focus-ring whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition', cat === c ? 'bg-ink text-white' : 'bg-white/60 text-ink-2 hover:bg-white')}>
                {c}
              </button>
            ))}
          </div>
          <p className="mb-2 mt-4 text-xs text-ink-2">{q || cat !== 'All' ? `${shown.length} products` : 'Frequently sold'}</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
            {shown.slice(0, 40).map((v) => {
              const avail = sellable(v) - inCart(v.product.id);
              const rescue = s.rescues.some((r) => r.productId === v.product.id && r.type === 'discount' && r.status === 'approved');
              return (
                <button
                  key={v.product.id}
                  onClick={() => add(v)}
                  disabled={avail <= 0}
                  className="focus-ring group relative flex flex-col items-center rounded-[18px] bg-white/55 p-3 text-center ring-1 ring-black/[.03] transition hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-glass disabled:opacity-45"
                  aria-label={`Add ${v.product.name}, ${money(v.product.price)}`}
                >
                  {rescue && <Badge tone="brand" className="absolute left-2 top-2 px-1.5 text-[10px]">Rescue price</Badge>}
                  <ProductVisual visual={v.product.visual} brand={v.product.brand} className="h-20 w-16 transition group-hover:scale-105" />
                  <span className="mt-1 line-clamp-2 min-h-[32px] text-xs font-medium leading-4">{v.product.name}</span>
                  <span className="num mt-0.5 text-sm font-semibold">{money(v.product.price)}</span>
                  <span className={cn('text-[10.5px]', avail <= 0 ? 'text-bad' : avail <= v.product.minStock ? 'text-warn' : 'text-ink-3')}>{avail <= 0 ? 'No sellable stock' : `${qty(avail)} ${unitLabel(v.product.unit)}`}</span>
                </button>
              );
            })}
          </div>
          {shown.length === 0 && <Empty title="No matching products" action={<ButtonLink to={`/inventory?new=1${/^\d{6,}$/.test(q) ? `&barcode=${q}` : ''}`}>Add product</ButtonLink>}>Check the spelling or scan again.</Empty>}
        </section>

        {/* ── middle: cart (desktop/tablet) ── */}
        <section className="panel-read sticky top-24 hidden max-h-[calc(100dvh-7rem)] flex-col p-4 lg:flex" aria-label="Bill">{cartPanel}</section>

        {/* ── right: printer + receipt ── */}
        <section className="panel hidden flex-col p-4 2xl:flex" aria-label="Receipt printer">
          <Printer3D status={printer} label={done?.number} feedKey={feedKey} paper={<ThermalReceipt m={receipt} b={s.business} className="text-[8px]" />} />
          <p className="mb-2 mt-4 text-xs font-medium text-ink-2">{done ? 'Saved invoice' : 'Live preview'}</p>
          <div className="max-h-[420px] overflow-y-auto rounded-[14px] shadow-[0_8px_24px_-12px_rgba(0,0,0,.25)]">
            <ThermalReceipt m={receipt} b={s.business} />
          </div>
          <p className="mt-2 text-[11px] text-ink-3">Uses your browser’s print dialog (80 mm or A4). Silent printing and printer status need a device integration that is not connected.</p>
        </section>
      </div>

      {/* printer for lg (below grid) */}
      <section className="panel hidden p-4 lg:grid lg:grid-cols-[300px_1fr] lg:gap-6 2xl:hidden" aria-label="Receipt printer">
        <Printer3D compact status={printer} label={done?.number} feedKey={feedKey} paper={<ThermalReceipt m={receipt} b={s.business} className="text-[8px]" />} />
        <div className="max-h-[320px] overflow-y-auto rounded-[14px] shadow-[0_8px_24px_-12px_rgba(0,0,0,.25)]"><ThermalReceipt m={receipt} b={s.business} /></div>
      </section>

      {/* mobile: sticky total bar + cart sheet */}
      <div className="no-print fixed inset-x-3 bottom-3 z-30 lg:hidden">
        <button onClick={() => setMobileCart(true)} className="glass-strong focus-ring flex w-full items-center justify-between rounded-[22px] px-5 py-3 shadow-lift" aria-label="Open bill">
          <span className="text-left">
            <span className="block text-xs text-ink-2">{cart.length} line{cart.length === 1 ? '' : 's'}</span>
            <span className="num block text-xl font-medium">{money(done ? done.total : total)}</span>
          </span>
          <span className="rounded-[14px] bg-brand px-4 py-2.5 text-sm font-semibold text-ink">{done ? 'View bill' : 'Review & pay'}</span>
        </button>
      </div>
      {mobileCart && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Bill">
          <button className="absolute inset-0 bg-[rgba(242,241,237,.6)] backdrop-blur-sm" onClick={() => setMobileCart(false)} aria-label="Close bill" />
          <div className="glass-strong animate-rise absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-[28px] p-4 shadow-lift">
            <button onClick={() => setMobileCart(false)} className="absolute right-4 top-4 rounded-full p-1.5 text-ink-2 hover:bg-white" aria-label="Close"><X size={18} /></button>
            <div className="min-h-0 flex-1 overflow-y-auto">{cartPanel}</div>
          </div>
        </div>
      )}

      <NewCustomerDialog open={newCust} onOpenChange={setNewCust} onCreated={setCustomerId} />
      <Dialog open={camera} onOpenChange={setCamera} title="Scan to add" description="Point the camera at the product barcode.">
        {camera && (
          <CameraScanner
            active={camera}
            onCode={(c) => {
              setCamera(false);
              const v = views.find((x) => x.product.barcode === c);
              if (v) add(v);
              else toast.error(`No product with barcode ${c}`, { action: { label: 'Add product', onClick: () => navigate(`/inventory?new=1&barcode=${c}`) } });
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

const Line = ({ l, r }: { l: string; r: string }) => (
  <div className="flex justify-between gap-3"><span className="text-ink-2">{l}</span><span className="num">{r}</span></div>
);

export function NewCustomerDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add customer"
      description="Only a name is required. A phone number helps find them next time."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (name.trim().length < 2) return setErr('Enter the customer’s name.');
              const digits = phone.replace(/\D/g, '');
              if (phone && (digits.length < 10 || digits.length > 12)) return setErr('Phone numbers have 10 digits.');
              if (digits && getState().customers.some((c) => c.phone.replace(/\D/g, '') === digits)) return setErr('A customer with this phone already exists.');
              const id = uid('cus');
              dispatch((d) => void d.customers.push({ id, name: name.trim(), phone: phone.trim(), creditDays: 15 }));
              onCreated(id);
              toast.success(`${name.trim()} added`);
              setName('');
              setPhone('');
              setErr('');
              onOpenChange(false);
            }}
          >
            Add customer
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="nc-n" error={err}><Input id="nc-n" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="Phone" htmlFor="nc-p"><Input id="nc-p" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98290 12345" /></Field>
      </div>
    </Dialog>
  );
}
