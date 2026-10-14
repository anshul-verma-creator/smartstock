import { ArrowLeft, Ban, FileText, Printer } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button, ButtonLink, Dialog, Empty, Field, Panel, PanelHeader, Textarea } from '@/components/ui';
import { voidInvoice } from '@/data/engine';
import { dispatch, useAppData } from '@/data/store';
import { fmtDate, fmtTime } from '@/lib/dates';
import { money, qty } from '@/lib/format';
import { run } from '@/features/product/dialogs';
import { A4Invoice, invoiceToReceipt, printNode, ThermalReceipt } from '@/features/pos/Receipt';

export default function InvoiceView() {
  const { id = '' } = useParams();
  const s = useAppData();
  const inv = s.invoices.find((i) => i.id === id);
  const [voidOpen, setVoidOpen] = useState(false);
  const [reason, setReason] = useState('');
  if (!inv) return <Panel><Empty title="Invoice not found" action={<ButtonLink to="/sales">Sales history</ButtonLink>} /></Panel>;
  const canVoid = s.role === 'owner' || s.role === 'manager';
  const later = s.payments.filter((p) => p.kind === 'customer_repayment' && p.customerId === inv.customerId && p.ts > inv.ts);
  const print = async (kind: 'thermal' | 'a4') => {
    await printNode(kind === 'thermal' ? <ThermalReceipt m={invoiceToReceipt(inv)} b={s.business} /> : <A4Invoice inv={inv} b={s.business} />, kind);
    toast('Print dialog closed', { description: 'Reprinting never changes the saved invoice.' });
  };
  return (
    <div className="space-y-6">
      <Link to="/sales" className="link text-xs"><ArrowLeft size={13} />Sales history</Link>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">{s.business.gstRegistered ? 'Tax invoice' : 'Bill of supply'}</p>
          <h1 className="font-mono text-[30px] font-light tracking-tight sm:text-[38px]">{inv.number}</h1>
          <p className="mt-1 text-ink-2">{fmtDate(inv.date)} · {fmtTime(inv.ts)} · {inv.customerName ?? 'Walk-in customer'} · billed by {inv.cashier}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => print('thermal')}><Printer size={15} />Receipt (80 mm)</Button>
          <Button onClick={() => print('a4')}><FileText size={15} />A4 invoice</Button>
          {inv.status === 'posted' && <Button variant="danger" disabled={!canVoid} title={canVoid ? undefined : 'Only an owner or manager can void'} onClick={() => setVoidOpen(true)}><Ban size={15} />Void</Button>}
        </div>
      </div>
      {inv.status === 'voided' && <div className="rounded-[18px] bg-bad-soft px-4 py-3 text-sm text-bad">Voided — {inv.voidReason}. Stock was returned and payments refunded with reversing entries; the original values are preserved below.</div>}
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Panel read className="p-3 sm:p-5">
          <PanelHeader title="Line items" sub={`${inv.supplyType === 'intra' ? 'Intra-state supply · CGST + SGST' : 'Inter-state supply · IGST'}`} className="px-1" />
          <div className="-mx-1 overflow-x-auto">
            <table className="table-base min-w-[720px]">
              <thead><tr><th>Item</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Discount</th><th className="text-right">Taxable</th><th className="text-right">GST</th><th className="text-right">Total</th><th>Batch</th></tr></thead>
              <tbody>
                {inv.lines.map((l, i) => (
                  <tr key={i}>
                    <td><Link to={`/products/${l.productId}`} className="font-medium hover:underline">{l.name}</Link>{l.rescueEventId && <Badge tone="brand" className="ml-2">Rescue</Badge>}<div className="text-[11px] text-ink-3">HSN {l.hsn ?? '—'} · {l.includesTax ? 'price incl. GST' : 'price + GST'}</div></td>
                    <td className="num text-right">{qty(l.qty)} {l.unit}</td>
                    <td className="num text-right">{money(l.unitPrice)}</td>
                    <td className="num text-right">{l.lineDiscount + l.invoiceDiscountShare ? money(l.lineDiscount + l.invoiceDiscountShare) : '—'}</td>
                    <td className="num text-right">{money(l.taxable)}</td>
                    <td className="num text-right text-ink-2">{l.gst}% · {money(l.cgst + l.sgst + l.igst)}</td>
                    <td className="num text-right font-medium">{money(l.total)}</td>
                    <td className="font-mono text-[11px] text-ink-2">{l.batches.map((b) => `${b.code}×${qty(b.qty)}`).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
            {[['Items value', inv.gross], ['Discounts', -inv.discount], ['Taxable value', inv.taxable], ['CGST', inv.cgst], ['SGST', inv.sgst], ['IGST', inv.igst], ['Round off', inv.roundOff]].filter(([, v]) => v !== 0).map(([l, v]) => (
              <div key={l as string} className="flex justify-between"><span className="text-ink-2">{l}</span><span className="num">{money(v as number)}</span></div>
            ))}
            <div className="flex justify-between border-t pt-2 text-lg hairline"><span>Total</span><span className="num font-medium">{money(inv.total)}</span></div>
            {inv.payments.map((p, i) => <div key={i} className="flex justify-between text-ink-2"><span>Paid · {p.method.toUpperCase()}{p.reference ? ` (${p.reference})` : ''}</span><span className="num">{money(p.amount)}</span></div>)}
            {inv.paid > inv.payments.reduce((a, p) => a + p.amount, 0) && <div className="flex justify-between text-ink-2"><span>Settled later from dues</span><span className="num">{money(inv.paid - inv.payments.reduce((a, p) => a + p.amount, 0))}</span></div>}
            {inv.due > 0 && <div className="flex justify-between font-medium text-warn"><span>Balance due</span><span className="num">{money(inv.due)}</span></div>}
          </div>
          {s.role !== 'cashier' && <p className="mt-4 text-xs text-ink-3">Cost of goods (batch cost): {money(inv.cost)} · gross profit {money(inv.taxable - inv.cost)}</p>}
          {later.length > 0 && inv.customerId && <p className="mt-1 text-xs text-ink-3"><Link to={`/customers/${inv.customerId}`} className="underline">Customer ledger</Link> shows later repayments.</p>}
        </Panel>
        <div>
          <p className="mb-2 text-xs font-medium text-ink-2">Receipt as printed</p>
          <div className="overflow-hidden rounded-[16px] shadow-[0_12px_30px_-14px_rgba(0,0,0,.3)]"><ThermalReceipt m={invoiceToReceipt(inv)} b={s.business} /></div>
        </div>
      </div>
      <Dialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        title={`Void ${inv.number}?`}
        description="The invoice stays on record as voided. Stock returns to the original batches and paid amounts are recorded as refunds."
        footer={
          <>
            <Button variant="ghost" onClick={() => setVoidOpen(false)}>Keep invoice</Button>
            <Button variant="danger" onClick={() => run(() => dispatch((d) => voidInvoice(d, inv.id, reason, d.anchor, new Date().toISOString())), 'Invoice voided', 'Reversing entries recorded.') && setVoidOpen(false)}>Void invoice</Button>
          </>
        }
      >
        <Field label="Reason (required)" htmlFor="void-r"><Textarea id="void-r" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer returned all items, billed twice by mistake" /></Field>
      </Dialog>
    </div>
  );
}
