import { ArrowRight, CalendarClock, ChevronDown, Clock3, HeartHandshake, LifeBuoy, MapPin, MoveRight, Pencil, Percent, Store, Undo2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ProductVisual } from '@/components/brand/ProductVisual';
import { LineChart } from '@/components/charts';
import { Badge, Button, ButtonLink, cn, Empty, Menu, Panel, TabPanel, Tabs } from '@/components/ui';
import { activityLabel, activityTone } from '@/features/dashboard/Dashboard';
import { locationLabel, netPrice, productView, recommendations, type BatchView } from '@/data/derived';
import { useAppData } from '@/data/store';
import type { RescueType } from '@/data/types';
import { fmtDate, fmtDay, fmtTime } from '@/lib/dates';
import { money, money0, pct, qty, unitLabel } from '@/lib/format';
import { MoveStockDialog, ProductFormDialog, RescueDialog, UpdateStockDialog } from './dialogs';

function usePrefersStatic() {
  const [isStatic, set] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px) and (prefers-reduced-motion: no-preference)');
    const on = () => set(!mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return isStatic;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Scroll-linked product stage: ONE visual instance travels between reserved slots in each section.
 * The target pose follows the viewport centre vertically (clamped between the first and last slot) and only
 * changes column while the viewport centre is inside an empty transition band, so it never crosses text,
 * tables or controls. The rendered pose eases towards the target every frame (slow, smooth inertia) and
 * floats very gently when idle. Only transform/opacity animate; the loop runs only while the stage is visible.
 */
function useScrollStage(
  stage: RefObject<HTMLDivElement>,
  slots: RefObject<HTMLDivElement>[],
  bands: RefObject<HTMLDivElement>[],
  el: RefObject<HTMLDivElement>,
  enabled: boolean,
) {
  useLayoutEffect(() => {
    if (!enabled) return;
    const pose = [
      { r: -9, s: 1 },
      { r: 0, s: 0.92 },
      { r: 8, s: 0.95 },
    ];
    const EASE = 0.055; // fraction of the remaining distance covered per frame (~60fps) → slow, smooth follow
    // Only the vertical position is eased; column, tilt and scale are derived from that eased position, so the
    // rendered visual always sits on the same overlap-free path as the un-eased target.
    let curY: number | null = null;
    let raf = 0;
    let visible = true;

    const target = (forceY?: number) => {
      const st = stage.current;
      const node = el.current;
      if (!st || !node || slots.some((x) => !x.current) || bands.some((b) => !b.current)) return null;
      const sr = st.getBoundingClientRect();
      const rel = (n: HTMLElement) => {
        const r = n.getBoundingClientRect();
        return { x: r.left - sr.left + r.width / 2, y: r.top - sr.top + r.height / 2, top: r.top - sr.top, bottom: r.bottom - sr.top };
      };
      const c = slots.map((x) => rel(x.current!));
      const b = bands.map((x) => rel(x.current!));
      const y = Math.min(Math.max(forceY ?? window.innerHeight / 2 - sr.top, c[0].y), c[2].y);
      let seg = 0;
      let t = 0;
      for (let i = 0; i < b.length; i++) {
        if (y >= b[i].bottom) seg = i + 1;
        else if (y > b[i].top) {
          seg = i;
          t = smooth((y - b[i].top) / (b[i].bottom - b[i].top));
          break;
        }
      }
      const a = Math.min(seg, 2);
      const z = Math.min(seg + 1, 2);
      return {
        x: c[a].x + (c[z].x - c[a].x) * t,
        y,
        r: pose[a].r + (pose[z].r - pose[a].r) * t,
        s: (pose[a].s + (pose[z].s - pose[a].s) * t) * (1 - 0.3 * Math.sin(t * Math.PI)),
      };
    };

    const paint = (p: { x: number; y: number; r: number; s: number }, now: number) => {
      const node = el.current!;
      const float = Math.sin(now / 1900) * 5;
      node.style.transform = `translate3d(${p.x - node.offsetWidth / 2}px, ${p.y - node.offsetHeight / 2 + float}px, 0) rotate(${p.r + Math.sin(now / 2600) * 0.6}deg) scale(${p.s})`;
      node.style.opacity = '1';
    };

    const step = (now: number) => {
      const tg = target();
      if (!tg) return;
      curY = curY === null ? tg.y : curY + (tg.y - curY) * EASE;
      paint(target(curY)!, now);
    };
    const frame = (now: number) => {
      raf = 0;
      step(now);
      if (visible) raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    // dev/test hook: jump straight to the target pose for the current scroll position
    if (import.meta.env.DEV) {
      // advance the easing by exactly one frame (used to simulate scrolling in tests)
      (window as unknown as { __stageStep?: () => void }).__stageStep = () => step(0);
      (window as unknown as { __stageUpdate?: () => void }).__stageUpdate = () => {
        const tg = target();
        if (tg) {
          curY = tg.y;
          paint(tg, 0);
        }
      };
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
    });
    if (stage.current) io.observe(stage.current);
    window.addEventListener('scroll', start, { passive: true });
    window.addEventListener('resize', start);
    frame(performance.now()); // paint immediately, then keep easing on animation frames
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', start);
      window.removeEventListener('resize', start);
      cancelAnimationFrame(raf);
    };
  }, [enabled, stage, slots, bands, el]);
}

