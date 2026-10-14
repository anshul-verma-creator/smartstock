import { Download, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Panel, Select, Stat, TabPanel, Tabs } from '@/components/ui';
import { PageHeader } from '@/components/layout/AppShell';
import { collections, periodSales, rescueStats } from '@/data/derived';
import { useAppData } from '@/data/store';
import type { AppData } from '@/data/types';
import { downloadCSV } from '@/lib/csv';
import { fmtDate, fmtMonth, monthRange } from '@/lib/dates';
import { money, money0, qty } from '@/lib/format';
import { printNode } from '@/features/pos/Receipt';

function reconcile(s: AppData, from: string, to: string) {
  const m = new Map<string, { opening: number; purchased: number; sold: number; returns: number; pret: number; adj: number; wo: number; closing: number; ov: number; cv: number }>();
  for (const mv of s.movements) {
    const r = m.get(mv.productId) ?? { opening: 0, purchased: 0, sold: 0, returns: 0, pret: 0, adj: 0, wo: 0, closing: 0, ov: 0, cv: 0 };
    if (mv.date < from) {
      r.opening += mv.qty;
      r.ov += mv.qty * mv.unitCost;
    }
    if (mv.date <= to) {
      r.closing += mv.qty;
      r.cv += mv.qty * mv.unitCost;
    }
    if (mv.date >= from && mv.date <= to) {
      if (mv.type === 'purchase') r.purchased += mv.qty;
      else if (mv.type === 'sale') r.sold -= mv.qty;
      else if (mv.type === 'void_reversal') r.returns += mv.qty;
      else if (mv.type === 'purchase_return') r.pret -= mv.qty;
      else if (mv.type === 'adjustment' || mv.type === 'opening') r.adj += mv.qty;
      else if (mv.type === 'write_off' || mv.type === 'rescue_out') r.wo -= mv.qty;
    }
    m.set(mv.productId, r);
  }
  const round = (x: number) => Math.round(x * 1000) / 1000;
  return [...m.entries()].map(([id, r]) => {
    const p = s.products.find((x) => x.id === id)!;
    const expected = round(r.opening + r.purchased + r.returns - r.sold - r.pret + r.adj - r.wo);
    return { p, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, round(v)])) as typeof r, ok: Math.abs(expected - round(r.closing)) < 0.001 };
  }).sort((a, b) => a.p.name.localeCompare(b.p.name));
}

