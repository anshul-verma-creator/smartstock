import { ArrowLeft, Phone, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Button, ButtonLink, Dialog, Empty, Field, Input, Panel, PanelHeader, Select, Stat } from '@/components/ui';
import { PageHeader } from '@/components/layout/AppShell';
import { customerDue, recordCustomerPayment } from '@/data/engine';
import { dispatch, useAppData } from '@/data/store';
import type { PayMethod } from '@/data/types';
import { fmtDate, fmtTime } from '@/lib/dates';
import { money, money0 } from '@/lib/format';
import { run } from '@/features/product/dialogs';

export default function CustomerDetail() {
  const { id = '' } = useParams();
  const s = useAppData();
  const c = s.customers.find((x) => x.id === id);
  const [pay, setPay] = useState(false);
  const ledger = useMemo(() => {
    const rows = [
      ...s.invoices.filter((i) => i.customerId === id).flatMap((i) => [
        { ts: i.ts, date: i.date, label: `Bill ${i.number}`, to: `/sales/${i.id}`, debit: i.total, credit: 0 },
        ...i.payments.map((p) => ({ ts: i.ts, date: i.date, label: `Paid at counter · ${p.method.toUpperCase()}`, to: `/sales/${i.id}`, debit: 0, credit: p.amount })),
        ...(i.status === 'voided' ? [{ ts: i.ts + 'z', date: i.date, label: `Void ${i.number}`, to: `/sales/${i.id}`, debit: 0, credit: i.total }] : []),
      ]),
      ...s.payments.filter((p) => p.customerId === id && p.kind === 'customer_repayment').map((p) => ({ ts: p.ts, date: p.date, label: `Repayment · ${p.method.toUpperCase()}${p.reference ? ` · ${p.reference}` : ''}`, to: '', debit: 0, credit: p.amount })),
      ...s.payments.filter((p) => p.customerId === id && p.kind === 'refund').map((p) => ({ ts: p.ts + 'r', date: p.date, label: `Refund · ${p.method.toUpperCase()}`, to: '', debit: p.amount, credit: 0 })),
    ].sort((a, b) => a.ts.localeCompare(b.ts));
    let bal = 0;
    return rows.map((r) => ({ ...r, bal: (bal = Math.round((bal + r.debit - r.credit) * 100) / 100) })).reverse();
  }, [s, id]);
  if (!c) return <Panel><Empty title="Customer not found" action={<ButtonLink to="/customers">All customers</ButtonLink>} /></Panel>;
  const due = customerDue(s, id);
  const bills = s.invoices.filter((i) => i.customerId === id && i.status === 'posted');
  return (
    <div className="space-y-6">
      <Link to="/customers" className="link text-xs"><ArrowLeft size={13} />Customers</Link>
      <PageHeader eyebrow="Customer" title={c.name} sub={<span className="flex items-center gap-2"><Phone size={13} />{c.phone}{c.address ? ` · ${c.address}` : ''} · credit period {c.creditDays} days</span>} actions={<Button variant="primary" disabled={due <= 0 || (s.role === 'inventory')} onClick={() => setPay(true)}><Wallet size={15} />Record payment</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Panel className="p-4"><Stat label="Outstanding due" value={money0(due)} /></Panel>
        <Panel className="p-4"><Stat label="Bills" value={bills.length} /></Panel>
        <Panel className="p-4"><Stat label="Total purchases" value={money0(bills.reduce((a, i) => a + i.total, 0))} /></Panel>
        <Panel className="p-4"><Stat label="Repaid (all time)" value={money0(s.payments.filter((p) => p.customerId === id && p.kind === 'customer_repayment').reduce((a, p) => a + p.amount, 0))} /></Panel>
      </div>
      <div className="grid gap-5 lg:grid-cols-12">
        <Panel className="p-3 sm:p-5 lg:col-span-7">
          <PanelHeader title="Ledger (khata)" sub="Bills add to what they owe; payments reduce it. Newest first." className="px-1" />
          <div className="max-h-[460px] overflow-auto">
            <table className="table-base">
              <thead className="sticky top-0 bg-white/80 backdrop-blur"><tr><th>Date</th><th>Entry</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th></tr></thead>
              <tbody>
                {ledger.map((r, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap text-ink-2">{fmtDate(r.date)}</td>
                    <td>{r.to ? <Link to={r.to} className="hover:underline">{r.label}</Link> : r.label}</td>
                    <td className="num text-right">{r.debit ? money(r.debit) : ''}</td>
                    <td className="num text-right text-ok">{r.credit ? money(r.credit) : ''}</td>
                    <td className="num text-right font-medium">{money(r.bal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel className="lg:col-span-5">
          <PanelHeader title="Unpaid bills" sub="Payments settle the oldest bill first" />
          {bills.filter((i) => i.due > 0).length === 0 ? <p className="text-sm text-ink-2">Nothing due.</p> : (
            <ul className="divide-y hairline">
              {bills.filter((i) => i.due > 0).map((i) => (
                <li key={i.id} className="flex items-center justify-between py-2.5 text-sm">
                  <Link to={`/sales/${i.id}`} className="hover:underline"><span className="font-mono text-xs">{i.number}</span><span className="block text-xs text-ink-2">{fmtDate(i.date)} · {fmtTime(i.ts)}</span></Link>
                  <span className="text-right"><span className="num block font-medium">{money(i.due)}</span><Badge tone="warn">of {money0(i.total)}</Badge></span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <PayDialog open={pay} onOpenChange={setPay} customerId={id} due={due} />
    </div>
  );
}

function PayDialog({ open, onOpenChange, customerId, due }: { open: boolean; onOpenChange: (o: boolean) => void; customerId: string; due: number }) {
  const [amt, setAmt] = useState(String(due));
  const [method, setMethod] = useState<PayMethod>('cash');
  const [ref, setRef] = useState('');
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Record customer payment"
      description={`Outstanding ${money(due)}. This reduces dues; it is not a new sale and does not change stock.`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" onClick={() => run(() => dispatch((d) => recordCustomerPayment(d, customerId, Number(amt), method, ref || undefined, d.anchor, new Date().toISOString())), 'Payment recorded', 'Applied to the oldest bills first.') && onOpenChange(false)}>Record payment</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Amount (₹)" htmlFor="cp-a"><Input id="cp-a" type="number" min={1} max={due} value={amt} onChange={(e) => setAmt(e.target.value)} /></Field>
        <Field label="Method" htmlFor="cp-m"><Select id="cp-m" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank">Bank</option></Select></Field>
        <Field label="Reference" htmlFor="cp-r"><Input id="cp-r" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Optional" /></Field>
      </div>
    </Dialog>
  );
}
