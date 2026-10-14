import { Check, HeartHandshake, LifeBuoy, Percent, Store, Undo2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ProductThumb, ProductVisual } from '@/components/brand/ProductVisual';
import { ShareBars } from '@/components/charts';
import { Badge, Button, Dialog, Empty, Field, Input, Panel, PanelHeader, Select } from '@/components/ui';
import { PageHeader } from '@/components/layout/AppShell';
import { productViews, rescueStats, stockAtRisk } from '@/data/derived';
import { approveDiscount, closeRescue, confirmRescue } from '@/data/engine';
import { dispatch, useAppData } from '@/data/store';
import type { PayMethod, RescueEvent, RescueType } from '@/data/types';
import { fmtDate, fmtMonth, relDays } from '@/lib/dates';
import { money, money0, qty } from '@/lib/format';
import { RescueDialog, run } from '@/features/product/dialogs';

const TYPE: Record<RescueType, { label: string; icon: React.ReactNode }> = {
  supplier_return: { label: 'Supplier return', icon: <Undo2 size={15} /> },
  surplus_sale: { label: 'Surplus listing', icon: <Store size={15} /> },
  discount: { label: 'Expiry discount', icon: <Percent size={15} /> },
  donation: { label: 'Donation', icon: <HeartHandshake size={15} /> },
};
const STATUS_TONE = { requested: 'warn', listed: 'info', approved: 'brand', confirmed: 'ok', cancelled: 'neutral' } as const;
const STATUS_LABEL = { requested: 'Requested', listed: 'Listed', approved: 'Active', confirmed: 'Confirmed', cancelled: 'Cancelled' } as const;

