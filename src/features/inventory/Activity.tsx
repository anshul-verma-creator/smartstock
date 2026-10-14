import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProductThumb } from '@/components/brand/ProductVisual';
import { Badge, Button, cn, Input, Panel, Select } from '@/components/ui';
import { PageHeader } from '@/components/layout/AppShell';
import { activityLabel, activityTone } from '@/features/dashboard/Dashboard';
import { locationLabel } from '@/data/derived';
import { useAppData } from '@/data/store';
import { addDays, fmtDate, fmtTime } from '@/lib/dates';
import { downloadCSV } from '@/lib/csv';
import { qty } from '@/lib/format';

const TYPES = ['all', 'sale', 'purchase', 'transfer_out', 'adjustment', 'write_off', 'purchase_return', 'rescue_out', 'void_reversal'];

export default function Activity() {
  const s = useAppData();
  const [type, setType] = useState('all');
  const [from, setFrom] = useState(addDays(s.anchor, -6));
  const [to, setTo] = useState(s.anchor);
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(40);
  const rows = useMemo(() => {
    const t = q.toLowerCase();
    return s.movements
      .filter((m) => m.type !== 'transfer_in' && m.date >= from && m.date <= to && (type === 'all' || m.type === type))
      .map((m) => ({ m, p: s.products.find((x) => x.id === m.productId)! }))
      .filter((r) => !t || r.p.name.toLowerCase().includes(t) || r.m.note.toLowerCase().includes(t))
      .sort((a, b) => b.m.ts.localeCompare(a.m.ts));
  }, [s, type, from, to, q]);
  return (
    <div>
      <PageHeader eyebrow="Inventory" title="Stock movements" sub="The auditable ledger behind every stock number. Transfers appear once and do not change total stock." />
      <Panel className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Product or reference" className="w-56" aria-label="Search movements" />
          <Select value={type} onChange={(e) => setType(e.target.value)} className="w-44" aria-label="Movement type">
            {TYPES.map((t) => <option key={t} value={t}>{t === 'all' ? 'All movements' : activityLabel(t)}</option>)}
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" aria-label="From date" />
          <Input type="date" value={to} max={s.anchor} onChange={(e) => setTo(e.target.value)} className="w-40" aria-label="To date" />
          <Button onClick={() => downloadCSV(`stock-movements-${from}-to-${to}.csv`, ['Date', 'Time', 'Product', 'SKU', 'Type', 'Quantity', 'Unit cost', 'Batch', 'Location', 'Reference'], rows.map(({ m, p }) => [m.date, fmtTime(m.ts), p.name, p.sku, activityLabel(m.type), m.qty, m.unitCost, s.batches.find((b) => b.id === m.batchId)?.code, locationLabel(s.locations.find((l) => l.id === m.locationId)), m.note]), [`${s.business.name} — stock movements ${from} to ${to}`])}>
            <Download size={15} />Export
          </Button>
        </div>
        <div className="-mx-1 overflow-x-auto">
          <table className="table-base min-w-[760px]">
            <thead><tr><th>When</th><th>Product</th><th>Activity</th><th className="text-right">Qty</th><th>Batch</th><th>Location</th><th>Reference</th></tr></thead>
            <tbody>
              {rows.slice(0, limit).map(({ m, p }) => {
                const dest = m.type === 'transfer_out' ? s.movements.find((x) => x.ref === m.ref && x.type === 'transfer_in' && x.batchId === m.batchId) : undefined;
                return (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap text-ink-2">{fmtDate(m.date)} · {fmtTime(m.ts)}</td>
                    <td><Link to={`/products/${p.id}`} className="flex items-center gap-2 font-medium hover:underline"><ProductThumb visual={p.visual} brand={p.brand} className="h-8 w-8" />{p.name}</Link></td>
                    <td><Badge tone={activityTone(m.type)}>{activityLabel(m.type)}</Badge></td>
                    <td className={cn('num text-right font-medium', m.type === 'transfer_out' ? '' : m.qty < 0 ? 'text-bad' : 'text-ok')}>{m.type === 'transfer_out' ? qty(-m.qty) : `${m.qty > 0 ? '+' : ''}${qty(m.qty)}`}</td>
                    <td className="font-mono text-xs text-ink-2">{s.batches.find((b) => b.id === m.batchId)?.code}</td>
                    <td className="text-xs text-ink-2">{locationLabel(s.locations.find((l) => l.id === m.locationId))}{dest ? ` → ${locationLabel(s.locations.find((l) => l.id === dest.locationId))}` : ''}</td>
                    <td className="text-xs text-ink-2">{m.type === 'sale' && m.ref ? <Link to={`/sales/${m.ref}`} className="hover:underline">{m.note}</Link> : m.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-ink-2 hairline">
          <span>{rows.length} movements</span>
          {limit < rows.length && <Button size="sm" onClick={() => setLimit((l) => l + 60)}>Load more</Button>}
        </div>
      </Panel>
    </div>
  );
}
