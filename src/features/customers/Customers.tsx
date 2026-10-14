import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Input, Panel, Stat } from '@/components/ui';
import { PageHeader } from '@/components/layout/AppShell';
import { customerDues } from '@/data/derived';
import { useAppData } from '@/data/store';
import { fmtDate } from '@/lib/dates';
import { money0 } from '@/lib/format';
import { NewCustomerDialog } from '@/features/pos/POS';

export default function Customers() {
  const s = useAppData();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [add, setAdd] = useState(false);
  const dues = customerDues(s);
  const rows = useMemo(() => {
    const t = q.toLowerCase().replace(/\s/g, '');
    return dues
      .filter((d) => !t || d.customer.name.toLowerCase().replace(/\s/g, '').includes(t) || d.customer.phone.replace(/\s/g, '').includes(t))
      .map((d) => ({ ...d, spent: s.invoices.filter((i) => i.customerId === d.customer.id && i.status === 'posted').reduce((a, i) => a + i.total, 0), bills: s.invoices.filter((i) => i.customerId === d.customer.id).length }))
      .sort((a, b) => b.due - a.due);
  }, [dues, q, s.invoices]);
  const outstanding = dues.reduce((a, d) => a + d.due, 0);
  return (
    <div>
      <PageHeader eyebrow="Customers" title="Customers & dues" sub="Credit (khata) balances come from unpaid invoices. Repayments reduce dues — they are never counted as new sales." actions={<Button variant="primary" onClick={() => setAdd(true)}><Plus size={15} />Add customer</Button>} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Panel className="p-4"><Stat label="Customers" value={s.customers.length} /></Panel>
        <Panel className="p-4"><Stat label="Outstanding dues" value={money0(outstanding)} /></Panel>
        <Panel className="p-4"><Stat label="Customers with dues" value={dues.filter((d) => d.due > 0).length} /></Panel>
        <Panel className="p-4"><Stat label="Overdue" value={dues.filter((d) => d.due > 0 && d.overdueDays > 0).length} /></Panel>
      </div>
      <Panel className="p-3 sm:p-4">
        <div className="relative mb-3 max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or phone" className="pl-9" aria-label="Search customers" />
        </div>
        <div className="-mx-1 overflow-x-auto">
          <table className="table-base min-w-[700px]">
            <thead><tr><th>Customer</th><th>Phone</th><th className="text-right">Bills</th><th className="text-right">Purchases</th><th className="text-right">Due</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.customer.id} className="cursor-pointer" onClick={() => navigate(`/customers/${d.customer.id}`)}>
                  <td className="font-medium">{d.customer.name}{d.customer.isBusiness && <Badge tone="info" className="ml-2">Business</Badge>}</td>
                  <td className="text-ink-2">{d.customer.phone}</td>
                  <td className="num text-right">{d.bills}</td>
                  <td className="num text-right">{money0(d.spent)}</td>
                  <td className="num text-right font-medium">{d.due > 0 ? money0(d.due) : '—'}</td>
                  <td>{d.due <= 0 ? <Badge tone="ok">Settled</Badge> : d.overdueDays > 0 ? <Badge tone="bad">Overdue {d.overdueDays} days</Badge> : <Badge tone="warn">Due since {fmtDate(d.oldest!)}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <NewCustomerDialog open={add} onOpenChange={setAdd} onCreated={(id) => navigate(`/customers/${id}`)} />
    </div>
  );
}
