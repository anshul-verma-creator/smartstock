import * as Popover from '@radix-ui/react-popover';
import {
  Bell, BookOpen, ChevronDown, ClipboardList, FileText, LayoutGrid, Menu as MenuIcon, Package, Plus, ReceiptText, RotateCcw,
  ScanLine, Search, Settings, ShoppingCart, Sparkles, Truck, Users, Wallet, X, LifeBuoy, AlertTriangle, TrendingUp, LogOut,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { activeAlerts } from '@/data/derived';
import { dispatch, resetDemo, useAppData, useSelect } from '@/data/store';
import type { Role } from '@/data/types';
import { ButtonLink, cn, Menu } from '@/components/ui';
import { GlobalSearch } from './GlobalSearch';
import { ScannerDialog } from '@/features/scanner/ScannerDialog';

export const PRIMARY_NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/alerts', label: 'Alerts', icon: AlertTriangle },
  { to: '/insights', label: 'AI Insights', icon: Sparkles },
  { to: '/profit', label: 'Profit', icon: TrendingUp },
  { to: '/rescue', label: 'Stock Rescue', icon: LifeBuoy },
  { to: '/suppliers', label: 'Suppliers', icon: Truck },
];
export const MORE_NAV = [
  { to: '/sales', label: 'Sales history', icon: ReceiptText },
  { to: '/purchases', label: 'Purchases & orders', icon: ClipboardList },
  { to: '/customers', label: 'Customers & dues', icon: Users },
  { to: '/reports', label: 'Monthly records', icon: BookOpen },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', manager: 'Manager', cashier: 'Cashier', inventory: 'Inventory staff' };

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('focus-ring flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg text-[17px] font-semibold tracking-tight', className)} aria-label="SmartStock AI home">
      <svg viewBox="0 0 64 64" className="h-7 w-7" aria-hidden>
        <rect width="64" height="64" rx="18" fill="#171717" />
        <path d="M18 38l14 8 14-8V24l-14-8-14 8z" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinejoin="round" />
        <path d="M18 24l14 8 14-8M32 32v14" fill="none" stroke="#FF8A00" strokeWidth="3.4" strokeLinejoin="round" />
      </svg>
      <span>
        SmartStock <span className="text-brand">AI</span>
      </span>
    </Link>
  );
}

