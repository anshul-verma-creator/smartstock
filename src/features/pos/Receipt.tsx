import { createRoot } from 'react-dom/client';
import type { Business, Invoice } from '@/data/types';
import { fmtDate, fmtTime } from '@/lib/dates';
import { money, qty } from '@/lib/format';
import { cn } from '@/components/ui';

const METHOD: Record<string, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', bank: 'Bank' };

export interface ReceiptLine {
  name: string;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
  discount: number;
  gst: number;
}
export interface ReceiptModel {
  title: string;
  number?: string;
  date: string;
  ts?: string;
  customer?: string;
  lines: ReceiptLine[];
  gross: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  roundOff: number;
  total: number;
  payments: { method: string; amount: number }[];
  due: number;
  preview: boolean;
  voided?: boolean;
  cashier?: string;
}

export function invoiceToReceipt(inv: Invoice): ReceiptModel {
  return {
    title: 'TAX INVOICE', number: inv.number, date: inv.date, ts: inv.ts, customer: inv.customerName,
    lines: inv.lines.map((l) => ({ name: l.name, qty: l.qty, unit: l.unit, unitPrice: l.unitPrice, total: l.total, discount: l.lineDiscount + l.invoiceDiscountShare, gst: l.gst })),
    gross: inv.gross, discount: inv.discount, taxable: inv.taxable, cgst: inv.cgst, sgst: inv.sgst, igst: inv.igst, roundOff: inv.roundOff,
    total: inv.total, payments: inv.payments, due: inv.due, preview: false, voided: inv.status === 'voided', cashier: inv.cashier,
  };
}

/** Narrow thermal receipt (58–80 mm). Used for the live preview inside the printer and for printing. */
export function ThermalReceipt({ m, b, className }: { m: ReceiptModel; b: Business; className?: string }) {
  const rule = <div className="my-1.5 border-t border-dashed border-black/40" />;
  return (
    <div className={cn('relative bg-[#fdfdfb] px-3 py-3 font-mono text-[10.5px] leading-[1.45] text-[#1b1b1b]', className)}>
      {(m.preview || m.voided) && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden" aria-hidden>
          <span className="-rotate-[24deg] whitespace-nowrap text-[26px] font-bold tracking-widest text-black/[.07]">{m.voided ? 'VOID' : 'PREVIEW'}</span>
        </div>
      )}
      <div className="text-center">
        <div className="text-[12.5px] font-bold uppercase">{b.name}</div>
        <div>{b.address}, {b.city} {b.pincode}</div>
        <div>Ph {b.phone}</div>
        {b.gstRegistered && <div>GSTIN {b.gstin}</div>}
        <div className="mt-1 font-bold">{m.preview ? 'BILL PREVIEW — NOT SAVED' : b.gstRegistered ? m.title : 'BILL OF SUPPLY'}</div>
      </div>
      {rule}
      <div className="flex justify-between"><span>{m.number ?? 'Invoice no. on save'}</span><span>{fmtDate(m.date)}{m.ts ? ` ${fmtTime(m.ts)}` : ''}</span></div>
      {m.customer && <div>Customer: {m.customer}</div>}
      {rule}
      {m.lines.length === 0 && <div className="py-3 text-center text-black/50">Scan or tap items to begin</div>}
      {m.lines.map((l, i) => (
        <div key={i} className="mb-1">
          <div className="truncate">{l.name}</div>
          <div className="flex justify-between">
            <span>{qty(l.qty)} × {l.unitPrice.toFixed(2)}{l.gst ? ` · ${l.gst}%` : ''}</span>
            <span>{l.total.toFixed(2)}</span>
          </div>
          {l.discount > 0 && <div className="text-right text-black/60">discount −{l.discount.toFixed(2)}</div>}
        </div>
      ))}
      {rule}
      <Row l="Items value" r={m.gross.toFixed(2)} />
      {m.discount > 0 && <Row l="Discount" r={`−${m.discount.toFixed(2)}`} />}
      <Row l="Taxable value" r={m.taxable.toFixed(2)} />
      {m.cgst > 0 && <Row l="CGST" r={m.cgst.toFixed(2)} />}
      {m.sgst > 0 && <Row l="SGST" r={m.sgst.toFixed(2)} />}
      {m.igst > 0 && <Row l="IGST" r={m.igst.toFixed(2)} />}
      {m.roundOff !== 0 && <Row l="Round off" r={m.roundOff.toFixed(2)} />}
      <div className="mt-1 flex justify-between text-[13px] font-bold"><span>TOTAL</span><span>₹{m.total.toFixed(2)}</span></div>
      {m.payments.map((p, i) => <Row key={i} l={`Paid · ${METHOD[p.method] ?? p.method}`} r={p.amount.toFixed(2)} />)}
      {m.due > 0 && <Row l="Balance due (credit)" r={m.due.toFixed(2)} bold />}
      {rule}
      <div className="text-center">{b.footer}</div>
      {m.cashier && !m.preview && <div className="text-center text-black/50">Billed by {m.cashier}</div>}
      {b.isDemo && <div className="mt-1 text-center text-black/50">Demo data — not a real tax invoice</div>}
    </div>
  );
}
const Row = ({ l, r, bold }: { l: string; r: string; bold?: boolean }) => (
  <div className={cn('flex justify-between', bold && 'font-bold')}><span>{l}</span><span>{r}</span></div>
);