export default function Rescue() {
  const s = useAppData();
  const [params, setParams] = useSearchParams();
  const views = productViews(s);
  const month = s.anchor.slice(0, 7);
  const stats = rescueStats(s, `${month}-01`, s.anchor);
  const risk = stockAtRisk(s);
  const [dlg, setDlg] = useState<{ batchId: string; type?: RescueType; pct?: number } | null>(null);
  const [confirm, setConfirm] = useState<RescueEvent | null>(null);

  useEffect(() => {
    const batch = params.get('batch');
    const product = params.get('product');
    const type = params.get('type') as RescueType | null;
    if (batch) setDlg({ batchId: batch, type: type ?? undefined, pct: Number(params.get('pct')) || undefined });
    else if (product) {
      const v = views.find((x) => x.product.id === product);
      const b = v?.batches.find((x) => x.status !== 'expired') ?? v?.batches[0];
      if (b) setDlg({ batchId: b.batch.id, type: type ?? undefined });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const candidates = useMemo(
    () =>
      views
        .flatMap((v) => v.batches.filter((b) => b.status === 'expired' || b.status === 'soon' || b.status === 'today' || (v.demand === 'slow' && (b.daysLeft ?? 999) < 45)).map((b) => ({ v, b })))
        .filter(({ b }) => !s.rescues.some((r) => r.batchId === b.batch.id && ['requested', 'listed', 'approved'].includes(r.status)))
        .sort((a, b) => (a.b.daysLeft ?? 999) - (b.b.daysLeft ?? 999)),
    [views, s.rescues],
  );
  const open = s.rescues.filter((r) => ['requested', 'listed', 'approved'].includes(r.status));
  const history = s.rescues.filter((r) => ['confirmed', 'cancelled'].includes(r.status)).sort((a, b) => (b.confirmedOn ?? b.createdOn).localeCompare(a.confirmedOn ?? a.createdOn));
  const canManage = s.role === 'owner' || s.role === 'manager';

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Stock rescue" title="Recover money from unsold stock" sub="Return, resell, discount or donate stock before it becomes waste. Requests and confirmed outcomes are tracked separately; expired stock is never offered for sale." />

      <div className="grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-5">
          <PanelHeader title="Stock saved" sub={`${fmtMonth(month)} · confirmed outcomes only`} />
          <div className="num text-[44px] font-extralight tracking-tight">{money0(stats.total)}</div>
          <p className="text-sm text-ink-2"><span className="num font-medium text-ink">{qty(stats.units)}</span> units saved from waste</p>
          <div className="mt-5">
            <ShareBars items={[{ label: 'Supplier returns (credit)', value: stats.supplier_return }, { label: 'Surplus sales (excl. GST)', value: stats.surplus_sale, color: '#ffb35c' }, { label: 'Discount sales (excl. GST)', value: stats.discount, color: '#ffd9a8' }]} format={money0} />
          </div>
          <p className="mt-4 text-xs text-ink-3">Each recovered unit is counted once: return credits, or revenue of sale lines tagged with a rescue. Donations save units but recover ₹0.</p>
        </Panel>
        <Panel className="lg:col-span-7">
          <PanelHeader title="Stock at risk" sub="Cost value of units in batches that are expired or expire within the warning window — an exposure, not a confirmed loss" />
          <div className="flex flex-wrap items-end gap-8">
            <div><div className="num text-[32px] font-extralight">{money0(risk.total)}</div><div className="text-xs text-ink-2">{risk.batches} batches at risk (cost)</div></div>
            <div><div className="num text-[32px] font-extralight text-bad">{money0(risk.unsoldCost)}</div><div className="text-xs text-ink-2">forecast to stay unsold (cost)</div></div>
          </div>
          <div className="mt-5"><ShareBars items={risk.byCat.map(([l, v]) => ({ label: l, value: v }))} format={money0} /></div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Rescue candidates" sub="Near-expiry, expired and slow-moving batches without an open rescue" />
        {candidates.length === 0 ? (
          <Empty icon={<LifeBuoy size={20} />} title="Nothing to rescue">Every at-risk batch already has a rescue in progress.</Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {candidates.map(({ v, b }) => (
              <div key={b.batch.id} className="flex gap-3 rounded-[20px] bg-white/55 p-4 ring-1 ring-black/[.03]">
                <ProductVisual visual={v.product.visual} brand={v.product.brand} className="h-20 w-14 shrink-0" />
                <div className="min-w-0 flex-1">
                  <Link to={`/products/${v.product.id}`} className="block truncate font-medium hover:underline">{v.product.name}</Link>
                  <p className="text-xs text-ink-2">{b.batch.internal ? 'Lot' : b.batch.code} · {qty(b.qty)} units · {b.daysLeft !== null ? relDays(b.daysLeft) : 'no expiry'}</p>
                  <p className="mt-1 text-xs">{b.status === 'expired' ? <span className="text-bad">Expired — return or write off only</span> : (b.risk?.unsold ?? 0) > 0 ? <span className="text-warn">~{Math.round(b.risk!.unsold)} may stay unsold · {money0(b.risk!.unsold * b.batch.unitCost)}</span> : <span className="text-ink-2">Slow-moving · {v.velocity.perDay.toFixed(1)}/day</span>}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button size="sm" variant="primary" onClick={() => setDlg({ batchId: b.batch.id, type: b.status === 'expired' ? 'supplier_return' : undefined })} disabled={s.role === 'cashier'}>Rescue</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel className="p-3 sm:p-5">
        <PanelHeader title="In progress" sub="Requests waiting for approval or confirmation" className="px-1" />
        {open.length === 0 ? <Empty title="No open rescues" /> : (
          <div className="-mx-1 overflow-x-auto">
            <table className="table-base min-w-[820px]">
              <thead><tr><th>Product</th><th>Type</th><th className="text-right">Qty</th><th>Terms</th><th>Status</th><th>Since</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {open.map((r) => {
                  const p = s.products.find((x) => x.id === r.productId)!;
                  const batch = s.batches.find((x) => x.id === r.batchId)!;
                  return (
                    <tr key={r.id}>
                      <td><Link to={`/products/${p.id}`} className="flex items-center gap-2.5 font-medium hover:underline"><ProductThumb visual={p.visual} brand={p.brand} className="h-8 w-8" /><span><span className="block max-w-[180px] truncate">{p.name}</span><span className="block font-mono text-[11px] font-normal text-ink-3">{batch.internal ? 'lot' : batch.code}</span></span></Link></td>
                      <td><span className="inline-flex items-center gap-1.5 text-sm">{TYPE[r.type].icon}{TYPE[r.type].label}</span></td>
                      <td className="num text-right">{qty(r.type === 'discount' ? r.qty - r.confirmedQty : r.qty)}</td>
                      <td className="text-xs text-ink-2">
                        {r.type === 'discount' && `${r.discountPct}% off · ${qty(r.confirmedQty)} sold · ${money0(r.recovered)} recovered`}
                        {r.type === 'surplus_sale' && `${money(r.offerPrice!)} each · cost ${money(r.unitCost)}`}
                        {r.type === 'supplier_return' && `Credit ≈ ${money0(r.qty * r.unitCost)} · ${s.suppliers.find((x) => x.id === r.supplierId)?.name}`}
                        {r.type === 'donation' && (r.counterparty ?? 'Recipient to be confirmed')}
                      </td>
                      <td><Badge tone={STATUS_TONE[r.status]} dot>{r.type === 'discount' && r.status === 'requested' ? 'Needs approval' : STATUS_LABEL[r.status]}</Badge></td>
                      <td className="text-xs text-ink-2">{fmtDate(r.createdOn)}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {r.type === 'discount' && r.status === 'requested' && <Button size="sm" variant="primary" disabled={!canManage} title={canManage ? undefined : 'Owner or manager approval needed'} onClick={() => run(() => dispatch((d) => approveDiscount(d, r.id)), 'Discount approved', 'The POS now applies it automatically to this batch.')}><Check size={13} />Approve</Button>}
                          {r.type !== 'discount' && <Button size="sm" variant="primary" disabled={s.role === 'cashier' || (r.type !== 'supplier_return' && !canManage)} onClick={() => setConfirm(r)}><Check size={13} />Confirm</Button>}
                          <Button size="sm" variant="ghost" disabled={s.role === 'cashier'} onClick={() => run(() => dispatch((d) => closeRescue(d, r.id, d.anchor)), r.status === 'approved' ? 'Discount ended' : 'Rescue cancelled')}><X size={13} />{r.status === 'approved' ? 'End' : 'Cancel'}</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel className="p-3 sm:p-5">
        <PanelHeader title="History" sub="Confirmed and cancelled rescues" className="px-1" />
        <div className="-mx-1 overflow-x-auto">
          <table className="table-base min-w-[640px]">
            <thead><tr><th>Date</th><th>Product</th><th>Type</th><th className="text-right">Units</th><th className="text-right">Recovered</th><th>Outcome</th></tr></thead>
            <tbody>
              {history.map((r) => {
                const p = s.products.find((x) => x.id === r.productId)!;
                return (
                  <tr key={r.id}>
                    <td className="text-ink-2">{fmtDate(r.confirmedOn ?? r.createdOn)}</td>
                    <td className="font-medium">{p.name}</td>
                    <td>{TYPE[r.type].label}</td>
                    <td className="num text-right">{qty(r.confirmedQty)}</td>
                    <td className="num text-right">{money0(r.recovered)}</td>
                    <td><Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>{r.counterparty && <span className="ml-2 text-xs text-ink-2">{r.counterparty}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {dlg && (
        <RescueDialog
          open={!!dlg}
          onOpenChange={(o) => {
            if (!o) {
              setDlg(null);
              setParams({}, { replace: true });
            }
          }}
          batchId={dlg.batchId}
          type={dlg.type}
          pct={dlg.pct}
        />
      )}
      {confirm && <ConfirmDialog ev={confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

function ConfirmDialog({ ev, onClose }: { ev: RescueEvent; onClose: () => void }) {
  const s = useAppData();
  const p = s.products.find((x) => x.id === ev.productId)!;
  const [n, setN] = useState(String(ev.qty));
  const [buyer, setBuyer] = useState(s.customers.find((c) => c.isBusiness)?.id ?? '');
  const [method, setMethod] = useState<PayMethod | ''>('bank');
  const [who, setWho] = useState(ev.counterparty ?? '');
  const copy = { supplier_return: 'Confirm the supplier accepted the return. Stock leaves the batch and the supplier balance is credited.', surplus_sale: 'Records a real invoice to the buyer at the offer price and removes the stock.', donation: 'Records the hand-over. Stock leaves the batch; recovered value is ₹0.', discount: '' }[ev.type];
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Confirm ${TYPE[ev.type].label.toLowerCase()}`}
      description={`${p.name} · up to ${qty(ev.qty)} units`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              const ok = run(() => dispatch((d) => confirmRescue(d, ev.id, Number(n), { customerId: buyer, method: method || undefined, counterparty: who }, d.anchor, new Date().toISOString())), 'Rescue confirmed', 'Stock, ledgers and rescue analytics are updated.');
              if (ok) onClose();
            }}
          >
            Confirm
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Quantity confirmed" htmlFor="cf-n"><Input id="cf-n" type="number" min={1} max={ev.qty} value={n} onChange={(e) => setN(e.target.value)} /></Field>
        {ev.type === 'surplus_sale' && (
          <>
            <Field label="Buyer" htmlFor="cf-b"><Select id="cf-b" value={buyer} onChange={(e) => setBuyer(e.target.value)}>{s.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Payment" htmlFor="cf-m" hint={`Total ≈ ${money(Number(n) * (ev.offerPrice ?? 0))}`}><Select id="cf-m" value={method} onChange={(e) => setMethod(e.target.value as PayMethod | '')}><option value="bank">Bank transfer</option><option value="upi">UPI</option><option value="cash">Cash</option><option value="">On credit</option></Select></Field>
          </>
        )}
        {ev.type === 'donation' && <Field label="Recipient" htmlFor="cf-w"><Input id="cf-w" value={who} onChange={(e) => setWho(e.target.value)} /></Field>}
      </div>
      <p className="mt-3 text-xs text-ink-2">{copy}</p>
    </Dialog>
  );
}