function NotificationsBell() {
  const list = useSelect(activeAlerts);
  const navigate = useNavigate();
  const critical = list.filter((a) => a.severity === 'critical').length;
  return (
    <Popover.Root>
      <Popover.Trigger className="focus-ring relative grid h-10 w-10 place-items-center rounded-full text-ink-2 transition hover:bg-white/70 hover:text-ink" aria-label={`Notifications, ${list.length} active`}>
        <Bell size={19} />
        {list.length > 0 && (
          <span className={cn('absolute right-1.5 top-1.5 grid min-w-[17px] place-items-center rounded-full px-1 text-[10px] font-semibold leading-[17px]', critical ? 'bg-brand text-ink' : 'bg-ink/80 text-white')}>
            {list.length > 99 ? '99+' : list.length}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={10} className="glass-strong z-50 w-[min(92vw,380px)] rounded-[22px] p-2 shadow-lift">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-sm font-medium">Notifications</p>
            <span className="text-xs text-ink-2">{list.length} active</span>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {list.slice(0, 7).map((a) => (
              <li key={a.key}>
                <Popover.Close asChild>
                  <button onClick={() => navigate(a.to)} className="focus-ring flex w-full gap-3 rounded-[14px] px-3 py-2.5 text-left transition hover:bg-white/80">
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', a.severity === 'critical' ? 'bg-bad' : a.severity === 'warning' ? 'bg-brand' : 'bg-ink-3')} aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{a.title}</span>
                      <span className="line-clamp-2 block text-xs text-ink-2">{a.detail}</span>
                    </span>
                  </button>
                </Popover.Close>
              </li>
            ))}
            {list.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-2">All clear. Nothing needs attention.</li>}
          </ul>
          <Popover.Close asChild>
            <Link to="/alerts" className="focus-ring mt-1 block rounded-[14px] px-3 py-2.5 text-center text-sm font-medium text-brand-ink hover:bg-white/70">
              Open notification centre
            </Link>
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function AccountMenu() {
  const s = useAppData();
  const navigate = useNavigate();
  const setRole = (r: Role) => {
    dispatch((d) => void (d.role = r));
    toast.success(`Viewing as ${ROLE_LABEL[r]}`, { description: 'Demo role switch — permissions are enforced on every action.' });
  };
  return (
    <Menu
      trigger={
        <button className="focus-ring flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-white/70" aria-label="Account menu">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#2a2a2e] to-[#4a4a50] text-xs font-semibold text-white ring-2 ring-white">
            {s.business.owner.split(' ').map((w) => w[0]).join('').slice(0, 2)}
          </span>
          <span className="hidden text-left leading-tight 2xl:block">
            <span className="block text-xs font-medium">{s.business.owner.split(' ')[0]}</span>
            <span className="block text-[10.5px] text-ink-2">{ROLE_LABEL[s.role]}</span>
          </span>
          <ChevronDown size={14} className="hidden text-ink-2 2xl:block" />
        </button>
      }
      items={[
        ...MORE_NAV.map((n) => ({ label: n.label, icon: <n.icon size={15} />, onSelect: () => navigate(n.to) })),
        'sep' as const,
        ...(['owner', 'manager', 'cashier', 'inventory'] as Role[]).map((r) => ({
          label: <span className="flex w-full justify-between gap-4">View as {ROLE_LABEL[r]} {s.role === r && <span className="text-brand-ink">●</span>}</span>,
          onSelect: () => setRole(r),
        })),
        'sep' as const,
        { label: 'Reset demo data', icon: <RotateCcw size={15} />, onSelect: () => { resetDemo(); toast('Demo store rebuilt from scratch'); } },
        { label: 'Sign out', icon: <LogOut size={15} />, onSelect: () => navigate('/welcome') },
      ]}
    />
  );
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const loc = useLocation();
  useEffect(() => onClose(), [loc.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
      <button className="absolute inset-0 bg-[rgba(242,241,237,.6)] backdrop-blur-sm" onClick={onClose} aria-label="Close navigation" />
      <nav className="glass-strong animate-rise absolute inset-x-3 top-3 rounded-[26px] p-3 shadow-lift">
        <div className="flex items-center justify-between px-2 pb-2">
          <Logo />
          <button onClick={onClose} className="focus-ring rounded-full p-2 text-ink-2 hover:bg-white/80" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {[...PRIMARY_NAV, ...MORE_NAV].map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={'end' in n}
              className={({ isActive }) => cn('focus-ring flex items-center gap-2.5 rounded-[16px] px-3 py-3 text-sm font-medium', isActive ? 'bg-white text-ink shadow-glass' : 'text-ink-2 hover:bg-white/60')}
            >
              <n.icon size={17} />
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function TopNav({ onSearch, onScan }: { onSearch: () => void; onScan: () => void }) {
  const [drawer, setDrawer] = useState(false);
  return (
    <>
      <header className="no-print sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
        <div className="glass mx-auto flex h-[60px] max-w-[1400px] items-center gap-2 rounded-[22px] pl-4 pr-2 sm:pl-5">
          <Logo className="mr-2" />
          <nav aria-label="Primary" className="mx-auto hidden items-center gap-0.5 xl:flex">
            {PRIMARY_NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn('focus-ring relative whitespace-nowrap rounded-full px-3 py-2 text-[13.5px] font-medium transition-colors 2xl:px-3.5', isActive ? 'bg-white/90 text-ink shadow-[0_2px_10px_-4px_rgba(0,0,0,.15)]' : 'text-ink-2 hover:text-ink')
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-0.5 xl:ml-0">
            <button onClick={onSearch} className="focus-ring hidden h-10 items-center gap-2 rounded-full px-3 text-sm text-ink-2 transition hover:bg-white/70 hover:text-ink md:flex" aria-label="Search (Ctrl+K)">
              <Search size={17} />
              <kbd className="hidden rounded-md border border-ink/10 px-1.5 text-[10px] font-medium text-ink-3 2xl:inline">Ctrl K</kbd>
            </button>
            <button onClick={onSearch} className="focus-ring grid h-10 w-10 place-items-center rounded-full text-ink-2 hover:bg-white/70 md:hidden" aria-label="Search">
              <Search size={18} />
            </button>
            <button onClick={onScan} className="focus-ring hidden h-10 w-10 place-items-center rounded-full text-ink-2 transition hover:bg-white/70 hover:text-ink sm:grid" aria-label="Scan barcode">
              <ScanLine size={18} />
            </button>
            <NotificationsBell />
            <ButtonLink to="/pos" variant="primary" size="sm" className="mx-1 hidden h-9 sm:inline-flex">
              <Plus size={15} /> New bill
            </ButtonLink>
            <div className="hidden sm:block">
              <AccountMenu />
            </div>
            <button onClick={() => setDrawer(true)} className="focus-ring grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-white/70 xl:hidden" aria-label="Open navigation">
              <MenuIcon size={20} />
            </button>
          </div>
        </div>
      </header>
      <MobileDrawer open={drawer} onClose={() => setDrawer(false)} />
    </>
  );
}

export function AppShell() {
  const [search, setSearch] = useState(false);
  const [scan, setScan] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearch(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!loc.hash) window.scrollTo({ top: 0 });
  }, [loc.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="relative min-h-dvh">
      <div className="atmosphere" aria-hidden><i /><i /><i /></div>
      <a href="#main" className="focus-ring sr-only z-50 rounded-lg bg-white px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <TopNav onSearch={() => setSearch(true)} onScan={() => setScan(true)} />
      <main id="main" className="relative z-[1] mx-auto max-w-[1400px] px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      {loc.pathname !== '/pos' && (
        <Link to="/pos" className="no-print focus-ring fixed bottom-5 right-5 z-30 flex h-14 items-center gap-2 rounded-full bg-brand px-5 font-semibold text-ink shadow-[0_14px_30px_-10px_rgba(255,138,0,.8)] sm:hidden" aria-label="New bill">
          <ShoppingCart size={19} /> New bill
        </Link>
      )}
      <GlobalSearch open={search} onOpenChange={setSearch} />
      <ScannerDialog open={scan} onOpenChange={setScan} />
      <DemoFooter />
    </div>
  );
}

function DemoFooter() {
  const s = useAppData();
  return (
    <footer className="no-print relative z-[1] mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-4 pb-8 text-xs text-ink-3 sm:px-8">
      <span className="flex items-center gap-2">
        <span className="font-semibold text-ink">SmartStock <span className="text-brand">AI</span></span> · Demo data · {s.business.name}
      </span>
      <span className="flex items-center gap-1.5">
        <Wallet size={12} /> Inventory management, powered by explainable AI <FileText size={12} className="ml-2" />
        <Link to="/settings#about" className="underline-offset-2 hover:underline">What is real vs demo?</Link>
      </span>
    </footer>
  );
}

export function PageHeader({ eyebrow, title, sub, actions, className }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('animate-rise mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="h-page">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-[15px] text-ink-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
