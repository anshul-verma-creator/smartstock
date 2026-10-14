import { Download, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, ButtonLink, Button, Input, Panel, Select, Stat } from '@/components/ui';
import { PageHeader } from '@/components/layout/AppShell';
import { useAppData } from '@/data/store';
import { downloadCSV } from '@/lib/csv';
import { addDays, fmtDate, fmtTime } from '@/lib/dates';
import { money, money0 } from '@/lib/format';

export default function Sales() {
  const s = useAppData();
  const navigate = useNavigate();
  const [from, setFrom] = useState(addDays(s.anchor, -6));
  const [to, setTo] = useState(s.anchor);
  const [q, setQ] = useState('');
  const [method, setMethod] = useState('all');
  const [status, setStatus] = useState('all');
  const [limit, setLimit] = useState(30);
  const rows = useMemo(() => {
    const t = q.toLowerCase();
    return s.invoices
      .filter((i) => i.date >= from && i.date <= to)
      .filter((i) => status === 'all' || (status === 'due' ? i.due > 0 && i.status === 'posted' : i.status === status))
      .filter((i) => method === 'all' || (method === 'credit' ? i.due > 0 || i.payments.length === 0 : i.payments.some((p) => p.method === method)))
      .filter((i) => !t || i.number.toLowerCase().includes(t) || i.customerName?.toLowerCase().includes(t) || i.lines.some((l) => l.name.toLowerCase().includes(t)))
      .sort((a, b) => b.ts.localeCompare(a.ts));
  }, [s, from, to, q, method, status]);
  const posted = rows.filter((r) => r.status === 'posted');
  return (
    <div>
      <PageHeader
        eyebrow="Sales history"
        title="Invoices"
        sub="Every bill is a saved record. Voiding keeps the original and adds reversing entries."
        actions={
          <>
            <Button onClick={() => downloadCSV(`sales-register-${from}-to-${to}.csv`, ['Invoice', 'Date', 'Time', 'Customer', 'Status', 'Items', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'Paid', 'Due', 'Payment'], rows.map((i) => [i.number, i.date, fmtTime(i.ts), i.customerName ?? 'Walk-in', i.status, i.lines.length, i.taxable, i.cgst, i.sgst, i.igst, i.total, i.paid, i.due, i.payments.map((p) => `${p.method}:${p.amount}`).join(' ')]), [`${s.business.name} — sales register ${from} to ${to}`, `Filters: status ${status}, payment ${method}${q ? `, search "${q}"` : ''}`, 'Demo data'])}><Download size={15} />Export register</Button>
            <ButtonLink to="/pos" variant="primary"><Plus size={15} />New bill</ButtonLink>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Panel className="p-4"><Stat label="Invoices (posted)" value={posted.length} /></Panel>
        <Panel className="p-4"><Stat label="Sales incl. GST" value={money0(posted.reduce((a, i) => a + i.total, 0))} /></Panel>
        <Panel className="p-4"><Stat label="GST collected" value={money0(posted.reduce((a, i) => a + i.tax, 0))} /></Panel>
        <Panel className="p-4"><Stat label="Still due (credit)" value={money0(posted.reduce((a, i) => a + i.due, 0))} /></Panel>
      </div>
      <Panel className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Invoice no., customer or product" className="pl-9" aria-label="Search invoices" />
          </div>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" aria-label="From" />
          <Input type="date" value={to} max={s.anchor} onChange={(e) => setTo(e.target.value)} className="w-40" aria-label="To" />
          <Select value={method} onChange={(e) => setMethod(e.target.value)} className="w-36" aria-label="Payment method"><option value="all">All payments</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank">Bank</option><option value="credit">Credit</option></Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36" aria-label="Status"><option value="all">All statuses</option><option value="posted">Posted</option><option value="voided">Voided</option><option value="due">With dues</option></Select>
        </div>
        <div className="-mx-1 overflow-x-auto">
          <table className="table-base min-w-[820px]">
            <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th className="text-right">Items</th><th>Payment</th><th className="text-right">GST</th><th className="text-right">Total</th><th>Status</th></tr></thead>
            <tbody>
              {rows.slice(0, limit).map((i) => (
                <tr key={i.id} className="cursor-pointer" onClick={() => navigate(`/sales/${i.id}`)}>
                  <td className="font-mono text-xs font-medium">{i.number}</td>
                  <td className="whitespace-nowrap text-ink-2">{fmtDate(i.date)} · {fmtTime(i.ts)}</td>
                  <td>{i.customerName ?? <span className="text-ink-3">Walk-in</span>}</td>
                  <td className="num text-right">{i.lines.length}</td>
                  <td className="text-xs text-ink-2">{i.payments.length ? i.payments.map((p) => p.method.toUpperCase()).join(' + ') : 'Credit'}</td>
                  <td className="num text-right text-ink-2">{money(i.tax)}</td>
                  <td className="num text-right font-medium">{money(i.total)}</td>
                  <td>{i.status === 'voided' ? <Badge tone="bad">Voided</Badge> : i.due > 0 ? <Badge tone="warn">{money0(i.due)} due</Badge> : <Badge tone="ok">Paid</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-ink-2 hairline">
          <span>{rows.length} invoices</span>
          {limit < rows.length && <Button size="sm" onClick={() => setLimit((l) => l + 50)}>Load more</Button>}
        </div>
      </Panel>
    </div>
  );
}
