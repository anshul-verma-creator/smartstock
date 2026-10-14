import { ArrowLeft, ClipboardList, Phone, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ProductThumb } from '@/components/brand/ProductVisual';
import { Badge, Button, ButtonLink, Dialog, Empty, Field, Input, Panel, PanelHeader, Select, Stat } from '@/components/ui';
import { PageHeader } from '@/components/layout/AppShell';
import { productViews } from '@/data/derived';
import { purchaseDue, recordSupplierPayment, supplierBalance } from '@/data/engine';
import { dispatch, useAppData } from '@/data/store';
import type { PayMethod } from '@/data/types';
import { fmtDate } from '@/lib/dates';
import { money, money0, qty } from '@/lib/format';
import { run } from '@/features/product/dialogs';

export default function SupplierDetail() {
  const { id = '' } = useParams();
  const s = useAppData();
  const x = s.suppliers.find((y) => y.id === id);
  const [pay, setPay] = useState(false);
  const ledger = useMemo(() => {
    if (!x) return [];
    const rows = [
      ...s.purchases.filter((p) => p.supplierId === id).map((p) => ({ date: p.date, label: `Purchase ${p.billNumber}`, inc: p.total, dec: 0 })),
      ...s.payments.filter((p) => p.supplierId === id && p.kind === 'supplier_payment').map((p) => ({ date: p.date, label: `Payment · ${p.method.toUpperCase()}${p.reference ? ` · ${p.reference}` : ''}`, inc: 0, dec: p.amount })),
      ...s.rescues.filter((r) => r.supplierId === id && r.type === 'supplier_return' && r.status === 'confirmed').map((r) => ({ date: r.confirmedOn!, label: `Return credit · ${s.products.find((p) => p.id === r.productId)?.name}`, inc: 0, dec: r.recovered })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    let bal = 0;
    return rows.map((r) => ({ ...r, bal: (bal = Math.round((bal + r.inc - r.dec) * 100) / 100) })).reverse();
  }, [s, id, x]);
  if (!x) return <Panel><Empty title="Supplier not found" action={<ButtonLink to="/suppliers">All suppliers</ButtonLink>} /></Panel>;
  const balance = supplierBalance(s, id);
  const products = productViews(s).filter((v) => v.product.supplierId === id);
  const orders = s.orders.filter((o) => o.supplierId === id);
  return (
    <div className="space-y-6">
      <Link to="/suppliers" className="link text-xs"><ArrowLeft size={13} />All suppliers</Link>
      <PageHeader
        eyebrow="Supplier"
        title={x.name}
        sub={<span className="flex flex-wrap gap-3"><span>{x.contact}</span><span className="flex items-center gap-1"><Phone size={13} />{x.phone}</span><span>{x.address}</span></span>}
        actions={
          <>
            <ButtonLink to={`/purchases/new?supplier=${id}`}><ClipboardList size={15} />Record purchase</ButtonLink>
            <Button variant="primary" onClick={() => setPay(true)} disabled={balance <= 0 || (s.role !== 'owner' && s.role !== 'manager')}><Wallet size={15} />Pay supplier</Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Panel className="p-4"><Stat label={balance >= 0 ? 'You owe' : 'Supplier owes you'} value={money0(Math.abs(balance))} /></Panel>
        <Panel className="p-4"><Stat label="Purchases (all time)" value={money0(s.purchases.filter((p) => p.supplierId === id).reduce((a, p) => a + p.total, 0))} /></Panel>
        <Panel className="p-4"><Stat label="Products supplied" value={products.length} /></Panel>
        <Panel className="p-4"><Stat label="Lead time" value={`${x.leadTimeDays} day${x.leadTimeDays > 1 ? 's' : ''}`} /></Panel>
      </div>
      <div className="grid gap-5 lg:grid-cols-12">
        <Panel className="p-3 sm:p-5 lg:col-span-7">
          <PanelHeader title="Ledger" sub="Newest first. Purchases increase what you owe; payments and return credits reduce it." className="px-1" />
          <div className="max-h-[420px] overflow-auto">
            <table className="table-base">
              <thead className="sticky top-0 bg-white/80 backdrop-blur"><tr><th>Date</th><th>Entry</th><th className="text-right">+ Owed</th><th className="text-right">− Paid</th><th className="text-right">Balance</th></tr></thead>
              <tbody>
                {ledger.map((r, i) => (
                  <tr key={i}><td className="whitespace-nowrap text-ink-2">{fmtDate(r.date)}</td><td>{r.label}</td><td className="num text-right">{r.inc ? money(r.inc) : ''}</td><td className="num text-right text-ok">{r.dec ? money(r.dec) : ''}</td><td className="num text-right font-medium">{money(r.bal)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <div className="space-y-5 lg:col-span-5">
          <Panel>
            <PanelHeader title="Products" sub="Reorder needs based on sales speed and this supplier’s lead time" />
            <ul className="space-y-2">
              {products.map((v) => (
                <li key={v.product.id} className="flex items-center gap-3">
                  <ProductThumb visual={v.product.visual} brand={v.product.brand} className="h-9 w-9" />
                  <Link to={`/products/${v.product.id}`} className="min-w-0 flex-1 truncate text-sm hover:underline">{v.product.name}</Link>
                  {v.reorder.needed ? <ButtonLink size="sm" to={`/purchases/new?product=${v.product.id}&qty=${v.reorder.quantity}`} className="border border-brand/40 text-brand-ink">Reorder {qty(v.reorder.quantity)}</ButtonLink> : <span className="num text-xs text-ink-2">{qty(v.qty)} on hand</span>}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel>
            <PanelHeader title="Purchase orders" action={<ButtonLink size="sm" to="/purchases?tab=orders">All orders</ButtonLink>} />
            {orders.length === 0 ? <p className="text-sm text-ink-2">No orders yet.</p> : orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between border-t py-2 text-sm first:border-t-0 hairline">
                <span><span className="font-mono">{o.number}</span> · {o.items.length} items</span>
                <Badge tone={o.status === 'draft' ? 'warn' : o.status === 'received' ? 'ok' : 'info'}>{o.status}</Badge>
              </div>
            ))}
          </Panel>
          <Panel>
            <PanelHeader title="Open bills" />
            {s.purchases.filter((p) => p.supplierId === id && purchaseDue(p) > 0).slice(-6).reverse().map((p) => (
              <div key={p.id} className="flex justify-between border-t py-2 text-sm first:border-t-0 hairline"><span className="font-mono text-xs">{p.billNumber}</span><span className="num">{money(purchaseDue(p))} due</span></div>
            ))}
          </Panel>
        </div>
      </div>
      <PayDialog open={pay} onOpenChange={setPay} supplierId={id} balance={balance} />
    </div>
  );
}

function PayDialog({ open, onOpenChange, supplierId, balance }: { open: boolean; onOpenChange: (o: boolean) => void; supplierId: string; balance: number }) {
  const [amt, setAmt] = useState(String(balance));
  const [method, setMethod] = useState<PayMethod>('bank');
  const [ref, setRef] = useState('');
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Pay supplier"
      description={`Outstanding ${money(balance)}. Payments settle the oldest bills first and never change stock.`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" onClick={() => run(() => dispatch((d) => recordSupplierPayment(d, supplierId, Number(amt), method, ref || undefined, d.anchor, new Date().toISOString())), 'Payment recorded') && onOpenChange(false)}>Record payment</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Amount (₹)" htmlFor="sp-a"><Input id="sp-a" type="number" min={1} max={balance} value={amt} onChange={(e) => setAmt(e.target.value)} /></Field>
        <Field label="Method" htmlFor="sp-m"><Select id="sp-m" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}><option value="bank">Bank</option><option value="upi">UPI</option><option value="cash">Cash</option></Select></Field>
        <Field label="Reference" htmlFor="sp-r"><Input id="sp-r" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="UTR / cheque no." /></Field>
      </div>
    </Dialog>
  );
}
