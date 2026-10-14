import { ArrowDownUp, Download, Trophy, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProductThumb } from '@/components/brand/ProductVisual';
import { LineChart, ShareBars } from '@/components/charts';
import { Button, Panel, PanelHeader, Select, Stat } from '@/components/ui';
import { PageHeader } from '@/components/layout/AppShell';
import { dailySeries, netPrice, periodSales } from '@/data/derived';
import { useAppData } from '@/data/store';
import { downloadCSV } from '@/lib/csv';
import { fmtDay, fmtMonth, monthRange } from '@/lib/dates';
import { money, money0, moneyShort, pct, qty, unitLabel } from '@/lib/format';

type K = 'name' | 'units' | 'revenue' | 'profit' | 'margin' | 'unit';

export default function Profit() {
  const s = useAppData();
  const months = useMemo(() => [...new Set(s.invoices.map((i) => i.date.slice(0, 7)))].sort().reverse(), [s]);
  const [month, setMonth] = useState(s.anchor.slice(0, 7));
  const [sort, setSort] = useState<{ k: K; dir: 1 | -1 }>({ k: 'profit', dir: -1 });
  const r = monthRange(month);
  const to = r.to > s.anchor ? s.anchor : r.to;
  const p = periodSales(s, r.from, to);
  const series = dailySeries(s, r.from, to);

  const rows = useMemo(
    () =>
      [...p.byProduct.entries()]
        .map(([id, x]) => {
          const prod = s.products.find((y) => y.id === id)!;
          const net = netPrice(prod);
          return { prod, units: x.qty, revenue: x.revenue, cost: x.cost, profit: x.revenue - x.cost, margin: x.revenue ? ((x.revenue - x.cost) / x.revenue) * 100 : 0, net, unit: net - prod.cost };
        })
        .sort((a, b) => {
          const v = (z: typeof a) => (sort.k === 'name' ? z.prod.name : z[sort.k]);
          const x = v(a);
          const y = v(b);
          return (typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number)) * sort.dir;
        }),
    [p, s.products, sort],
  );
  const topSelling = [...rows].sort((a, b) => b.units * b.net - a.units * a.net)[0];
  const topByUnits = [...rows].sort((a, b) => b.units - a.units)[0];
  const mostProfitable = [...rows].sort((a, b) => b.profit - a.profit)[0];
  const byCat = new Map<string, number>();
  rows.forEach((x) => byCat.set(x.prod.category, (byCat.get(x.prod.category) ?? 0) + x.profit));

  const th = (k: K, l: string, right = true) => (
    <th className={right ? 'text-right' : undefined} aria-sort={sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button className="inline-flex items-center gap-1 hover:text-ink" onClick={() => setSort((x) => ({ k, dir: x.k === k ? (x.dir === 1 ? -1 : 1) : -1 }))}>{l}<ArrowDownUp size={11} className={sort.k === k ? 'text-brand-ink' : 'opacity-40'} /></button>
    </th>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Profit"
        title="Monthly profit"
        sub="Gross profit uses net-of-GST revenue and the exact cost of the batch each unit came from. It is not net profit — rent, wages and other expenses are not deducted."
        actions={
          <>
            <Select value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" aria-label="Month">{months.map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}</Select>
            <Button onClick={() => downloadCSV(`profit-${month}.csv`, ['Product', 'SKU', 'Units sold', 'Revenue (excl GST)', 'Cost of goods', 'Gross profit', 'Margin %', 'Purchase price', 'Selling price', 'Profit / unit'], rows.map((x) => [x.prod.name, x.prod.sku, x.units, x.revenue.toFixed(2), x.cost.toFixed(2), x.profit.toFixed(2), x.margin.toFixed(1), x.prod.cost, x.prod.price, x.unit.toFixed(2)]), [`${s.business.name} — product profit, ${fmtMonth(month)} (${r.from} to ${to})`, 'Demo data'])}><Download size={15} />Export</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[['Revenue (excl. GST)', money0(p.revenue)], ['Cost of goods sold', money0(p.cost)], ['Gross profit', money0(p.profit)], ['Gross margin', pct(p.margin)], ['Units sold', qty(rows.reduce((a, x) => a + x.units, 0))]].map(([l, v]) => (
          <Panel key={l} className="p-4"><Stat label={l} value={v} /></Panel>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-8">
          <PanelHeader title="Daily gross profit" sub={`${fmtMonth(month)} · revenue vs gross profit, excl. GST`} />
          <LineChart labels={series.map((d) => fmtDay(d.date))} series={[{ name: 'Revenue', color: '#ff8a00', values: series.map((d) => d.revenue), area: true }, { name: 'Gross profit', color: '#171717', values: series.map((d) => d.profit) }]} format={moneyShort} label={`Daily revenue and profit for ${fmtMonth(month)}`} />
          <p className="mt-2 text-xs text-ink-3">Monthly margin = total gross profit ÷ total revenue (not an average of product margins).</p>
        </Panel>
        <div className="grid gap-5 lg:col-span-4">
          <Panel className="p-5">
            <p className="flex items-center gap-2 text-xs font-medium text-ink-2"><TrendingUp size={14} /> Top selling (by revenue)</p>
            {topSelling && <Champion p={topSelling.prod} line={`${qty(topSelling.units)} ${unitLabel(topSelling.prod.unit)} · ${money0(topSelling.revenue)} revenue`} />}
            {topByUnits && topByUnits !== topSelling && <p className="mt-2 text-xs text-ink-3">Most units: {topByUnits.prod.name} ({qty(topByUnits.units)})</p>}
          </Panel>
          <Panel className="p-5">
            <p className="flex items-center gap-2 text-xs font-medium text-ink-2"><Trophy size={14} /> Most profitable (realised gross profit)</p>
            {mostProfitable && <Champion p={mostProfitable.prod} line={`${money0(mostProfitable.profit)} profit · ${pct(mostProfitable.margin)} margin`} />}
          </Panel>
          <Panel className="p-5">
            <PanelHeader title="Profit by category" className="mb-3" />
            <ShareBars items={[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([l, v]) => ({ label: l, value: v }))} format={money0} />
          </Panel>
        </div>
      </div>

      <Panel className="p-3 sm:p-4">
        <PanelHeader title="Product profit analytics" sub="Unit economics use current prices; totals use realised sales in the month" className="px-2" />
        <div className="-mx-1 overflow-x-auto">
          <table className="table-base min-w-[900px]">
            <thead><tr>{th('name', 'Product', false)}<th className="text-right">Purchase</th><th className="text-right">Selling</th>{th('unit', 'Profit / unit')}{th('margin', 'Margin')}{th('units', 'Units sold')}{th('revenue', 'Revenue')}{th('profit', 'Total profit')}</tr></thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.prod.id}>
                  <td><Link to={`/products/${x.prod.id}`} className="flex items-center gap-2.5 font-medium hover:underline"><ProductThumb visual={x.prod.visual} brand={x.prod.brand} className="h-8 w-8" /><span className="max-w-[200px] truncate">{x.prod.name}</span></Link></td>
                  <td className="num text-right">{money(x.prod.cost)}</td>
                  <td className="num text-right">{money(x.prod.price)}<span className="block text-[10.5px] text-ink-3">{money(x.net)} excl. GST</span></td>
                  <td className="num text-right">{money(x.unit)}</td>
                  <td className="num text-right">{pct(x.margin)}</td>
                  <td className="num text-right">{qty(x.units)}</td>
                  <td className="num text-right">{money0(x.revenue)}</td>
                  <td className="num text-right font-medium">{money0(x.profit)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-medium"><td className="border-t px-3 py-3 hairline">Total</td><td colSpan={4} className="border-t hairline" /><td className="num border-t px-3 text-right hairline">{qty(rows.reduce((a, x) => a + x.units, 0))}</td><td className="num border-t px-3 text-right hairline">{money0(p.revenue)}</td><td className="num border-t px-3 text-right hairline">{money0(p.profit)}</td></tr>
            </tfoot>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Champion({ p, line }: { p: { id: string; name: string; brand?: string; visual: import('@/data/types').Visual }; line: string }) {
  return (
    <Link to={`/products/${p.id}`} className="mt-3 flex items-center gap-3 hover:underline">
      <ProductThumb visual={p.visual} brand={p.brand} className="h-12 w-12" />
      <span><span className="block font-medium">{p.name}</span><span className="text-xs text-ink-2">{line}</span></span>
    </Link>
  );
}