/** A4 tax invoice layout. */
export function A4Invoice({ inv, b }: { inv: Invoice; b: Business }) {
  return (
    <div className="bg-white p-10 text-[12px] text-[#111]" style={{ width: '190mm' }}>
      <div className="flex justify-between border-b border-black/20 pb-4">
        <div>
          <div className="text-[20px] font-semibold">{b.name}</div>
          <div>{b.address}, {b.city} {b.pincode}, {b.stateName} ({b.stateCode})</div>
          <div>Phone {b.phone}{b.gstRegistered ? ` · GSTIN ${b.gstin}` : ''}</div>
        </div>
        <div className="text-right">
          <div className="text-[18px] font-semibold">{b.gstRegistered ? 'Tax Invoice' : 'Bill of Supply'}</div>
          <div>No. <b>{inv.number}</b></div>
          <div>Date {fmtDate(inv.date)} {fmtTime(inv.ts)}</div>
          <div>Place of supply: {b.stateName} ({b.stateCode})</div>
          {inv.status === 'voided' && <div className="mt-1 font-bold text-red-700">VOIDED — {inv.voidReason}</div>}
        </div>
      </div>
      <div className="py-3">Bill to: <b>{inv.customerName ?? 'Walk-in customer'}</b></div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-black/30 text-left">
            {['#', 'Item', 'HSN', 'Qty', 'Rate', 'Disc.', 'Taxable', 'GST %', 'CGST', 'SGST', 'IGST', 'Total'].map((h) => <th key={h} className="px-1 py-1.5 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l, i) => (
            <tr key={i} className="border-b border-black/10">
              <td className="px-1 py-1">{i + 1}</td><td className="px-1">{l.name}</td><td className="px-1">{l.hsn ?? ''}</td>
              <td className="px-1">{qty(l.qty)} {l.unit}</td><td className="px-1">{l.unitPrice.toFixed(2)}</td><td className="px-1">{(l.lineDiscount + l.invoiceDiscountShare).toFixed(2)}</td>
              <td className="px-1">{l.taxable.toFixed(2)}</td><td className="px-1">{l.gst}</td><td className="px-1">{l.cgst.toFixed(2)}</td>
              <td className="px-1">{l.sgst.toFixed(2)}</td><td className="px-1">{l.igst.toFixed(2)}</td><td className="px-1 text-right">{l.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ml-auto mt-4 w-72 space-y-1">
        {[['Taxable value', inv.taxable], ['CGST', inv.cgst], ['SGST', inv.sgst], ['IGST', inv.igst], ['Round off', inv.roundOff]].map(([l, v]) => (
          <div key={l as string} className="flex justify-between"><span>{l}</span><span>{money(v as number)}</span></div>
        ))}
        <div className="flex justify-between border-t border-black/30 pt-1 text-[15px] font-semibold"><span>Invoice total</span><span>{money(inv.total)}</span></div>
        <div className="flex justify-between"><span>Paid</span><span>{money(inv.paid)}</span></div>
        {inv.due > 0 && <div className="flex justify-between font-semibold"><span>Balance due</span><span>{money(inv.due)}</span></div>}
      </div>
      <div className="mt-10 flex justify-between text-[11px] text-black/60">
        <span>{b.isDemo ? 'Demo data — not a real tax invoice.' : 'This is a computer-generated invoice.'}</span>
        <span>For {b.name} — Authorised signatory</span>
      </div>
    </div>
  );
}

/**
 * Opens the browser print dialog for a receipt or A4 invoice. Resolves when the dialog closes.
 * The browser cannot tell us whether paper actually came out, so callers must not claim "printed".
 */
export function printNode(node: React.ReactNode, kind: 'thermal' | 'a4'): Promise<void> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.className = 'print-root';
    document.body.appendChild(host);
    const style = document.createElement('style');
    style.textContent = kind === 'thermal' ? '@media print { @page { size: 80mm auto; margin: 3mm; } }' : '@media print { @page { size: A4; margin: 10mm; } }';
    document.head.appendChild(style);
    const root = createRoot(host);
    root.render(<div className={kind === 'thermal' ? 'w-[74mm]' : ''}>{node}</div>);
    document.body.classList.add('printing');
    const done = () => {
      window.removeEventListener('afterprint', done);
      document.body.classList.remove('printing');
      root.unmount();
      host.remove();
      style.remove();
      resolve();
    };
    window.addEventListener('afterprint', done);
    window.setTimeout(() => {
      window.print();
      // some browsers do not fire afterprint; clean up anyway
      window.setTimeout(() => document.body.classList.contains('printing') && done(), 1500);
    }, 60);
  });
}
