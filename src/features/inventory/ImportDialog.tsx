import { CheckCircle2, FileSpreadsheet, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button, Dialog, Select } from '@/components/ui';
import { uid } from '@/data/engine';
import { dispatch, useAppData } from '@/data/store';
import type { Product, Unit } from '@/data/types';
import { downloadCSV, parseCSV } from '@/lib/csv';

const FIELDS = [
  { key: 'name', label: 'Product name', required: true },
  { key: 'sku', label: 'SKU', required: true },
  { key: 'price', label: 'Selling price', required: true },
  { key: 'cost', label: 'Purchase cost' },
  { key: 'gst', label: 'GST %' },
  { key: 'barcode', label: 'Barcode' },
  { key: 'category', label: 'Category' },
  { key: 'brand', label: 'Brand' },
  { key: 'unit', label: 'Unit' },
  { key: 'min', label: 'Minimum stock' },
] as const;
type Key = (typeof FIELDS)[number]['key'];
const UNITS: Unit[] = ['pcs', 'pack', 'box', 'strip', 'bottle', 'dozen', 'kg', 'g', 'l', 'ml'];

/** CSV product import: column mapping → validated preview → commit only valid rows. */
export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const s = useAppData();
  const [rows, setRows] = useState<string[][]>([]);
  const [map, setMap] = useState<Record<Key, number>>({} as Record<Key, number>);
  const [name, setName] = useState('');
  const header = rows[0] ?? [];
  const body = rows.slice(1);

  const load = async (f: File) => {
    const r = parseCSV(await f.text());
    setRows(r);
    setName(f.name);
    const m = {} as Record<Key, number>;
    FIELDS.forEach((fl) => {
      const i = (r[0] ?? []).findIndex((h) => h.toLowerCase().replace(/[^a-z]/g, '').includes(fl.key === 'min' ? 'min' : fl.key) || h.toLowerCase().includes(fl.label.toLowerCase()));
      m[fl.key] = i;
    });
    setMap(m);
  };

  const checked = useMemo(() => {
    const seenSku = new Set(s.products.map((p) => p.sku.toLowerCase()));
    const seenBar = new Set(s.products.map((p) => p.barcode).filter(Boolean));
    return body.map((r) => {
      const get = (k: Key) => (map[k] >= 0 ? (r[map[k]] ?? '').trim() : '');
      const errs: string[] = [];
      const price = Number(get('price'));
      const cost = get('cost') ? Number(get('cost')) : 0;
      const gst = get('gst') ? Number(get('gst')) : 0;
      const unit = (get('unit') || 'pcs').toLowerCase() as Unit;
      if (!get('name')) errs.push('name missing');
      if (!get('sku')) errs.push('SKU missing');
      else if (seenSku.has(get('sku').toLowerCase())) errs.push('duplicate SKU');
      if (!(price > 0)) errs.push('invalid price');
      if (Number.isNaN(cost) || cost < 0) errs.push('invalid cost');
      if (![0, 0.25, 3, 5, 12, 18, 28, 40].includes(gst)) errs.push('GST must be 0/5/12/18/28/40');
      if (!UNITS.includes(unit)) errs.push(`unknown unit "${unit}"`);
      const bc = get('barcode');
      if (bc && (!/^[0-9A-Za-z-]{4,32}$/.test(bc) || seenBar.has(bc))) errs.push(seenBar.has(bc) ? 'duplicate barcode' : 'invalid barcode');
      if (!errs.length) {
        seenSku.add(get('sku').toLowerCase());
        if (bc) seenBar.add(bc);
      }
      const p: Product = {
        id: `prd_${uid('i')}`, sku: get('sku').toUpperCase(), name: get('name'), brand: get('brand') || undefined, category: get('category') || 'Uncategorised',
        unit, cost, price, mrp: price, gst, includesTax: true, barcode: bc || undefined, minStock: Number(get('min')) || 0, supplierId: s.suppliers[0].id,
        locationId: s.locations.find((l) => l.kind === 'shelf')!.id, trackBatches: false, trackExpiry: false,
        visual: { shape: 'packet', color: '#E9B44C', accent: '#FFFFFF', label: get('name').split(' ')[0] ?? '' }, status: 'active',
      };
      return { p, errs };
    });
  }, [body, map, s]);
  const ok = checked.filter((c) => !c.errs.length);

  return (
    <Dialog
      wide
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setRows([]);
      }}
      title="Import products from CSV"
      description="Map your columns, check the preview, then import. Rows with problems are skipped and listed."
      footer={
        <>
          <Button variant="ghost" onClick={() => downloadCSV('smartstock-products-template.csv', ['name', 'sku', 'price', 'cost', 'gst', 'barcode', 'category', 'brand', 'unit', 'min'], [['Tata Salt 1kg', 'TATA-SALT1-B', '28', '22', '0', '', 'Staples', 'Tata', 'pcs', '15']])}>Download template</Button>
          <Button
            variant="primary"
            disabled={!ok.length}
            onClick={() => {
              dispatch((d) => void d.products.push(...ok.map((c) => c.p)));
              toast.success(`Imported ${ok.length} product${ok.length > 1 ? 's' : ''}`, { description: checked.length - ok.length ? `${checked.length - ok.length} rows skipped` : 'Add opening stock from each product page.' });
              setRows([]);
              onOpenChange(false);
            }}
          >
            Import {ok.length || ''} valid row{ok.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      {!rows.length ? (
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-[20px] border-2 border-dashed border-ink/10 bg-white/40 px-6 py-12 text-center hover:bg-white/70">
          <FileSpreadsheet size={28} className="text-ink-2" />
          <span className="font-medium">Choose a .csv file</span>
          <span className="text-sm text-ink-2">Needs at least name, SKU and selling price columns.</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
        </label>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-2">{name} · {body.length} rows</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((f) => (
              <label key={f.key} className="flex flex-col gap-1 text-xs text-ink-2">
                {f.label}{'required' in f && ' *'}
                <Select value={map[f.key] ?? -1} onChange={(e) => setMap((m) => ({ ...m, [f.key]: Number(e.target.value) }))} className="h-9">
                  <option value={-1}>— not in file —</option>
                  {header.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </Select>
              </label>
            ))}
          </div>
          <div className="max-h-64 overflow-auto rounded-[16px] bg-white/55">
            <table className="table-base">
              <thead><tr><th /><th>Name</th><th>SKU</th><th className="text-right">Price</th><th>Issues</th></tr></thead>
              <tbody>
                {checked.slice(0, 100).map((c, i) => (
                  <tr key={i}>
                    <td>{c.errs.length ? <XCircle size={15} className="text-bad" aria-label="Invalid" /> : <CheckCircle2 size={15} className="text-ok" aria-label="Valid" />}</td>
                    <td>{c.p.name || '—'}</td><td className="font-mono text-xs">{c.p.sku || '—'}</td><td className="num text-right">{c.p.price || '—'}</td>
                    <td className="text-xs text-bad">{c.errs.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Dialog>
  );
}
