import { ArrowDownUp, Download, FileUp, History, LayoutGrid, List, Plus, ScanLine, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ProductThumb, ProductVisual } from '@/components/brand/ProductVisual';
import { Badge, Button, ButtonLink, cn, Empty, Input, Panel, Segmented, Select, Stat } from '@/components/ui';
import { PageHeader } from '@/components/layout/AppShell';
import { locationLabel, productViews, stockAtRisk, type ProductView } from '@/data/derived';
import { useAppData } from '@/data/store';
import { downloadCSV } from '@/lib/csv';
import { fmtDay, relDays } from '@/lib/dates';
import { money, money0, pct, qty, unitLabel } from '@/lib/format';
import { ProductFormDialog } from '@/features/product/dialogs';
import { ScannerDialog } from '@/features/scanner/ScannerDialog';
import { ImportDialog } from './ImportDialog';

type Filter = 'all' | 'low' | 'out' | 'expiring' | 'expired' | 'inactive';
type SortKey = 'name' | 'qty' | 'value' | 'expiry' | 'velocity' | 'margin';
const PAGE = 12;

export function stockBadge(v: ProductView) {
  if (v.product.status === 'inactive') return <Badge>Inactive</Badge>;
  if (v.stockStatus === 'out') return <Badge tone="bad" dot>Out of stock</Badge>;
  if (v.stockStatus === 'low') return <Badge tone="warn" dot>Low stock</Badge>;
  return <Badge tone="ok" dot>In stock</Badge>;
}

