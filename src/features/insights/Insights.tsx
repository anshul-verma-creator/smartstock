import { ArrowRight, Flame, Gauge, Info, Lightbulb, MoveRight, Percent, RefreshCcw, Snail, Store, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProductThumb } from '@/components/brand/ProductVisual';
import { Badge, ButtonLink, cn, Panel, PanelHeader, Segmented } from '@/components/ui';
import { PageHeader } from '@/components/layout/AppShell';
import { productViews, recommendations, type Recommendation } from '@/data/derived';
import { useAppData } from '@/data/store';
import { fmtDay, relDays } from '@/lib/dates';
import { money0, qty, unitLabel } from '@/lib/format';

const REC_ICON: Record<Recommendation['kind'], React.ReactNode> = {
  sell_first: <Flame size={17} />, reorder: <RefreshCcw size={17} />, discount: <Percent size={17} />, move: <MoveRight size={17} />, return: <Undo2 size={17} />, surplus: <Store size={17} />,
};
const REC_LABEL: Record<Recommendation['kind'], string> = { sell_first: 'Sell first', reorder: 'Reorder', discount: 'Discount', move: 'Move to shelf', return: 'Return to supplier', surplus: 'List surplus' };

export default function Insights() {
  const s = useAppData();
  const views = productViews(s);
  const recs = recommendations(s);
  const [tab, setTab] = useState<'demand' | 'risk'>('demand');
  const kinds = useMemo(() => [...new Set(recs.map((r) => r.kind))], [recs]);
  const [kind, setKind] = useState<'all' | Recommendation['kind']>('all');

  const demand = [...views].filter((v) => v.product.status === 'active').sort((a, b) => b.velocity.perDay - a.velocity.perDay);
  const fast = demand.filter((v) => v.demand === 'high');
  const slow = demand.filter((v) => v.demand === 'slow');
  const stockouts = demand.filter((v) => v.velocity.sufficient && v.coverDays !== null && v.coverDays < 7 && v.qty > 0);
  const risky = views
    .flatMap((v) => v.batches.filter((b) => b.batch.expiry && (b.risk?.unsold ?? 0) > 0).map((b) => ({ v, b })))
    .sort((a, b) => b.b.risk!.unsold * b.b.batch.unitCost - a.b.risk!.unsold * a.b.batch.unitCost);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI insights"
        title="Know what happens next"
        sub="Explainable forecasts from your own sales history — no black box, no chatbot. Every number is an estimate with its formula shown."
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { icon: <Flame size={17} />, l: 'Fast-moving products', v: fast.length, to: '#demand' },
          { icon: <Snail size={17} />, l: 'Slow-moving products', v: slow.length, to: '#demand' },
          { icon: <Gauge size={17} />, l: 'Predicted stock-outs (7 days)', v: stockouts.length, to: '#demand' },
          { icon: <Percent size={17} />, l: 'Batches at expiry risk', v: risky.length, to: '#risk' },
        ].map((k) => (
          <a key={k.l} href={k.to} className="panel focus-ring flex items-center gap-3 p-4 transition hover:-translate-y-0.5">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft text-brand-ink">{k.icon}</span>
            <span><span className="num block text-2xl font-light">{k.v}</span><span className="text-xs text-ink-2">{k.l}</span></span>
          </a>
        ))}
      </div>

      {/* recommendations */}
      <Panel>
        <PanelHeader title="Recommended actions" sub="Simple rules applied to live stock, expiry and sales speed" action={<Segmented label="Filter recommendations" value={kind} onChange={setKind} options={[{ value: 'all', label: 'All' }, ...kinds.map((k) => ({ value: k, label: REC_LABEL[k] }))]} className="hidden md:inline-flex" />} />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {recs.filter((r) => kind === 'all' || r.kind === kind).slice(0, 12).map((r) => {
            const p = s.products.find((x) => x.id === r.productId)!;
            return (
              <Link key={r.id} to={r.to} className="focus-ring group flex flex-col rounded-[20px] bg-white/55 p-4 ring-1 ring-black/[.03] transition hover:-translate-y-0.5 hover:bg-white/85 hover:shadow-glass">
                <div className="flex items-center gap-2 text-xs font-medium text-brand-ink">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft">{REC_ICON[r.kind]}</span>
                  {REC_LABEL[r.kind]}
                  {r.value ? <span className="num ml-auto text-ink-2">{money0(r.value)} at stake</span> : null}
                </div>
                <div className="mt-3 flex items-start gap-3">
                  <ProductThumb visual={p.visual} brand={p.brand} />
                  <div className="min-w-0">
                    <div className="font-medium">{r.title}</div>
                    <p className="mt-0.5 text-xs text-ink-2">{r.why}</p>
                  </div>
                </div>
                <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-medium">{r.action} <ArrowRight size={14} className="transition group-hover:translate-x-0.5" /></span>
              </Link>
            );
          })}
        </div>
      </Panel>

      <Segmented label="Insight view" value={tab} onChange={setTab} options={[{ value: 'demand', label: 'Sales prediction' }, { value: 'risk', label: 'Expiry risk' }]} />

      {tab === 'demand' ? (
        <Panel id="demand">
          <PanelHeader title="Sales prediction — next 7 days" sub="Estimate = 0.6 × last-7-day average + 0.4 × last-28-day average, shaped by weekday pattern" action={<Badge tone="brand">Estimates</Badge>} />
          <div className="-mx-1 overflow-x-auto">
            <table className="table-base min-w-[860px]">
              <thead><tr><th>Product</th><th>Demand</th><th className="text-right">Sold/day (7d)</th><th className="text-right">Sold/day (28d)</th><th className="text-right">Next 7 days</th><th className="text-right">On hand</th><th className="text-right">Cover</th><th>Outlook</th></tr></thead>
              <tbody>
                {demand.map((v) => (
                  <tr key={v.product.id}>
                    <td><Link to={`/products/${v.product.id}`} className="flex items-center gap-2.5 font-medium hover:underline"><ProductThumb visual={v.product.visual} brand={v.product.brand} className="h-8 w-8" /><span className="max-w-[190px] truncate">{v.product.name}</span></Link></td>
                    <td>{v.demand === 'high' ? <Badge tone="brand">High demand</Badge> : v.demand === 'slow' ? <Badge tone="info">Slow mover</Badge> : v.demand === 'unknown' ? <Badge>Not enough data</Badge> : <Badge tone="neutral">Steady</Badge>}</td>
                    <td className="num text-right">{v.velocity.avg7.toFixed(1)}</td>
                    <td className="num text-right text-ink-2">{v.velocity.avg28.toFixed(1)}</td>
                    <td className="num text-right font-medium">{v.velocity.sufficient ? `${qty(v.forecastTotal)} ${unitLabel(v.product.unit)}` : '—'}</td>
                    <td className="num text-right">{qty(v.qty)}</td>
                    <td className="num text-right">{v.coverDays === null ? '—' : `${v.coverDays.toFixed(0)} d`}</td>
                    <td className="text-xs">
                      {v.velocity.sufficient && v.coverDays !== null && v.coverDays < 7 && v.qty > 0 ? <span className="font-medium text-bad">May run out in {Math.max(1, Math.round(v.coverDays))} day{Math.round(v.coverDays) > 1 ? 's' : ''}</span> : v.stockStatus === 'out' ? <span className="text-bad">Out of stock</span> : <span className="text-ink-2">Covered</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : (
        <Panel id="risk">
          <PanelHeader title="Expiry risk prediction" sub="Current stock + days to expiry + average sales, allocated first-expiry-first-out so the same demand is never counted twice" action={<Badge tone="brand">Estimates</Badge>} />
          {risky.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-2">No batch is expected to remain unsold before expiry.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {risky.map(({ v, b }) => {
                const share = b.risk!.unsold / b.qty;
                return (
                  <div key={b.batch.id} className="rounded-[20px] bg-white/55 p-4 ring-1 ring-black/[.03]">
                    <div className="flex items-start gap-3">
                      <ProductThumb visual={v.product.visual} brand={v.product.brand} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <Link to={`/products/${v.product.id}`} className="truncate font-medium hover:underline">{v.product.name}</Link>
                          <Badge tone={b.status === 'expired' ? 'bad' : share > 0.4 ? 'bad' : 'warn'}>{b.status === 'expired' ? 'Expired' : share > 0.4 ? 'High risk' : 'Medium risk'}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-ink-2">
                          {qty(b.qty)} units · {b.batch.expiry ? `${fmtDay(b.batch.expiry)} (${relDays(b.daysLeft!)})` : ''} · sells {v.velocity.perDay.toFixed(1)}/day
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/[.06]" role="img" aria-label={`${Math.round((1 - share) * 100)}% expected to sell`}>
                      <div className="h-full rounded-full bg-ok/70" style={{ width: `${(1 - share) * 100}%` }} />
                    </div>
                    <div className="mt-2 flex justify-between text-xs">
                      <span className="text-ink-2">Expected to sell {qty(Math.round(b.risk!.expectedSold))}</span>
                      <span className="font-medium text-bad">~{qty(Math.round(b.risk!.unsold))} may remain · {money0(b.risk!.unsold * b.batch.unitCost)} at cost</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <ButtonLink size="sm" variant="primary" to={b.status === 'expired' ? `/rescue?batch=${b.batch.id}&type=supplier_return` : `/rescue?batch=${b.batch.id}&type=discount`}>{b.status === 'expired' ? 'Return to supplier' : 'Rescue stock'}</ButtonLink>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      <div className={cn('flex gap-3 rounded-[20px] bg-white/45 p-4 text-sm text-ink-2')}>
        <Info size={18} className="mt-0.5 shrink-0" />
        <p>
          <Lightbulb size={14} className="mr-1 inline text-brand-ink" />
          Forecasts need at least 14 days of sales; products with less history show “Not enough data”. Predictions describe likely outcomes, not guarantees — weather, festivals and promotions can change demand.
        </p>
      </div>
    </div>
  );
}