export default function Reports() {
  const s = useAppData();
  const months = useMemo(() => [...new Set(s.invoices.map((i) => i.date.slice(0, 7)))].sort().reverse(), [s]);
  const [month, setMonth] = useState(s.anchor.slice(0, 7));
  const [tab, setTab] = useState('overview');
  const r = monthRange(month);
  const to = r.to > s.anchor ? s.anchor : r.to;
  const sales = periodSales(s, r.from, to);
  const voided = s.invoices.filter((i) => i.status === 'voided' && i.date >= r.from && i.date <= to);
  const col = collections(s, r.from, to);
  const resc = rescueStats(s, r.from, to);
  const purchases = s.purchases.filter((p) => p.date >= r.from && p.date <= to);
  const recon = useMemo(() => reconcile(s, r.from, to), [s, r.from, to]);
  const ov = recon.reduce((a, x) => a + x.ov, 0);
  const cv = recon.reduce((a, x) => a + x.cv, 0);
  const dues = s.invoices.filter((i) => i.status === 'posted').reduce((a, i) => a + i.due, 0);
  const tax = useMemo(() => {
    const m = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number; total: number; lines: number }>();
    for (const i of sales.list)
      for (const l of i.lines) {
        const x = m.get(l.gst) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0, lines: 0 };
        x.taxable += l.taxable; x.cgst += l.cgst; x.sgst += l.sgst; x.igst += l.igst; x.total += l.total; x.lines += 1;
        m.set(l.gst, x);
      }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [sales.list]);
  const inputTax = purchases.reduce((a, p) => a + p.tax, 0);
  const meta = [`${s.business.name} · GSTIN ${s.business.gstin ?? 'not registered'}`, `Period ${fmtDate(r.from)} – ${fmtDate(to)} (business dates, Asia/Kolkata)`, `Generated ${new Date().toLocaleString('en-IN')}`, 'Demo data'];

  const overview = [
    ['Gross sales (before discounts, incl. GST)', sales.gross], ['Discounts', sales.discount], ['Net sales (incl. GST)', sales.total], ['Net sales (excl. GST)', sales.revenue], ['GST collected', sales.tax],
    ['Invoices', sales.invoices], ['Voided invoices (excluded above)', voided.length], ['Collected — cash', col.cash], ['Collected — UPI', col.upi], ['Collected — card', col.card], ['Collected — bank', col.bank],
    ['of which customer repayments', col.repayments], ['Refunds paid', col.refunds], ['Credit given on new sales', sales.credit], ['Customer dues outstanding (today)', dues],
    ['Purchases (incl. GST)', purchases.reduce((a, p) => a + p.total, 0)], ['Supplier payments', col.supplier], ['Estimated gross profit', sales.profit],
    ['Opening stock value (cost)', ov], ['Closing stock value (cost)', cv], ['Write-offs & donations (units)', recon.reduce((a, x) => a + x.wo, 0)], ['Recovered by stock rescue', resc.total],
  ] as [string, number][];

  const printStatement = () =>
    printNode(
      <div className="bg-white p-8 text-[12px]" style={{ width: '190mm' }}>
        <h1 className="text-xl font-semibold">Monthly statement — {fmtMonth(month)}</h1>
        {meta.map((m) => <p key={m} className="text-black/60">{m}</p>)}
        <table className="mt-4 w-full">
          <tbody>{overview.map(([l, v]) => <tr key={l} className="border-b border-black/10"><td className="py-1">{l}</td><td className="text-right">{l.includes('Invoices') || l.includes('units') ? qty(v) : money(v)}</td></tr>)}</tbody>
        </table>
        <h2 className="mt-6 font-semibold">GST summary (outward supplies)</h2>
        <table className="mt-2 w-full"><thead><tr className="border-b border-black/30 text-left"><th>Rate</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th></tr></thead>
          <tbody>{tax.map(([rate, x]) => <tr key={rate}><td>{rate}%</td><td>{money(x.taxable)}</td><td>{money(x.cgst)}</td><td>{money(x.sgst)}</td><td>{money(x.igst)}</td></tr>)}</tbody></table>
      </div>,
      'a4',
    );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Monthly records"
        title={fmtMonth(month)}
        sub="Sales, collections, dues, purchases and stock kept separate — never mixed into one misleading profit number."
        actions={
          <>
            <Select value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" aria-label="Month">{months.map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}</Select>
            <Button onClick={printStatement}><Printer size={15} />A4 statement</Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Panel className="p-4"><Stat label="Net sales (incl. GST)" value={money0(sales.total)} /></Panel>
        <Panel className="p-4"><Stat label="Collected" value={money0(col.cash + col.upi + col.card + col.bank)} /></Panel>
        <Panel className="p-4"><Stat label="Purchases" value={money0(purchases.reduce((a, p) => a + p.total, 0))} /></Panel>
        <Panel className="p-4"><Stat label="Estimated gross profit" value={money0(sales.profit)} /></Panel>
      </div>
      <Panel className="p-2 sm:p-4">
        <Tabs value={tab} onValueChange={setTab} tabs={[{ value: 'overview', label: 'Overview' }, { value: 'stock', label: 'Stock reconciliation' }, { value: 'registers', label: 'Registers' }, { value: 'tax', label: 'Tax summary' }]}>
          <TabPanel value="overview">
            <div className="flex justify-end px-2"><Button size="sm" onClick={() => downloadCSV(`monthly-overview-${month}.csv`, ['Measure', 'Value'], overview.map(([l, v]) => [l, v.toFixed(2)]), meta)}><Download size={14} />CSV</Button></div>
            <dl className="grid gap-x-10 px-2 md:grid-cols-2">
              {overview.map(([l, v]) => (
                <div key={l} className="flex justify-between border-b py-2.5 text-sm hairline">
                  <dt className="text-ink-2">{l}</dt><dd className="num font-medium">{l.includes('Invoices') || l.includes('units') ? qty(v) : money(v)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 px-2 text-xs text-ink-3">Net sales exclude voided invoices. Collections include repayments of earlier credit and are not new sales. Gross profit = net sales excl. GST − batch cost of goods sold; expenses are not deducted.</p>
          </TabPanel>
          <TabPanel value="stock">
            <div className="flex flex-wrap items-center justify-between gap-2 px-2">
              <p className="text-xs text-ink-2">Closing = Opening + Purchased + Sales returns − Sold − Purchase returns + Adjustments − Write-offs</p>
              <Button size="sm" onClick={() => downloadCSV(`stock-reconciliation-${month}.csv`, ['Product', 'SKU', 'Opening', 'Purchased', 'Sales returns', 'Sold', 'Purchase returns', 'Adjustments', 'Write-offs', 'Closing', 'Opening value', 'Closing value', 'Reconciles'], recon.map((x) => [x.p.name, x.p.sku, x.opening, x.purchased, x.returns, x.sold, x.pret, x.adj, x.wo, x.closing, x.ov.toFixed(2), x.cv.toFixed(2), x.ok ? 'yes' : 'NO']), meta)}><Download size={14} />CSV</Button>
            </div>
            <div className="-mx-1 mt-2 overflow-x-auto">
              <table className="table-base min-w-[960px]">
                <thead><tr><th>Product</th><th className="text-right">Opening</th><th className="text-right">+ Purchased</th><th className="text-right">+ Returns</th><th className="text-right">− Sold</th><th className="text-right">− Supplier ret.</th><th className="text-right">± Adjust</th><th className="text-right">− Write-off</th><th className="text-right">Closing</th><th className="text-right">Closing value</th><th /></tr></thead>
                <tbody>
                  {recon.map((x) => (
                    <tr key={x.p.id}>
                      <td><Link to={`/products/${x.p.id}`} className="font-medium hover:underline">{x.p.name}</Link></td>
                      {[x.opening, x.purchased, x.returns, x.sold, x.pret, x.adj, x.wo, x.closing].map((v, i) => <td key={i} className={`num text-right ${i === 7 ? 'font-medium' : 'text-ink-2'}`}>{qty(v)}</td>)}
                      <td className="num text-right">{money0(x.cv)}</td>
                      <td>{x.ok ? <Badge tone="ok">✓</Badge> : <Badge tone="bad">Check</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="font-medium"><td className="px-3 py-3">Stock value</td><td colSpan={8} className="px-3 text-right text-xs text-ink-2">opening {money0(ov)}</td><td className="num px-3 text-right">{money0(cv)}</td><td /></tr></tfoot>
              </table>
            </div>
          </TabPanel>
          <TabPanel value="registers">
            <div className="grid gap-4 px-2 md:grid-cols-2">
              {[
                { t: 'Sales invoices', n: sales.invoices + voided.length, f: () => downloadCSV(`sales-register-${month}.csv`, ['Invoice', 'Date', 'Customer', 'Status', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'Paid at sale', 'Due'], s.invoices.filter((i) => i.date >= r.from && i.date <= to).map((i) => [i.number, i.date, i.customerName ?? 'Walk-in', i.status, i.taxable, i.cgst, i.sgst, i.igst, i.total, i.payments.reduce((a, p) => a + p.amount, 0), i.due]), meta), to: '/sales' },
                { t: 'Purchases', n: purchases.length, f: () => downloadCSV(`purchase-register-${month}.csv`, ['Bill', 'Date', 'Supplier', 'Taxable', 'GST', 'Total', 'Paid'], purchases.map((p) => [p.billNumber, p.date, s.suppliers.find((x) => x.id === p.supplierId)?.name, p.taxable, p.tax, p.total, p.paid]), meta), to: '/purchases' },
                { t: 'Customer receipts', n: s.payments.filter((p) => p.direction === 'in' && p.date >= r.from && p.date <= to).length, f: () => downloadCSV(`receipts-${month}.csv`, ['Date', 'Kind', 'Method', 'Amount', 'Customer', 'Reference'], s.payments.filter((p) => p.direction === 'in' && p.date >= r.from && p.date <= to).map((p) => [p.date, p.kind, p.method, p.amount, s.customers.find((c) => c.id === p.customerId)?.name ?? 'Walk-in', p.reference ?? '']), meta), to: '/customers' },
                { t: 'Supplier payments', n: s.payments.filter((p) => p.kind === 'supplier_payment' && p.date >= r.from && p.date <= to).length, f: () => downloadCSV(`supplier-payments-${month}.csv`, ['Date', 'Supplier', 'Method', 'Amount', 'Reference'], s.payments.filter((p) => p.kind === 'supplier_payment' && p.date >= r.from && p.date <= to).map((p) => [p.date, s.suppliers.find((x) => x.id === p.supplierId)?.name, p.method, p.amount, p.reference ?? '']), meta), to: '/suppliers' },
                { t: 'Stock movements', n: s.movements.filter((m) => m.date >= r.from && m.date <= to).length, f: () => downloadCSV(`stock-movements-${month}.csv`, ['Date', 'Product', 'Type', 'Qty', 'Unit cost', 'Note'], s.movements.filter((m) => m.date >= r.from && m.date <= to).map((m) => [m.date, s.products.find((p) => p.id === m.productId)?.name, m.type, m.qty, m.unitCost, m.note]), meta), to: '/inventory/activity' },
                { t: 'Expiry write-offs & rescues', n: s.rescues.filter((x) => x.confirmedOn && x.confirmedOn >= r.from && x.confirmedOn <= to).length, f: () => downloadCSV(`rescue-register-${month}.csv`, ['Date', 'Product', 'Type', 'Units', 'Recovered'], s.rescues.filter((x) => x.confirmedOn && x.confirmedOn >= r.from && x.confirmedOn <= to).map((x) => [x.confirmedOn, s.products.find((p) => p.id === x.productId)?.name, x.type, x.confirmedQty, x.recovered]), meta), to: '/rescue' },
              ].map((x) => (
                <div key={x.t} className="flex items-center justify-between rounded-[18px] bg-white/55 p-4 ring-1 ring-black/[.03]">
                  <div><Link to={x.to} className="font-medium hover:underline">{x.t}</Link><div className="num text-xs text-ink-2">{x.n} records in {fmtMonth(month)}</div></div>
                  <Button size="sm" onClick={x.f}><Download size={14} />CSV</Button>
                </div>
              ))}
            </div>
          </TabPanel>
          <TabPanel value="tax">
            <div className="flex justify-end px-2"><Button size="sm" onClick={() => downloadCSV(`gst-summary-${month}.csv`, ['GST rate', 'Line items', 'Taxable value', 'CGST', 'SGST', 'IGST', 'Invoice value'], tax.map(([rate, x]) => [rate, x.lines, x.taxable.toFixed(2), x.cgst.toFixed(2), x.sgst.toFixed(2), x.igst.toFixed(2), x.total.toFixed(2)]), meta)}><Download size={14} />CSV</Button></div>
            <div className="-mx-1 overflow-x-auto">
              <table className="table-base min-w-[640px]">
                <thead><tr><th>GST rate</th><th className="text-right">Lines</th><th className="text-right">Taxable value</th><th className="text-right">CGST</th><th className="text-right">SGST</th><th className="text-right">IGST</th><th className="text-right">Invoice value</th></tr></thead>
                <tbody>
                  {tax.map(([rate, x]) => <tr key={rate}><td>{rate}%</td><td className="num text-right">{x.lines}</td><td className="num text-right">{money(x.taxable)}</td><td className="num text-right">{money(x.cgst)}</td><td className="num text-right">{money(x.sgst)}</td><td className="num text-right">{money(x.igst)}</td><td className="num text-right">{money(x.total)}</td></tr>)}
                </tbody>
                <tfoot><tr className="font-medium"><td className="px-3 py-3">Total</td><td /><td className="num px-3 text-right">{money(sales.revenue)}</td><td className="num px-3 text-right">{money(tax.reduce((a, [, x]) => a + x.cgst, 0))}</td><td className="num px-3 text-right">{money(tax.reduce((a, [, x]) => a + x.sgst, 0))}</td><td className="num px-3 text-right">{money(tax.reduce((a, [, x]) => a + x.igst, 0))}</td><td className="num px-3 text-right">{money(sales.total - sales.list.reduce((a, i) => a + i.roundOff, 0))}</td></tr></tfoot>
              </table>
            </div>
            <p className="mt-3 px-2 text-sm text-ink-2">Input GST on purchases this month: <span className="num font-medium text-ink">{money(inputTax)}</span></p>
            <p className="mt-1 px-2 text-xs text-ink-3">Totals reconcile with the stored tax on each invoice line. This summary supports return preparation; it is not a GST filing and does not verify GSTINs. Have rates and treatment reviewed by your CA.</p>
          </TabPanel>
        </Tabs>
      </Panel>
    </div>
  );
}
