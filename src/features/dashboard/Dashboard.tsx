import { ArrowRight, ArrowUpRight, CalendarDays, Clock3, PackageX, ShoppingCart, ArrowDown, ArrowUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { StoreBackdrop } from '@/components/brand/IsometricStore';
import { ProductThumb } from '@/components/brand/ProductVisual';
import { CapsuleSpark, FineBars, LineChart, SemiGauge } from '@/components/charts';
import { Badge, ButtonLink, cn, DemoTag, Panel, PanelHeader, Select } from '@/components/ui';
import {
  activeAlerts, dailySeries, locationLabel, periodSales, productViews, rescueStats, stockAtRisk,
} from '@/data/derived';
import { useAppData } from '@/data/store';
import { addDays, fmtDate, fmtDay, fmtMonth, fmtTime, fmtWeekday, monthRange, relDays } from '@/lib/dates';
import { money0, moneyShort, pct, qty, unitLabel } from '@/lib/format';

function MiniCard({ title, to, children, className }: { title: string; to: string; children: React.ReactNode; className?: string }) {
  return (
    <Link to={to} className={cn('panel focus-ring group block p-4 transition-all duration-300 ease-soft hover:-translate-y-0.5 hover:shadow-lift', className)}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium">{title}</span>
        <ArrowUpRight size={15} className="text-ink-3 transition group-hover:text-ink" />
      </div>
      {children}
    </Link>
  );
}

function Delta({ now, prev, suffix = '' }: { now: number; prev: number; suffix?: string }) {
  if (!prev) return <span className="text-xs text-ink-3">no prior data</span>;
  const d = ((now - prev) / Math.abs(prev)) * 100;
  const up = d >= 0;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold', up ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad')}>
        {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
        {Math.abs(d).toFixed(1)}%{suffix}
      </span>
      <span className="text-ink-3">vs same days last month</span>
    </span>
  );
}

