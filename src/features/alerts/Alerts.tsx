import { AlertOctagon, ArrowRight, BellOff, CheckCircle2, Clock3, Info, PackageX, RotateCcw, ShoppingCart, Sparkles, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ProductThumb } from '@/components/brand/ProductVisual';
import { Button, ButtonLink, cn, Empty, Panel } from '@/components/ui';
import { PageHeader } from '@/components/layout/AppShell';
import { alerts as allAlerts, type Alert, type AlertKind } from '@/data/derived';
import { dispatch, useAppData } from '@/data/store';

const GROUPS: { id: string; label: string; kinds: AlertKind[]; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All', kinds: [], icon: null },
  { id: 'expiring', label: 'Expiry', kinds: ['expired', 'expiring'], icon: <Clock3 size={14} /> },
  { id: 'stock', label: 'Low & out', kinds: ['low', 'out', 'stockout'], icon: <PackageX size={14} /> },
  { id: 'refill', label: 'Shelf refill', kinds: ['refill'], icon: <ShoppingCart size={14} /> },
  { id: 'rescue', label: 'Rescue', kinds: ['rescue'], icon: <Sparkles size={14} /> },
  { id: 'money', label: 'Dues & payables', kinds: ['overdue', 'payable'], icon: <Wallet size={14} /> },
];

const KIND_LABEL: Record<AlertKind, string> = {
  expired: 'Expired', expiring: 'Expiry', out: 'Out of stock', low: 'Low stock', refill: 'Shelf refill', overdue: 'Customer due',
  payable: 'Supplier payment', stockout: 'AI prediction', rescue: 'Stock rescue',
};

export default function Alerts() {
  const s = useAppData();
  const [params, setParams] = useSearchParams();
  const group = params.get('kind') ?? 'all';
  const [showDismissed, setShowDismissed] = useState(false);
  const list = allAlerts(s);
  const g = GROUPS.find((x) => x.id === group) ?? GROUPS[0];
  const shown = useMemo(
    () => list.filter((a) => (g.kinds.length === 0 || g.kinds.includes(a.kind)) && (showDismissed ? s.dismissed.includes(a.key) : !s.dismissed.includes(a.key))),
    [list, g, showDismissed, s.dismissed],
  );
  const count = (kinds: AlertKind[]) => list.filter((a) => !s.dismissed.includes(a.key) && (kinds.length === 0 || kinds.includes(a.kind))).length;

  const dismiss = (a: Alert) => {
    dispatch((d) => void d.dismissed.push(a.key));
    toast('Alert dismissed', { description: 'It returns automatically if the situation changes.', action: { label: 'Undo', onClick: () => dispatch((d) => void (d.dismissed = d.dismissed.filter((k) => k !== a.key))) } });
  };

  return (
    <div>
      <PageHeader eyebrow="Notification centre" title="Alerts" sub="Computed from live stock, expiry, sales and ledger records. Dismissing hides an alert until its underlying numbers change." />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {GROUPS.map((x) => (
          <button
            key={x.id}
            onClick={() => {
              if (x.id === 'all') params.delete('kind');
              else params.set('kind', x.id);
              setParams(params, { replace: true });
            }}
            className={cn('focus-ring inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition', group === x.id ? 'bg-ink text-white' : 'glass text-ink-2 hover:text-ink')}
          >
            {x.icon}
            {x.label}
            <span className={cn('num rounded-full px-1.5 text-[11px]', group === x.id ? 'bg-white/20' : 'bg-ink/[.06]')}>{count(x.kinds)}</span>
          </button>
        ))}
        <button onClick={() => setShowDismissed((v) => !v)} className="link ml-auto text-xs" aria-pressed={showDismissed}>
          {showDismissed ? 'Show active' : `Show dismissed (${s.dismissed.filter((k) => list.some((a) => a.key === k)).length})`}
        </button>
      </div>

      <Panel className="p-2 sm:p-3">
        {shown.length === 0 ? (
          <Empty icon={<CheckCircle2 size={22} />} title={showDismissed ? 'Nothing dismissed here' : 'All clear'}>
            {showDismissed ? 'Dismissed alerts in this group will appear here.' : 'No alerts in this group right now.'}
          </Empty>
        ) : (
          <ul className="divide-y hairline">
            {shown.map((a) => {
              const p = a.productId ? s.products.find((x) => x.id === a.productId) : undefined;
              return (
                <li key={a.key} className="flex flex-col gap-3 px-3 py-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className={cn('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full', a.severity === 'critical' ? 'bg-bad-soft text-bad' : a.severity === 'warning' ? 'bg-warn-soft text-warn' : 'bg-ink/[.05] text-ink-2')}>
                      {a.severity === 'critical' ? <AlertOctagon size={17} /> : a.severity === 'warning' ? <Clock3 size={17} /> : <Info size={17} />}
                    </span>
                    {p && <ProductThumb visual={p.visual} brand={p.brand} className="hidden sm:inline-grid" />}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{a.title}</span>
                        <span className="text-[11px] uppercase tracking-wider text-ink-3">{KIND_LABEL[a.kind]}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-ink-2">{a.detail}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2 pl-12 sm:pl-0">
                    <ButtonLink to={a.to} size="sm" variant={a.severity === 'critical' ? 'primary' : 'glass'}>{a.action} <ArrowRight size={13} /></ButtonLink>
                    {showDismissed ? (
                      <Button size="sm" variant="ghost" onClick={() => dispatch((d) => void (d.dismissed = d.dismissed.filter((k) => k !== a.key)))}><RotateCcw size={13} />Restore</Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => dismiss(a)} aria-label={`Dismiss: ${a.title}`}><BellOff size={13} />Dismiss</Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <p className="mt-4 text-xs text-ink-3">
        “AI prediction” alerts are estimates from recent sales speed. See <Link to="/insights" className="underline">AI Insights</Link> for the formulas.
      </p>
    </div>
  );
}