export default function Inventory() {
  const s = useAppData();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const views = productViews(s);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>((params.get('filter') as Filter) ?? 'all');
  const [cat, setCat] = useState(params.get('category') ?? 'All');
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'name', dir: 1 });
  const [page, setPage] = useState(0);
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [form, setForm] = useState<{ open: boolean; barcode?: string }>({ open: params.get('new') === '1', barcode: params.get('barcode') ?? undefined });
  const [scan, setScan] = useState(false);
  const [imp, setImp] = useState(false);
  useEffect(() => setPage(0), [q, filter, cat]);

  const cats = useMemo(() => ['All', ...new Set(s.products.map((p) => p.category))], [s.products]);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const earliest = (v: ProductView) => v.batches.find((b) => b.batch.expiry)?.batch.expiry ?? '9999';
    return views
      .filter((v) => cat === 'All' || v.product.category === cat)
      .filter((v) => !t || v.product.name.toLowerCase().includes(t) || v.product.sku.toLowerCase().includes(t) || v.product.barcode?.includes(t) || v.product.brand?.toLowerCase().includes(t))
      .filter((v) => {
        if (filter === 'low') return v.stockStatus !== 'ok';
        if (filter === 'out') return v.stockStatus === 'out';
        if (filter === 'expiring') return v.batches.some((b) => b.status === 'soon' || b.status === 'today');
        if (filter === 'expired') return v.batches.some((b) => b.status === 'expired');
        if (filter === 'inactive') return v.product.status === 'inactive';
        return true;
      })
      .sort((a, b) => {
        const k = sort.k;
        const val = (v: ProductView): string | number =>
          k === 'name' ? v.product.name : k === 'qty' ? v.qty : k === 'value' ? v.value : k === 'expiry' ? earliest(v) : k === 'velocity' ? v.velocity.perDay : v.margin;
        const x = val(a);
        const y = val(b);
        return (typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number)) * sort.dir;
      });
  }, [views, q, filter, cat, sort]);

  const totals = {
    active: views.filter((v) => v.product.status === 'active').length,
    low: views.filter((v) => v.stockStatus === 'low').length,
    out: views.filter((v) => v.stockStatus === 'out').length,
    value: views.reduce((a, v) => a + v.value, 0),
    expiring: views.reduce((a, v) => a + v.batches.filter((b) => b.status === 'soon' || b.status === 'today').length, 0),
    expired: views.reduce((a, v) => a + v.batches.filter((b) => b.status === 'expired').reduce((x, b) => x + b.qty, 0), 0),
  };
  const risk = stockAtRisk(s);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const visible = rows.slice(page * PAGE, page * PAGE + PAGE);

  const th = (k: SortKey, label: string, right?: boolean) => (
    <th className={right ? 'text-right' : undefined} aria-sort={sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button className="focus-ring inline-flex items-center gap-1 rounded hover:text-ink" onClick={() => setSort((x) => ({ k, dir: x.k === k ? (x.dir === 1 ? -1 : 1) : 1 }))}>
        {label} <ArrowDownUp size={11} className={sort.k === k ? 'text-brand-ink' : 'opacity-40'} />
      </button>
    </th>
  );

  const exportCSV = () =>
    downloadCSV(
      `inventory-${s.anchor}.csv`,
      ['SKU', 'Name', 'Brand', 'Category', 'Barcode', 'Unit', 'Stock', 'Shelf', 'Backroom', 'Min stock', 'Cost', 'Price', 'GST %', 'Stock value (cost)', 'Earliest expiry', 'Location', 'Status'],
      rows.map((v) => [v.product.sku, v.product.name, v.product.brand ?? '', v.product.category, v.product.barcode ?? '', v.product.unit, v.qty, v.shelf, v.back, v.product.minStock, v.product.cost, v.product.price, v.product.gst, v.value.toFixed(2), v.batches.find((b) => b.batch.expiry)?.batch.expiry ?? '', locationLabel(s.locations.find((l) => l.id === v.product.locationId)), v.stockStatus]),
      [`${s.business.name} — Inventory export`, `Generated ${new Date().toLocaleString('en-IN')} · filter: ${filter}, category: ${cat}${q ? `, search: ${q}` : ''}`, 'Demo data'],
    );

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="Stock on hand"
        sub="Every quantity here comes from recorded purchases, sales, transfers and adjustments."
        actions={
          <>
            <Button onClick={() => setScan(true)}><ScanLine size={15} />Scan</Button>
            <Button onClick={() => setImp(true)}><FileUp size={15} />Import CSV</Button>
            <Button onClick={exportCSV}><Download size={15} />Export</Button>
            {s.role !== 'cashier' && <Button variant="primary" onClick={() => setForm({ open: true })}><Plus size={15} />Add product</Button>}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ['Active products', qty(totals.active), 'all'],
          ['Low stock', qty(totals.low), 'low'],
          ['Out of stock', qty(totals.out), 'out'],
          ['Stock value (at cost)', money0(totals.value), 'all'],
          ['Batches expiring', qty(totals.expiring), 'expiring'],
          ['Expired units on hand', qty(totals.expired), 'expired'],
        ].map(([l, v, f]) => (
          <button key={l} onClick={() => setFilter(f as Filter)} className={cn('panel focus-ring p-4 text-left transition hover:-translate-y-0.5', filter === f && f !== 'all' && 'ring-2 ring-brand/40')}>
            <Stat label={l} value={v} />
          </button>
        ))}
      </div>

      <Panel className="p-3 sm:p-4">
        <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, SKU, brand or barcode" className="pl-9" aria-label="Search inventory" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-40" aria-label="Category">
              {cats.map((c) => <option key={c}>{c}</option>)}
            </Select>
            <Select value={filter} onChange={(e) => { setFilter(e.target.value as Filter); params.delete('filter'); setParams(params, { replace: true }); }} className="w-40" aria-label="Stock filter">
              <option value="all">All stock</option><option value="low">Low &amp; out</option><option value="out">Out of stock</option><option value="expiring">Expiring</option><option value="expired">Has expired stock</option><option value="inactive">Inactive</option>
            </Select>
            <Segmented label="View" value={view} onChange={setView} options={[{ value: 'table', label: <List size={14} aria-label="Table" /> }, { value: 'grid', label: <LayoutGrid size={14} aria-label="Cards" /> }]} />
            <ButtonLink to="/inventory/activity"><History size={15} />Activity</ButtonLink>
          </div>
        </div>

        {rows.length === 0 ? (
          <Empty title="No products match" action={<Button onClick={() => { setQ(''); setFilter('all'); setCat('All'); }}>Clear filters</Button>}>Try a different search or filter.</Empty>
        ) : view === 'table' ? (
          <div className="-mx-1 overflow-x-auto">
            <table className="table-base min-w-[900px]">
              <thead>
                <tr>{th('name', 'Product')}<th>Status</th>{th('qty', 'Stock', true)}<th>Shelf / back</th>{th('expiry', 'Earliest expiry')}{th('velocity', 'Sold / day', true)}{th('margin', 'Margin', true)}{th('value', 'Value', true)}<th>Location</th></tr>
              </thead>
              <tbody>
                {visible.map((v) => {
                  const e = v.batches.find((b) => b.batch.expiry);
                  return (
                    <tr key={v.product.id} className="cursor-pointer" onClick={() => navigate(`/products/${v.product.id}`)}>
                      <td>
                        <Link to={`/products/${v.product.id}`} className="flex items-center gap-3" onClick={(ev) => ev.stopPropagation()}>
                          <ProductThumb visual={v.product.visual} brand={v.product.brand} />
                          <span className="min-w-0">
                            <span className="block max-w-[220px] truncate font-medium">{v.product.name}</span>
                            <span className="block font-mono text-[11px] text-ink-3">{v.product.sku}</span>
                          </span>
                        </Link>
                      </td>
                      <td>{stockBadge(v)}</td>
                      <td className="num text-right font-medium">{qty(v.qty)} <span className="text-xs font-normal text-ink-3">{unitLabel(v.product.unit)}</span></td>
                      <td className="num text-xs text-ink-2">{qty(v.shelf)} / {qty(v.back)}</td>
                      <td>{e ? <span className={cn('text-xs', e.status === 'expired' ? 'text-bad' : e.status === 'safe' ? 'text-ink-2' : 'font-medium text-warn')}>{fmtDay(e.batch.expiry!)} · {relDays(e.daysLeft!)}</span> : <span className="text-xs text-ink-3">—</span>}</td>
                      <td className="num text-right">{v.velocity.sufficient ? v.velocity.perDay.toFixed(1) : '—'}</td>
                      <td className="num text-right text-ink-2">{pct(v.margin)}</td>
                      <td className="num text-right">{money0(v.value)}</td>
                      <td className="text-xs text-ink-2">{locationLabel(s.locations.find((l) => l.id === v.product.locationId))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((v) => (
              <Link key={v.product.id} to={`/products/${v.product.id}`} className="focus-ring group rounded-[20px] bg-white/55 p-4 ring-1 ring-black/[.03] transition hover:-translate-y-0.5 hover:bg-white/85">
                <div className="flex justify-between">{stockBadge(v)}<span className="num text-xs text-ink-2">{money(v.product.price)}</span></div>
                <ProductVisual visual={v.product.visual} brand={v.product.brand} className="mx-auto my-2 h-28 w-20 transition group-hover:scale-105" />
                <div className="truncate text-sm font-medium">{v.product.name}</div>
                <div className="num text-xs text-ink-2">{qty(v.qty)} {unitLabel(v.product.unit)} · {locationLabel(s.locations.find((l) => l.id === v.product.locationId))}</div>
              </Link>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-ink-2 hairline">
          <span>{rows.length} products · stock at risk {money0(risk.total)} (cost, near expiry)</span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="num px-2">Page {page + 1} of {pages}</span>
            <Button size="sm" variant="ghost" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </Panel>

      <ProductFormDialog
        open={form.open}
        barcode={form.barcode}
        onOpenChange={(o) => {
          setForm({ open: o });
          if (!o && params.get('new')) {
            params.delete('new');
            params.delete('barcode');
            setParams(params, { replace: true });
          }
        }}
        onSaved={(id) => navigate(`/products/${id}`)}
      />
      <ScannerDialog open={scan} onOpenChange={setScan} />
      <ImportDialog open={imp} onOpenChange={setImp} />
    </div>
  );
}