export default function Dashboard() {
  const s = useAppData();
  const today = s.anchor;
  const views = productViews(s);
  const alerts = activeAlerts(s);
  const risk = stockAtRisk(s);
  const month = today.slice(0, 7);
  const mtd = periodSales(s, `${month}-01`, today);
  const rescue = rescueStats(s, `${month}-01`, today);

  // weekly fine bars: hourly sales value for the last 7 days (bars sum to the headline)
  const week = useMemo(() => {
    const from = addDays(today, -6);
    const hours = Array.from({ length: 13 }, (_, i) => 8 + i);
    const cells = new Map<string, number>();
    for (const inv of s.invoices) {
      if (inv.status !== 'posted' || inv.date < from || inv.date > today) continue;
      const h = Math.min(20, Math.max(8, Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date(inv.ts)))));
      const k = `${inv.date}|${h}`;
      cells.set(k, (cells.get(k) ?? 0) + inv.total);
    }
    const data: { key: string; value: number; tip: React.ReactNode }[] = [];
    const labels: { index: number; text: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(from, i);
      labels.push({ index: i * 13 + 6, text: fmtWeekday(d) });
      for (const h of hours) {
        const v = cells.get(`${d}|${h}`) ?? 0;
        data.push({ key: `${d}${h}`, value: v, tip: <><div className="font-medium">{fmtWeekday(d)} {fmtDay(d)}, {h}:00–{h + 1}:00</div><div className="num text-ink-2">{money0(v)}</div></> });
      }
    }
    const total = data.reduce((a, x) => a + x.value, 0);
    const todayTotal = data.slice(6 * 13).reduce((a, x) => a + x.value, 0);
    return { data, labels, total, todayTotal };
  }, [s, today]);

  const top = useMemo(() => {
    const p = periodSales(s, addDays(today, -6), today);
    return [...p.byProduct.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 4).map(([id, r]) => ({ v: views.find((x) => x.product.id === id)!, ...r }));
  }, [s, today, views]);

  const sev = { critical: alerts.filter((a) => a.severity === 'critical').length, warning: alerts.filter((a) => a.severity === 'warning').length, info: alerts.filter((a) => a.severity === 'info').length };
  const expiringBatches = views.flatMap((v) => v.batches.filter((b) => b.status === 'soon' || b.status === 'today').map((b) => ({ v, b })));
  const lowCount = views.filter((v) => v.stockStatus !== 'ok').length;
  const refill = views.filter((v) => v.shelf < v.product.minStock && v.back > 0 && v.stockStatus !== 'out');
  const revenueSpark = dailySeries(s, addDays(today, -17), today).map((d) => d.total);

  return (
    <div className="space-y-8">
      {/* ───────── Hero ───────── */}
      <section className="relative -mx-4 -mt-6 overflow-hidden px-4 pb-2 pt-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" aria-labelledby="overview-title">
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block [-webkit-mask-image:linear-gradient(to_bottom,#000_62%,transparent_100%)] [mask-image:linear-gradient(to_bottom,#000_62%,transparent_100%)]">
          <StoreBackdrop className="absolute -right-[4%] -top-[10%] w-[96%] max-w-[1400px] select-none lg:-top-[16%] lg:w-[88%]" />
        </div>
        <div className="relative grid min-h-[430px] grid-cols-1 gap-6 md:grid-cols-[260px_1fr_240px]">
          <div className="flex flex-col">
            <div className="animate-rise">
              <h1 id="overview-title" className="h-page">Overview</h1>
              <p className="mt-2 text-[15px] text-ink-2">
                Track stock and <span className="font-medium text-ink">protect your profit</span>
              </p>
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-3">
                <CalendarDays size={13} /> {fmtWeekday(today)}, {fmtDate(today)} · <DemoTag />
              </p>
            </div>
            <div className="mt-auto grid grid-cols-2 gap-3 pt-8 md:grid-cols-1">
              <MiniCard title="Total Products" to="/inventory" className="animate-rise [animation-delay:80ms]">
                <div className="mt-3 flex items-end justify-between">
                  <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-brand-soft text-brand-ink"><ShoppingCart size={15} /></span>
                  <div className="text-right">
                    <div className="num text-lg font-medium">{qty(s.products.filter((p) => p.status === 'active').length)}</div>
                    <div className="text-[11px] text-ink-2">Active products</div>
                  </div>
                </div>
              </MiniCard>
              <MiniCard title="Stock at Risk" to="/rescue" className="animate-rise [animation-delay:140ms]">
                <div className="mt-3 flex items-end justify-between">
                  <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-brand-soft text-brand-ink"><PackageX size={15} /></span>
                  <div className="text-right">
                    <div className="num text-lg font-medium">{money0(risk.total)}</div>
                    <div className="text-[11px] text-ink-2">Cost exposure, near expiry</div>
                  </div>
                </div>
              </MiniCard>
            </div>
          </div>
          <div className="hidden md:block" />
          <div className="flex flex-col gap-3">
            <MiniCard title="Monthly Revenue" to="/profit" className="animate-rise [animation-delay:200ms]">
              <CapsuleSpark values={revenueSpark} className="mt-3 h-10 w-full" />
              <div className="num mt-3 text-xl font-medium">{money0(mtd.total)}</div>
              <div className="text-[11px] text-ink-2">{fmtMonth(month)} to date · incl. GST</div>
            </MiniCard>
          </div>
        </div>
      </section>

      {/* ───────── First row ───────── */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12" aria-label="Key metrics">
        <Panel className="lg:col-span-5">
          <PanelHeader title="Weekly Sales" sub="Last 7 days, by hour of trading" action={<Link to="/sales" className="link text-xs">History <ArrowRight size={13} /></Link>} />
          <div className="num text-[28px] font-light tracking-tight">{money0(week.total)}</div>
          <p className="mb-2 text-xs text-ink-2">
            Today so far <span className="num font-medium text-ink">{money0(week.todayTotal)}</span> <span className="ml-1 inline-block h-2 w-2 rounded-sm bg-brand align-middle" aria-hidden /> highlighted
          </p>
          <FineBars data={week.data} highlight={(i) => i >= 6 * 13} format={moneyShort} label={`Hourly sales for the last 7 days, total ${money0(week.total)}`} xLabels={week.labels} />
        </Panel>

        <div className="grid gap-5 lg:col-span-3">
          <Panel className="p-5">
            <PanelHeader title="Alerts" className="mb-1" action={<Link to="/alerts" className="text-ink-3 hover:text-ink" aria-label="Open alerts"><ArrowUpRight size={15} /></Link>} />
            <div className="num text-2xl font-light">{alerts.length}</div>
            <SemiGauge {...sev} />
            <p className="text-center text-[11px] text-ink-2">
              <span className="font-medium text-bad">{sev.critical} critical</span> · <span className="font-medium text-warn">{sev.warning} warning</span> · {sev.info} info
            </p>
          </Panel>
          <Panel className="p-5">
            <PanelHeader title="Stock Rescue" className="mb-1" action={<Link to="/rescue" className="text-ink-3 hover:text-ink" aria-label="Open stock rescue"><ArrowUpRight size={15} /></Link>} />
            <div className="flex items-end justify-between">
              <div>
                <div className="num text-2xl font-light">{money0(rescue.total)}</div>
                <div className="text-[11px] text-ink-2">Recovered this month</div>
              </div>
              <div className="text-right">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (rescue.units / Math.max(1, rescue.units + risk.batches * 5)) * 100)}%` }} /></div>
                <div className="num mt-1 text-[11px] text-ink-2">{qty(rescue.units)} units saved</div>
              </div>
            </div>
          </Panel>
        </div>

        <Panel className="lg:col-span-4">
          <PanelHeader title="Top Selling Products" sub="Units sold, last 7 days" action={<Link to="/insights" className="text-ink-3 hover:text-ink" aria-label="Open insights"><ArrowUpRight size={15} /></Link>} />
          <ul className="divide-y hairline">
            {top.map((t) => (
              <li key={t.v.product.id}>
                <Link to={`/products/${t.v.product.id}`} className="focus-ring -mx-2 flex items-center gap-3 rounded-[14px] px-2 py-2.5 transition hover:bg-white/60">
                  <ProductThumb visual={t.v.product.visual} brand={t.v.product.brand} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.v.product.name}</div>
                    <div className="text-xs text-ink-2">{(t.qty / 7).toFixed(1)} {unitLabel(t.v.product.unit)}/day</div>
                  </div>
                  <div className="num text-xs text-ink-2">{qty(t.qty)} sold</div>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      {/* ───────── Today's priorities ───────── */}
      <section aria-labelledby="prio">
        <h2 id="prio" className="h-section">Today’s priorities</h2>
        <p className="mb-4 mt-1 text-sm text-ink-2">Clear risks before they become losses.</p>
        <div className="grid gap-4 md:grid-cols-3">
          <Priority icon={<Clock3 size={18} />} label="Expiring soon" value={`${expiringBatches.length} batches`} sub={`Expiring within ${s.business.expiryWarningDays} days`} to="/alerts?kind=expiring" action="Review batches" />
          <Priority icon={<PackageX size={18} />} label="Low stock" value={`${lowCount} products`} sub="At or below minimum level" to="/inventory?filter=low" action="Create reorder" />
          <Priority icon={<ShoppingCart size={18} />} label="Shelf refill" value={`${refill.length} products`} sub="Shelf below minimum, backroom has stock" to="/alerts?kind=refill" action="Move stock" />
        </div>
      </section>

      {/* ───────── Expiry watchlist + Reorder ───────── */}
      <section className="grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-7">
          <PanelHeader title="Expiry watchlist" sub="Earliest expiry first. Forecast unsold uses current sales speed (FEFO)." action={<Link to="/alerts?kind=expiring" className="link text-xs">View all <ArrowRight size={13} /></Link>} />
          <div className="-mx-2 overflow-x-auto">
            <table className="table-base min-w-[560px]">
              <thead>
                <tr><th>Product</th><th>Batch</th><th className="text-right">Qty</th><th>Expires</th><th className="text-right">Forecast unsold</th><th className="text-right">Action</th></tr>
              </thead>
              <tbody>
                {views
                  .flatMap((v) => v.batches.filter((b) => b.status !== 'safe' && b.status !== 'none').map((b) => ({ v, b })))
                  .sort((a, b) => (a.b.daysLeft ?? 0) - (b.b.daysLeft ?? 0))
                  .slice(0, 6)
                  .map(({ v, b }) => (
                    <tr key={b.batch.id}>
                      <td>
                        <Link to={`/products/${v.product.id}`} className="flex items-center gap-2.5 font-medium hover:underline">
                          <ProductThumb visual={v.product.visual} brand={v.product.brand} className="h-8 w-8" />
                          <span className="max-w-[150px] truncate">{v.product.name}</span>
                        </Link>
                      </td>
                      <td className="font-mono text-xs text-ink-2">{b.batch.code}</td>
                      <td className="num text-right">{qty(b.qty)}</td>
                      <td>
                        <Badge tone={b.status === 'expired' ? 'bad' : (b.daysLeft ?? 9) <= 3 ? 'bad' : 'warn'}>{b.status === 'expired' ? 'Expired' : fmtDay(b.batch.expiry!)}</Badge>
                        <div className="mt-0.5 text-[11px] text-ink-3">{relDays(b.daysLeft!)}</div>
                      </td>
                      <td className="num text-right">{b.status === 'expired' ? <span className="text-bad">{qty(b.qty)} (blocked)</span> : (b.risk?.unsold ?? 0) > 0 ? <span className="text-warn">~{Math.round(b.risk!.unsold)}</span> : <span className="text-ok">0</span>}</td>
                      <td className="text-right">
                        <ButtonLink
                          size="sm"
                          variant="glass"
                          to={b.status === 'expired' ? `/rescue?batch=${b.batch.id}&type=supplier_return` : (b.risk?.unsold ?? 0) > 0 ? `/rescue?batch=${b.batch.id}&type=discount` : `/products/${v.product.id}#batches`}
                          className="border border-brand/40 text-brand-ink"
                        >
                          {b.status === 'expired' ? 'Return' : (b.risk?.unsold ?? 0) > 0 ? 'Discount' : 'Sell first'}
                        </ButtonLink>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel className="lg:col-span-5">
          <PanelHeader title="Reorder suggestions" sub="Sales speed × (supplier lead time + 7-day cover) + minimum − available" action={<Link to="/insights#reorder" className="link text-xs">View all <ArrowRight size={13} /></Link>} />
          <div className="-mx-2 overflow-x-auto">
            <table className="table-base min-w-[380px]">
              <thead><tr><th>Product</th><th>Current</th><th className="text-right">Suggested</th></tr></thead>
              <tbody>
                {views.filter((v) => v.reorder.needed).sort((a, b) => (a.coverDays ?? 0) - (b.coverDays ?? 0)).slice(0, 5).map((v) => (
                  <tr key={v.product.id}>
                    <td>
                      <Link to={`/products/${v.product.id}`} className="flex items-center gap-2.5 font-medium hover:underline">
                        <ProductThumb visual={v.product.visual} brand={v.product.brand} className="h-8 w-8" />
                        <span className="max-w-[130px] truncate">{v.product.name}</span>
                      </Link>
                    </td>
                    <td><Badge tone={v.stockStatus === 'out' ? 'bad' : v.stockStatus === 'low' ? 'bad' : 'warn'}>{v.qty === 0 ? 'Out' : `${qty(v.qty)} left`}</Badge></td>
                    <td className="text-right">
                      <ButtonLink size="sm" to={`/purchases/new?product=${v.product.id}&qty=${v.reorder.quantity}`} className="border border-brand/40 text-brand-ink">Reorder {qty(v.reorder.quantity)}</ButtonLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>

      <Performance />

      {/* ───────── Rescue + Most profitable ───────── */}
      <RescueAndProfit />

      <RecentActivity />
    </div>
  );
}

function Priority({ icon, label, value, sub, to, action }: { icon: React.ReactNode; label: string; value: string; sub: string; to: string; action: string }) {
  return (
    <Link to={to} className="panel focus-ring group flex gap-4 p-5 transition-all duration-300 ease-soft hover:-translate-y-0.5 hover:shadow-lift">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink">{icon}</span>
      <div>
        <div className="text-[13px] text-ink-2">{label}</div>
        <div className="num mt-0.5 text-[22px] font-light tracking-tight">{value}</div>
        <div className="text-xs text-ink-2">{sub}</div>
        <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-ink">
          {action} <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

function Performance() {
  const s = useAppData();
  const today = s.anchor;
  const months = useMemo(() => {
    const m = new Set(s.invoices.map((i) => i.date.slice(0, 7)));
    return [...m].sort().reverse();
  }, [s]);
  const [month, setMonth] = useState(today.slice(0, 7));
  const r = monthRange(month);
  const to = r.to > today ? today : r.to;
  const cur = periodSales(s, r.from, to);
  const days = Number(to.slice(8)) ;
  const prevMonth = addDays(r.from, -1).slice(0, 7);
  const pr = monthRange(prevMonth);
  const prevTo = addDays(pr.from, Math.min(days, Number(pr.to.slice(8))) - 1);
  const prev = periodSales(s, pr.from, prevTo);
  const series = dailySeries(s, r.from, to);
  const views = productViews(s);

  // store-level next-7-day forecast in ₹ (net of GST) = Σ product forecast units × net price
  const fc = Array.from({ length: 7 }, (_, i) => views.reduce((a, v) => a + (v.forecast[i]?.units ?? 0) * (v.product.price / (1 + v.product.gst / 100)), 0));
  const last7 = dailySeries(s, addDays(today, -7), addDays(today, -1)).map((d) => d.revenue);
  const fcLabels = [...Array.from({ length: 7 }, (_, i) => fmtDay(addDays(today, -7 + i))), ...Array.from({ length: 7 }, (_, i) => fmtDay(addDays(today, i + 1)))];
  const topDemand = [...views].filter((v) => v.velocity.sufficient).sort((a, b) => b.forecastTotal * b.product.price - a.forecastTotal * a.product.price).slice(0, 3);

  return (
    <section aria-labelledby="perf" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="perf" className="h-section">Performance &amp; demand</h2>
        <label className="flex items-center gap-2 text-xs text-ink-2">
          <CalendarDays size={14} />
          <span className="sr-only">Month</span>
          <Select value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 w-44">
            {months.map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}
          </Select>
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { l: 'Revenue', v: money0(cur.revenue), n: cur.revenue, p: prev.revenue, h: 'Net sales excl. GST' },
          { l: 'Gross Profit', v: money0(cur.profit), n: cur.profit, p: prev.profit, h: 'Revenue − batch cost of goods sold' },
          { l: 'Gross Margin', v: pct(cur.margin), n: cur.margin, p: prev.margin, h: 'Gross profit ÷ revenue' },
        ].map((k) => (
          <Panel key={k.l} className="p-5">
            <div className="flex items-center justify-between text-[13px] text-ink-2"><span>{k.l}</span><span className="text-[11px] text-ink-3">{k.h}</span></div>
            <div className="num mt-1 text-[28px] font-light tracking-tight">{k.v}</div>
            <Delta now={k.n} prev={k.p} />
          </Panel>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-7">
          <PanelHeader title="Sales & gross profit" sub={`${fmtMonth(month)} · daily, excl. GST`} action={<Link to="/profit" className="text-ink-3 hover:text-ink" aria-label="Open profit"><ArrowUpRight size={15} /></Link>} />
          <div className="mb-2 flex gap-4 text-xs text-ink-2">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand" />Revenue</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ink-3" />Gross profit</span>
          </div>
          <LineChart
            labels={series.map((d) => fmtDay(d.date))}
            series={[
              { name: 'Revenue', color: '#ff8a00', values: series.map((d) => d.revenue), area: true },
              { name: 'Gross profit', color: '#8e8e94', values: series.map((d) => d.profit) },
            ]}
            format={moneyShort}
            label={`Daily revenue and gross profit for ${fmtMonth(month)}`}
          />
        </Panel>
        <Panel className="lg:col-span-5">
          <PanelHeader title="Next 7 days" sub="Forecast estimate, revenue excl. GST" action={<Badge tone="brand">Estimate</Badge>} />
          <div className="flex items-baseline gap-2">
            <span className="num text-[26px] font-light">{money0(fc.reduce((a, b) => a + b, 0))}</span>
            <span className="text-xs text-ink-2">expected · last 7 days {money0(last7.reduce((a, b) => a + b, 0))}</span>
          </div>
          <LineChart
            height={170}
            labels={fcLabels}
            series={[
              { name: 'Actual', color: '#ff8a00', values: [...last7, ...Array(7).fill(null)], area: true },
              { name: 'Forecast', color: '#ff8a00', values: [...Array(6).fill(null), last7[6], ...fc], dashed: true },
            ]}
            format={moneyShort}
            label="Actual revenue for the last 7 days and forecast for the next 7 days"
          />
          <p className="mb-2 mt-3 text-xs font-medium text-ink-2">Top products by forecast demand</p>
          <ul className="space-y-1.5">
            {topDemand.map((v) => (
              <li key={v.product.id} className="flex items-center gap-2 text-sm">
                <ProductThumb visual={v.product.visual} brand={v.product.brand} className="h-7 w-7" />
                <Link to={`/products/${v.product.id}`} className="flex-1 truncate hover:underline">{v.product.name}</Link>
                <span className="num text-xs text-ink-2">{qty(v.forecastTotal)} {unitLabel(v.product.unit)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </section>
  );
}

function RescueAndProfit() {
  const s = useAppData();
  const today = s.anchor;
  const month = today.slice(0, 7);
  const r = rescueStats(s, `${month}-01`, today);
  const risk = stockAtRisk(s);
  const p = periodSales(s, `${month}-01`, today);
  const views = productViews(s);
  const ranked = [...p.byProduct.entries()].map(([id, x]) => ({ v: views.find((y) => y.product.id === id)!, profit: x.revenue - x.cost, margin: x.revenue ? ((x.revenue - x.cost) / x.revenue) * 100 : 0 })).sort((a, b) => b.profit - a.profit).slice(0, 4);
  return (
    <section className="grid gap-5 lg:grid-cols-12">
      <Panel className="lg:col-span-6">
        <PanelHeader title="Sales rescue" sub="Recovered from at-risk stock this month — each unit counted once" action={<Link to="/rescue" className="text-ink-3 hover:text-ink" aria-label="Open stock rescue"><ArrowUpRight size={15} /></Link>} />
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="num text-[30px] font-light tracking-tight">{money0(r.total)}</div>
            <div className="text-xs text-ink-2">Recovered this month</div>
          </div>
          <div className="text-right text-xs text-ink-2"><span className="num font-medium text-brand-ink">{qty(r.units)} units</span> diverted from waste</div>
        </div>
        <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-ink/[.06]" role="img" aria-label="Recovery breakdown">
          <div className="bg-brand" style={{ width: `${(r.supplier_return / Math.max(1, r.total)) * 100}%` }} />
          <div className="bg-[#ffb35c]" style={{ width: `${(r.surplus_sale / Math.max(1, r.total)) * 100}%` }} />
          <div className="bg-[#ffd9a8]" style={{ width: `${(r.discount / Math.max(1, r.total)) * 100}%` }} />
        </div>
        <dl className="mt-4 grid grid-cols-3 divide-x text-sm hairline">
          {[['Supplier returns', r.supplier_return, 'bg-brand'], ['Surplus sales', r.surplus_sale, 'bg-[#ffb35c]'], ['Discounts', r.discount, 'bg-[#ffd9a8]']].map(([l, v, c]) => (
            <div key={l as string} className="px-3 first:pl-0">
              <dt className="flex items-center gap-1.5 text-xs text-ink-2"><span className={cn('h-2 w-2 rounded-full', c as string)} />{l}</dt>
              <dd className="num mt-1 text-lg font-light">{money0(v as number)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 rounded-[14px] bg-white/50 px-3 py-2 text-xs text-ink-2">
          Still exposed: <span className="num font-medium text-ink">{money0(risk.total)}</span> at cost in {risk.batches} near-expiry batches — an exposure, not a confirmed loss.
        </p>
      </Panel>
      <Panel className="lg:col-span-6">
        <PanelHeader title="Most profitable products" sub="Ranked by realised gross profit this month (separate from top-selling)" action={<Link to="/profit" className="text-ink-3 hover:text-ink" aria-label="Open profit"><ArrowUpRight size={15} /></Link>} />
        <table className="table-base">
          <thead><tr><th>#</th><th>Product</th><th className="text-right">Profit</th><th className="text-right">Margin</th></tr></thead>
          <tbody>
            {ranked.map((x, i) => (
              <tr key={x.v.product.id}>
                <td className="num text-ink-2">{i + 1}</td>
                <td><Link to={`/products/${x.v.product.id}`} className="flex items-center gap-2.5 font-medium hover:underline"><ProductThumb visual={x.v.product.visual} brand={x.v.product.brand} className="h-8 w-8" /><span className="truncate">{x.v.product.name}</span></Link></td>
                <td className="num text-right">{money0(x.profit)}</td>
                <td className="num text-right text-ink-2">{pct(x.margin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </section>
  );
}

export function activityLabel(type: string) {
  return ({ sale: 'Sale', purchase: 'Purchase', transfer_in: 'Transfer', transfer_out: 'Transfer', void_reversal: 'Void reversal', purchase_return: 'Supplier return', adjustment: 'Adjustment', write_off: 'Write-off', rescue_out: 'Donation', opening: 'Opening stock' } as Record<string, string>)[type] ?? type;
}
export const activityTone = (type: string) => (type === 'sale' ? 'bad' : type === 'purchase' ? 'ok' : type.startsWith('transfer') ? 'info' : 'warn') as 'bad' | 'ok' | 'info' | 'warn';

function RecentActivity() {
  const s = useAppData();
  const rows = useMemo(() => {
    const list = [...s.movements].filter((m) => m.type !== 'transfer_in').sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 7);
    return list.map((m) => {
      const p = s.products.find((x) => x.id === m.productId)!;
      const loc = s.locations.find((l) => l.id === m.locationId);
      const dest = m.type === 'transfer_out' ? s.movements.find((x) => x.ref === m.ref && x.type === 'transfer_in') : undefined;
      return { m, p, where: dest ? `${locationLabel(loc)} → ${locationLabel(s.locations.find((l) => l.id === dest.locationId))}` : locationLabel(loc) };
    });
  }, [s]);
  return (
    <Panel>
      <PanelHeader title="Recent stock activity" action={<Link to="/inventory/activity" className="link text-xs">View all activity <ArrowRight size={13} /></Link>} />
      <div className="-mx-2 overflow-x-auto">
        <table className="table-base min-w-[640px]">
          <thead><tr><th>When</th><th>Product</th><th>Activity</th><th className="text-right">Quantity</th><th>Location</th></tr></thead>
          <tbody>
            {rows.map(({ m, p, where }) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap text-ink-2">{fmtDay(m.date)} · {fmtTime(m.ts)}</td>
                <td><Link to={`/products/${p.id}`} className="flex items-center gap-2.5 font-medium hover:underline"><ProductThumb visual={p.visual} brand={p.brand} className="h-8 w-8" />{p.name}</Link></td>
                <td><Badge tone={activityTone(m.type)}>{activityLabel(m.type)}</Badge></td>
                <td className={cn('num text-right font-medium', m.qty < 0 && m.type !== 'transfer_out' ? 'text-bad' : m.type === 'transfer_out' ? '' : 'text-ok')}>{m.type === 'transfer_out' ? qty(-m.qty) : `${m.qty > 0 ? '+' : ''}${qty(m.qty)}`}</td>
                <td className="text-ink-2">{where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-ink-3">Transfers move stock between locations; total business stock is unchanged.</p>
    </Panel>
  );
}
