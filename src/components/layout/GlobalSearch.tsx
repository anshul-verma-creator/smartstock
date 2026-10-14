import * as RDialog from '@radix-ui/react-dialog';
import { ReceiptText, Search, Truck, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProductThumb } from '@/components/brand/ProductVisual';
import { useAppData } from '@/data/store';
import { money } from '@/lib/format';
import { fmtDate } from '@/lib/dates';
import { cn } from '@/components/ui';

interface Hit {
  key: string;
  group: string;
  title: string;
  sub: string;
  to: string;
  icon: React.ReactNode;
}

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const s = useAppData();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const hits = useMemo<Hit[]>(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const out: Hit[] = [];
    s.products
      .filter((p) => p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t) || p.barcode?.includes(t) || p.brand?.toLowerCase().includes(t))
      .slice(0, 6)
      .forEach((p) => out.push({ key: p.id, group: 'Products', title: p.name, sub: `${p.sku}${p.barcode ? ` · ${p.barcode}` : ''}`, to: `/products/${p.id}`, icon: <ProductThumb visual={p.visual} brand={p.brand} className="h-8 w-8" /> }));
    s.invoices
      .filter((i) => i.number.toLowerCase().includes(t) || i.customerName?.toLowerCase().includes(t))
      .slice(-5)
      .reverse()
      .forEach((i) => out.push({ key: i.id, group: 'Invoices', title: i.number, sub: `${fmtDate(i.date)} · ${money(i.total)}${i.customerName ? ` · ${i.customerName}` : ''}`, to: `/sales/${i.id}`, icon: <ReceiptText size={16} /> }));
    s.customers
      .filter((c) => c.name.toLowerCase().includes(t) || c.phone.replace(/\s/g, '').includes(t.replace(/\s/g, '')))
      .slice(0, 4)
      .forEach((c) => out.push({ key: c.id, group: 'Customers', title: c.name, sub: c.phone, to: `/customers/${c.id}`, icon: <User size={16} /> }));
    s.suppliers
      .filter((x) => x.name.toLowerCase().includes(t))
      .slice(0, 3)
      .forEach((x) => out.push({ key: x.id, group: 'Suppliers', title: x.name, sub: x.contact, to: `/suppliers/${x.id}`, icon: <Truck size={16} /> }));
    return out;
  }, [q, s]);

  const go = (h: Hit) => {
    onOpenChange(false);
    setQ('');
    navigate(h.to);
  };

  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-[rgba(242,241,237,.55)] backdrop-blur-[6px]" />
        <RDialog.Content className="glass-strong fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-24px)] max-w-xl -translate-x-1/2 rounded-[24px] shadow-lift focus:outline-none">
          <RDialog.Title className="sr-only">Search</RDialog.Title>
          <RDialog.Description className="sr-only">Search products, SKUs, barcodes, invoices, customers and suppliers</RDialog.Description>
          <div className="flex items-center gap-3 border-b px-5 hairline">
            <Search size={18} className="text-ink-2" />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, hits.length - 1));
                if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
                if (e.key === 'Enter' && hits[active]) go(hits[active]);
              }}
              placeholder="Search products, SKU, barcode, invoice, customer…"
              className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
              aria-label="Search"
            />
            <kbd className="rounded-md border border-ink/10 px-1.5 text-[10px] text-ink-3">Esc</kbd>
          </div>
          <div className="max-h-[56vh] overflow-y-auto p-2" role="listbox">
            {!q && <p className="px-4 py-8 text-center text-sm text-ink-2">Try “milk”, “SKS/”, “Ramesh” or scan a barcode.</p>}
            {q && hits.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-2">No matches for “{q}”.</p>}
            {hits.map((h, i) => (
              <div key={h.key}>
                {(i === 0 || hits[i - 1].group !== h.group) && <p className="eyebrow px-3 pb-1 pt-3">{h.group}</p>}
                <button
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(h)}
                  className={cn('flex w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left', i === active && 'bg-white/90')}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-white/80 text-ink-2">{h.icon}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{h.title}</span>
                    <span className="block truncate text-xs text-ink-2">{h.sub}</span>
                  </span>
                </button>
              </div>
            ))}
          </div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
