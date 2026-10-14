import { Mail, Phone, Plus, Truck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button, Dialog, Field, Input, Panel, Stat } from '@/components/ui';
import { PageHeader } from '@/components/layout/AppShell';
import { productViews, supplierBalances } from '@/data/derived';
import { uid } from '@/data/engine';
import { dispatch, useAppData } from '@/data/store';
import { fmtDate } from '@/lib/dates';
import { money0 } from '@/lib/format';

export default function Suppliers() {
  const s = useAppData();
  const bal = supplierBalances(s);
  const views = productViews(s);
  const [add, setAdd] = useState(false);
  const total = bal.reduce((a, b) => a + Math.max(0, b.balance), 0);
  return (
    <div>
      <PageHeader
        eyebrow="Suppliers"
        title="Suppliers & payables"
        sub="Balances come from the supplier ledger: purchases add, payments and confirmed returns reduce."
        actions={<>{s.role !== 'cashier' && <Button variant="primary" onClick={() => setAdd(true)}><Plus size={15} />Add supplier</Button>}</>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Panel className="p-4"><Stat label="Suppliers" value={s.suppliers.length} /></Panel>
        <Panel className="p-4"><Stat label="You owe in total" value={money0(total)} /></Panel>
        <Panel className="p-4"><Stat label="Open purchase orders" value={s.orders.filter((o) => o.status === 'draft' || o.status === 'ordered').length} /></Panel>
        <Panel className="p-4"><Stat label="Pending returns" value={s.rescues.filter((r) => r.type === 'supplier_return' && r.status === 'requested').length} /></Panel>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {bal.map(({ supplier: x, balance }) => {
          const products = views.filter((v) => v.product.supplierId === x.id);
          const last = s.purchases.filter((p) => p.supplierId === x.id).sort((a, b) => b.date.localeCompare(a.date))[0];
          const needs = products.filter((v) => v.reorder.needed).length;
          return (
            <Link key={x.id} to={`/suppliers/${x.id}`} className="panel focus-ring group p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-white/80 text-ink-2"><Truck size={19} /></span>
                {needs > 0 && <Badge tone="warn">{needs} to reorder</Badge>}
              </div>
              <h2 className="mt-3 font-medium">{x.name}</h2>
              <p className="text-sm text-ink-2">{x.contact} · lead time {x.leadTimeDays} day{x.leadTimeDays > 1 ? 's' : ''}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-2">
                <span className="flex items-center gap-1"><Phone size={12} />{x.phone}</span>
                {x.email && <span className="flex items-center gap-1"><Mail size={12} />{x.email}</span>}
              </div>
              <div className="mt-4 flex items-end justify-between border-t pt-4 hairline">
                <div>
                  <div className="num text-xl font-light">{money0(Math.abs(balance))}</div>
                  <div className="text-xs text-ink-2">{balance > 0 ? 'You owe' : balance < 0 ? 'Supplier owes you' : 'Settled'}</div>
                </div>
                <div className="text-right text-xs text-ink-2">{products.length} products<br />{last ? `Last bill ${fmtDate(last.date)}` : 'No purchases yet'}</div>
              </div>
            </Link>
          );
        })}
      </div>
      <AddSupplier open={add} onOpenChange={setAdd} />
    </div>
  );
}

function AddSupplier({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [f, setF] = useState({ name: '', contact: '', phone: '', email: '', address: '', lead: '2' });
  const [err, setErr] = useState('');
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add supplier"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (f.name.trim().length < 2) return setErr('Enter the supplier name.');
              dispatch((d) => void d.suppliers.push({ id: uid('sup'), name: f.name.trim(), contact: f.contact, phone: f.phone, email: f.email || undefined, address: f.address, leadTimeDays: Number(f.lead) || 2, acceptsReturns: true }));
              toast.success(`${f.name} added`);
              onOpenChange(false);
            }}
          >
            Add supplier
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" error={err} htmlFor="as-n" className="sm:col-span-2"><Input id="as-n" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></Field>
        <Field label="Contact person" htmlFor="as-c"><Input id="as-c" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field>
        <Field label="Phone" htmlFor="as-p"><Input id="as-p" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Email" htmlFor="as-e"><Input id="as-e" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Lead time (days)" htmlFor="as-l"><Input id="as-l" type="number" min={0} value={f.lead} onChange={(e) => setF({ ...f, lead: e.target.value })} /></Field>
        <Field label="Address" htmlFor="as-a" className="sm:col-span-2"><Input id="as-a" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
      </div>
    </Dialog>
  );
}