const Band = ({ r }: { r: RefObject<HTMLDivElement> }) => <div ref={r} aria-hidden className="hidden h-[64vh] min-h-[420px] lg:block" />;

function statusBadge(b: BatchView, first: boolean) {
  if (b.status === 'expired') return <Badge tone="bad" dot>Expired · blocked</Badge>;
  if (first && b.batch.expiry) return <Badge tone="brand" dot>Sell first</Badge>;
  if (b.status === 'today' || b.status === 'soon') return <Badge tone="warn" dot>Expiring</Badge>;
  if (b.status === 'none') return <Badge tone="neutral">No expiry</Badge>;
  return <Badge tone="ok" dot>Safe</Badge>;
}

export default function ProductPage() {
  const { id = '' } = useParams();
  const s = useAppData();
  const v = productView(s, id);
  const [params, setParams] = useSearchParams();
  const loc = useLocation();
  const isStatic = usePrefersStatic();
  const stage = useRef<HTMLDivElement>(null);
  const visual = useRef<HTMLDivElement>(null);
  const slot0 = useRef<HTMLDivElement>(null);
  const slot1 = useRef<HTMLDivElement>(null);
  const slot2 = useRef<HTMLDivElement>(null);
  const bandA = useRef<HTMLDivElement>(null);
  const bandB = useRef<HTMLDivElement>(null);
  const slots = useMemo(() => [slot0, slot1, slot2], []);
  const bands = useMemo(() => [bandA, bandB], []);
  useScrollStage(stage, slots, bands, visual, !isStatic && !!v);

  const [stockOpen, setStockOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(params.get('move') === '1');
  const [editOpen, setEditOpen] = useState(false);
  const [rescue, setRescue] = useState<{ batchId: string; type: RescueType } | null>(null);
  const [tab, setTab] = useState('activity');
  const [allBatches, setAllBatches] = useState(false);

  useEffect(() => {
    if (loc.hash) document.getElementById(loc.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loc.hash, id]);

  if (!v) return <Panel><Empty title="Product not found" action={<ButtonLink to="/inventory">Back to inventory</ButtonLink>}>It may have been removed.</Empty></Panel>;
  const p = v.product;
  const sup = s.suppliers.find((x) => x.id === p.supplierId);
  const home = s.locations.find((l) => l.id === p.locationId);
  const recs = recommendations(s).filter((r) => r.productId === p.id);
  const next = recs[0];
  const expiring = v.batches.filter((b) => b.status === 'soon' || b.status === 'today' || b.status === 'expired');
  const net = netPrice(p);
  const canEdit = s.role !== 'cashier';
  const allBatchRows = s.batches.filter((b) => b.productId === p.id).sort((a, b) => b.receivedOn.localeCompare(a.receivedOn));
  const firstSellable = v.batches.find((b) => b.status !== 'expired');
  const word = (p.category === 'Dairy' ? p.name.split(' ').find((w) => /milk|dahi|butter|paneer|yogurt/i.test(w)) ?? p.category : p.category).toUpperCase().slice(0, 6);
  const moreItems = [
    { label: 'Move location', icon: <MoveRight size={15} />, onSelect: () => setMoveOpen(true), disabled: !canEdit },
    { label: 'Request supplier return', icon: <Undo2 size={15} />, onSelect: () => v.batches[0] && setRescue({ batchId: v.batches[0].batch.id, type: 'supplier_return' }), disabled: !canEdit || !v.batches.length },
    { label: 'Apply expiry discount', icon: <Percent size={15} />, onSelect: () => firstSellable && setRescue({ batchId: firstSellable.batch.id, type: 'discount' }), disabled: !canEdit || !firstSellable },
    { label: 'List surplus stock', icon: <Store size={15} />, onSelect: () => firstSellable && setRescue({ batchId: firstSellable.batch.id, type: 'surplus_sale' }), disabled: !canEdit || !firstSellable },
    { label: 'Donate', icon: <HeartHandshake size={15} />, onSelect: () => firstSellable && setRescue({ batchId: firstSellable.batch.id, type: 'donation' }), disabled: !canEdit || !firstSellable },
    'sep' as const,
    { label: 'Edit product', icon: <Pencil size={15} />, onSelect: () => setEditOpen(true), disabled: !canEdit },
  ];

  const fcLabels = v.forecast.map((f) => fmtDay(f.date));

  return (
    <div className="relative">
      {/* product-page atmosphere: pearl studio + quiet curved translucent plane (distinct from the dashboard) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-0">
        <div className="absolute inset-0 bg-[radial-gradient(60rem_40rem_at_75%_10%,rgba(255,190,130,.20),transparent_60%),radial-gradient(40rem_30rem_at_10%_80%,rgba(220,214,240,.25),transparent_70%)]" />
        <svg className="absolute -right-40 top-24 h-[720px] w-[1100px] opacity-70" viewBox="0 0 1100 720">
          <defs>
            <linearGradient id="plane" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".9" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
          </defs>
          <path d="M60 640 C 300 300 640 120 1080 60 L 1080 720 L 0 720 Z" fill="url(#plane)" />
          <path d="M60 640 C 300 300 640 120 1080 60" fill="none" stroke="rgba(255,138,0,.18)" strokeWidth="1.2" />
        </svg>
      </div>

      <nav aria-label="Breadcrumb" className="relative z-[2] mb-6 flex items-center gap-1.5 text-xs text-ink-2">
        <Link to="/inventory" className="hover:text-ink">Inventory</Link>/<Link to={`/inventory?category=${encodeURIComponent(p.category)}`} className="hover:text-ink">{p.category}</Link>/<span className="text-ink">{p.name}</span>
      </nav>

      <div ref={stage} className="relative">
        {/* the single travelling visual */}
        {!isStatic && (
          <div aria-hidden className="pointer-events-none absolute left-0 top-0 z-[1] hidden lg:block">
            <div ref={visual} className="w-[300px] opacity-0 will-change-transform xl:w-[340px]" style={{ transformOrigin: '50% 60%' }}>
              <ProductVisual visual={p.visual} brand={p.brand} className="aspect-[300/420] w-full" />
            </div>
          </div>
        )}

        {/* ── Section 1: hero ── */}
        <section className="relative z-[2] grid min-h-[78vh] items-center gap-8 pb-10 lg:grid-cols-[1.05fr_1fr]" aria-labelledby="pname">
          <div className="animate-rise">
            <p className="eyebrow">{p.category}{p.brand ? ` · ${p.brand}` : ''}</p>
            <h1 id="pname" className="mt-3 text-[44px] font-extralight leading-[1.02] tracking-[-0.03em] sm:text-[60px] xl:text-[68px]">{p.name}</h1>
            <p className="mt-4 max-w-md text-lg font-light text-ink-2">Track every batch. Sell the right stock first.</p>
            {expiring[0] && (
              <a href="#batches" className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3.5 py-1.5 text-sm font-medium text-brand-ink ring-1 ring-brand/25">
                <Clock3 size={15} /> {expiring.length} batch{expiring.length > 1 ? 'es' : ''} {expiring[0].status === 'expired' ? 'need attention' : 'expiring soon'}
              </a>
            )}
            <div className="mt-8 grid max-w-lg grid-cols-3 divide-x hairline">
              <div className="pr-4">
                <div className="num text-[22px] font-medium sm:text-2xl">{qty(v.qty)} <span className="text-base font-normal text-ink-2">{unitLabel(p.unit)}</span></div>
                <div className="text-xs text-ink-2">Available stock</div>
              </div>
              <div className="px-4">
                <div className="num text-[22px] font-medium sm:text-2xl">{money(p.price)}</div>
                <div className="text-xs text-ink-2">Selling price</div>
              </div>
              <div className="pl-4">
                <div className="num text-[22px] font-medium sm:text-2xl">{pct(v.margin)}</div>
                <div className="text-xs text-ink-2">Gross margin</div>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-2.5">
              <Button variant="primary" size="lg" onClick={() => setStockOpen(true)} disabled={!canEdit} title={canEdit ? undefined : 'Your role cannot change stock'}>Update stock</Button>
              <ButtonLink to={`/purchases/new?product=${p.id}${v.reorder.needed ? `&qty=${v.reorder.quantity}` : ''}`} size="lg" className="bg-white/70">Create reorder</ButtonLink>
              <Menu trigger={<Button size="lg" variant="ghost" className="ring-1 ring-ink/10">More actions <ChevronDown size={15} /></Button>} items={moreItems} align="start" />
            </div>
            <p className="mt-4 text-sm text-ink-2">
              Cost {money(p.cost)} · Minimum stock {qty(p.minStock)} {unitLabel(p.unit)}
              {canEdit && <button onClick={() => setEditOpen(true)} className="link ml-3 text-xs"><Pencil size={12} /> Edit product</button>}
            </p>
            <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-2">
              <div><dt className="inline">SKU </dt><dd className="inline font-mono text-ink">{p.sku}</dd></div>
              {p.barcode && <div><dt className="inline">Barcode </dt><dd className="inline font-mono text-ink">{p.barcode}</dd></div>}
              <div><dt className="inline">Supplier </dt><dd className="inline text-ink"><Link to={`/suppliers/${sup?.id}`} className="hover:underline">{sup?.name}</Link></dd></div>
              <div><dt className="inline">GST </dt><dd className="inline text-ink">{p.gst}%{p.hsn ? ` · HSN ${p.hsn}` : ''}</dd></div>
            </dl>
            <div className="mt-6 flex gap-4 text-xs font-medium">
              <a href="#batches" className="link">Batches</a><a href="#demand" className="link">Demand</a><a href="#records" className="link">Records</a>
            </div>
          </div>
          {/* reserved slot (desktop) / static visual (mobile, reduced motion) */}
          <div className="relative grid place-items-center">
            <div aria-hidden className="pointer-events-none absolute select-none text-[180px] font-extralight leading-none tracking-tighter text-transparent [-webkit-text-stroke:1px_rgba(23,23,23,.07)] xl:text-[230px]">{word}</div>
            <div ref={slot0} className="relative h-[420px] w-[300px] xl:h-[470px] xl:w-[340px]">
              {isStatic && <ProductVisual visual={p.visual} brand={p.brand} title={`${p.name} pack`} className="h-full w-full" />}
            </div>
          </div>
        </section>

        <Band r={bandA} />
        {/* ── Section 2: batches ── */}
        <section id="batches" className="relative z-[2] grid scroll-mt-28 items-center gap-10 py-10 lg:grid-cols-[0.9fr_1.1fr]" aria-labelledby="batches-h">
          <div className="hidden justify-center lg:flex">
            <div ref={slot1} className="h-[420px] w-[300px] xl:h-[470px] xl:w-[340px]" />
          </div>
          <div>
            <h2 id="batches-h" className="text-[34px] font-light leading-[1.08] tracking-[-0.02em] sm:text-[44px]">Every batch, in<br />the right place.</h2>
            <p className="mt-3 text-ink-2">Know what to sell first and where to find it.</p>
            <Panel read className="mt-6 p-4 sm:p-5">
              {v.batches.length === 0 ? (
                <Empty title="No stock on hand" action={canEdit ? <Button variant="primary" size="sm" onClick={() => setStockOpen(true)}>Add stock</Button> : undefined}>Add a batch to start tracking expiry.</Empty>
              ) : (
                <div className="-mx-1 overflow-x-auto">
                  <table className="table-base min-w-[440px]">
                    <thead><tr><th>Batch</th><th className="text-right">Quantity</th><th>Expiry date</th><th>Status</th><th className="sr-only">Action</th></tr></thead>
                    <tbody>
                      {v.batches.map((b) => (
                        <tr key={b.batch.id}>
                          <td className="font-mono text-xs">{b.batch.internal ? <span className="font-sans text-ink-2">Lot · {fmtDay(b.batch.receivedOn)}</span> : b.batch.code}</td>
                          <td className="num text-right">{qty(b.qty)} <span className="text-[11px] text-ink-3">{b.shelf ? `${qty(b.shelf)} shelf` : ''}{b.shelf && b.back ? ' · ' : ''}{b.back ? `${qty(b.back)} back` : ''}</span></td>
                          <td>{b.batch.expiry ? fmtDate(b.batch.expiry) : '—'}</td>
                          <td>{statusBadge(b, b === firstSellable && v.batches.filter((x) => x.batch.expiry).length > 1)}</td>
                          <td className="text-right">
                            {canEdit && (b.status !== 'safe' && b.status !== 'none') && (
                              <button className="link text-xs" onClick={() => setRescue({ batchId: b.batch.id, type: b.status === 'expired' ? 'supplier_return' : 'discount' })}>Rescue</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm hairline">
                <span className="flex items-center gap-2 text-ink-2"><MapPin size={15} /> {locationLabel(home)} <span className="text-ink-3">· backroom {qty(v.back)}</span></span>
                {canEdit && <button onClick={() => setMoveOpen(true)} className="link text-sm">Move location <ArrowRight size={14} /></button>}
              </div>
              {firstSellable?.daysLeft !== undefined && firstSellable.daysLeft !== null && (
                <p className="mt-3 flex items-center gap-2 border-t pt-3 text-sm text-ink-2 hairline">
                  <CalendarClock size={15} /> Earliest batch {firstSellable.daysLeft === 0 ? 'expires today' : <>expires in <span className="font-semibold text-brand-ink">{firstSellable.daysLeft} days</span></>}
                </p>
              )}
            </Panel>
            <button onClick={() => setAllBatches((x) => !x)} className="link mt-3 text-xs" aria-expanded={allBatches}>{allBatches ? 'Hide batch history' : `View all batches (${allBatchRows.length})`}</button>
            {allBatches && (
              <div className="panel-read mt-3 max-h-72 overflow-auto p-3">
                <table className="table-base">
                  <thead><tr><th>Batch</th><th>Received</th><th>Expiry</th><th className="text-right">Cost</th><th className="text-right">On hand</th></tr></thead>
                  <tbody>
                    {allBatchRows.map((b) => (
                      <tr key={b.id}>
                        <td className="font-mono text-xs">{b.code}</td><td>{fmtDate(b.receivedOn)}</td><td>{b.expiry ? fmtDate(b.expiry) : '—'}</td>
                        <td className="num text-right">{money(b.unitCost)}</td><td className="num text-right">{qty(v.batches.find((x) => x.batch.id === b.id)?.qty ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <Band r={bandB} />
        {/* ── Section 3: demand ── */}
        <section id="demand" className="relative z-[2] scroll-mt-28 py-10" aria-labelledby="demand-h">
          <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
            <div className="mb-8">
              <h2 id="demand-h" className="text-[34px] font-light tracking-[-0.02em] sm:text-[44px]">Plan ahead. Waste less.</h2>
              <p className="mt-2 text-ink-2">Demand and expiry insights that lead to action.</p>
            </div>
            <Panel read className="p-6">
              {v.velocity.sufficient ? (
                <>
                  <p className="text-sm text-ink-2">Next 7 days</p>
                  <div className="num mt-1 text-[38px] font-light tracking-tight">{qty(v.forecastTotal)} <span className="text-lg text-ink-2">{unitLabel(p.unit)}</span></div>
                  <p className="text-xs text-ink-2">Forecast estimate · daily values add up to this total</p>
                  <LineChart
                    height={180}
                    labels={fcLabels}
                    series={[{ name: 'Expected', color: '#ff8a00', values: v.forecast.map((f) => f.units), area: true, dashed: true }]}
                    format={(n) => qty(Math.round(n))}
                    label={`Forecast daily demand for ${p.name}`}
                    className="mt-3"
                  />
                  <p className="mt-2 text-xs text-ink-3">
                    Based on {v.velocity.daysOfHistory} days of sales: 0.6 × last-7-day average ({v.velocity.avg7.toFixed(1)}/day) + 0.4 × last-28-day average ({v.velocity.avg28.toFixed(1)}/day), shaped by weekday pattern.
                  </p>
                  <div className="mt-5 grid grid-cols-2 divide-x border-t pt-5 hairline">
                    <div className="pr-4">
                      <div className="num text-2xl font-light">{v.coverDays === null ? '—' : `${Math.floor(v.coverDays)} days`}</div>
                      <div className="text-xs text-ink-2">of stock cover</div>
                    </div>
                    <div className="pl-4">
                      <div className="num text-2xl font-light">{qty(Math.round(firstSellable?.risk?.unsold ?? 0))} {unitLabel(p.unit)}</div>
                      <div className="text-xs text-ink-2">predicted unsold in the earliest batch</div>
                    </div>
                  </div>
                </>
              ) : (
                <Empty icon={<CalendarClock size={20} />} title="Not enough sales history yet">Forecasts appear after 14 days of sales. Until then, use the minimum stock level for reordering.</Empty>
              )}
            </Panel>
            </div>
            <div className="flex flex-col items-center gap-6">
              <div ref={slot2} className="hidden h-[420px] w-[300px] lg:block xl:h-[470px] xl:w-[340px]" />
              {next ? (
                <Link to={next.to} className="panel-read focus-ring group flex w-full max-w-md items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-brand-soft text-brand-ink"><LifeBuoy size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{next.title}</span>
                    <span className="block text-xs text-ink-2">{next.why}</span>
                  </span>
                  <span className="whitespace-nowrap text-sm font-medium text-brand-ink">{next.action} <ArrowRight size={14} className="inline transition group-hover:translate-x-0.5" /></span>
                </Link>
              ) : (
                <p className="panel-read w-full max-w-md p-4 text-sm text-ink-2">No action needed right now — stock and expiry are healthy.</p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ── Section 4: records ── */}
      <section id="records" className="relative z-[2] scroll-mt-28 pt-10" aria-labelledby="records-h">
        <h2 id="records-h" className="mb-5 text-[34px] font-light tracking-[-0.02em] sm:text-[44px]">Product records</h2>
        <Panel read className="p-2 sm:p-4">
          <Tabs value={tab} onValueChange={setTab} tabs={[{ value: 'activity', label: 'Stock activity' }, { value: 'pricing', label: 'Pricing' }, { value: 'supplier', label: 'Supplier' }]}>
            <TabPanel value="activity"><ActivityTab productId={p.id} /></TabPanel>
            <TabPanel value="pricing">
              <div className="grid gap-6 p-2 md:grid-cols-2">
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    ['Selling price', `${money(p.price)} ${p.includesTax ? '(incl. GST)' : '+ GST'}`], ['GST rate', `${p.gst}%`], ['Net price (excl. GST)', money(net)],
                    ['Purchase cost', money(p.cost)], ['Gross profit / unit', money(net - p.cost)], ['Gross margin', pct(v.margin)],
                    ['Markup on cost', pct(((net - p.cost) / Math.max(0.01, p.cost)) * 100)], ['MRP', p.mrp ? money(p.mrp) : '—'],
                  ].map(([l, val]) => (
                    <div key={l}><dt className="text-xs text-ink-2">{l}</dt><dd className="num mt-0.5 font-medium">{val}</dd></div>
                  ))}
                </dl>
                <div className="rounded-[18px] bg-white/55 p-4 text-sm text-ink-2">
                  <p className="font-medium text-ink">How margin is calculated</p>
                  <p className="mt-1">Gross margin = (net price − cost) ÷ net price. Markup = (net price − cost) ÷ cost. Realised profit on reports uses the exact cost of the batch each unit came from.</p>
                  {canEdit && <Button size="sm" className="mt-3" onClick={() => setEditOpen(true)}><Pencil size={13} /> Edit pricing</Button>}
                </div>
              </div>
            </TabPanel>
            <TabPanel value="supplier"><SupplierTab productId={p.id} /></TabPanel>
          </Tabs>
        </Panel>
      </section>

      <UpdateStockDialog productId={p.id} open={stockOpen} onOpenChange={setStockOpen} />
      <MoveStockDialog productId={p.id} open={moveOpen} onOpenChange={(o) => { setMoveOpen(o); if (!o && params.get('move')) { params.delete('move'); setParams(params, { replace: true }); } }} />
      <ProductFormDialog productId={p.id} open={editOpen} onOpenChange={setEditOpen} />
      {rescue && <RescueDialog open={!!rescue} onOpenChange={(o) => !o && setRescue(null)} batchId={rescue.batchId} type={rescue.type} />}
    </div>
  );
}

function ActivityTab({ productId }: { productId: string }) {
  const s = useAppData();
  const [limit, setLimit] = useState(10);
  const rows = useMemo(() => s.movements.filter((m) => m.productId === productId && m.type !== 'transfer_in').sort((a, b) => b.ts.localeCompare(a.ts)), [s, productId]);
  if (!rows.length) return <Empty title="No stock activity yet" />;
  return (
    <div className="overflow-x-auto">
      <table className="table-base min-w-[560px]">
        <thead><tr><th>Date</th><th>Activity</th><th className="text-right">Quantity</th><th>Batch</th><th>Location</th><th>Reference</th></tr></thead>
        <tbody>
          {rows.slice(0, limit).map((m) => (
            <tr key={m.id}>
              <td className="whitespace-nowrap">{fmtDate(m.date)} <span className="text-ink-3">{fmtTime(m.ts)}</span></td>
              <td><Badge tone={activityTone(m.type)}>{activityLabel(m.type)}</Badge></td>
              <td className={cn('num text-right font-medium', m.qty < 0 && m.type !== 'transfer_out' ? 'text-bad' : m.type === 'transfer_out' ? '' : 'text-ok')}>{m.type === 'transfer_out' ? qty(-m.qty) : `${m.qty > 0 ? '+' : ''}${qty(m.qty)}`}</td>
              <td className="font-mono text-xs text-ink-2">{s.batches.find((b) => b.id === m.batchId)?.code}</td>
              <td className="text-ink-2">{locationLabel(s.locations.find((l) => l.id === m.locationId))}</td>
              <td className="text-ink-2">{m.type === 'sale' && m.ref ? <Link to={`/sales/${m.ref}`} className="hover:underline">{m.note}</Link> : m.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {limit < rows.length && <div className="p-3 text-center"><Button size="sm" onClick={() => setLimit((l) => l + 20)}>Show more ({rows.length - limit} older)</Button></div>}
    </div>
  );
}

function SupplierTab({ productId }: { productId: string }) {
  const s = useAppData();
  const p = s.products.find((x) => x.id === productId)!;
  const sup = s.suppliers.find((x) => x.id === p.supplierId);
  const purchases = s.purchases.filter((pu) => pu.lines.some((l) => l.productId === productId)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const returns = s.rescues.filter((r) => r.productId === productId && r.type === 'supplier_return');
  if (!sup) return <Empty title="No supplier linked" />;
  return (
    <div className="grid gap-6 p-2 md:grid-cols-[260px_1fr]">
      <div className="rounded-[18px] bg-white/55 p-4 text-sm">
        <Link to={`/suppliers/${sup.id}`} className="font-medium hover:underline">{sup.name}</Link>
        <p className="mt-1 text-ink-2">{sup.contact}</p>
        <p className="text-ink-2">{sup.phone}</p>
        {sup.email && <p className="text-ink-2">{sup.email}</p>}
        <p className="mt-2 text-xs text-ink-3">Lead time {sup.leadTimeDays} day{sup.leadTimeDays > 1 ? 's' : ''} · {sup.acceptsReturns ? 'accepts near-expiry returns' : 'no returns'}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="table-base min-w-[420px]">
          <thead><tr><th>Bill</th><th>Date</th><th className="text-right">Qty</th><th className="text-right">Unit cost</th></tr></thead>
          <tbody>
            {purchases.map((pu) => {
              const l = pu.lines.find((x) => x.productId === productId)!;
              return <tr key={pu.id}><td className="font-mono text-xs">{pu.billNumber}</td><td>{fmtDate(pu.date)}</td><td className="num text-right">{qty(l.qty)}</td><td className="num text-right">{money(l.unitCost)}</td></tr>;
            })}
          </tbody>
        </table>
        {returns.length > 0 && <p className="mt-3 text-xs text-ink-2">Returns: {returns.map((r) => `${qty(r.qty)} units (${r.status}, ${money0(r.recovered)} credit)`).join(' · ')}</p>}
      </div>
    </div>
  );
}
