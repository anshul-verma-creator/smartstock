import { ClipboardList, PackageCheck, Plus, Send, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button, ButtonLink, Empty, Panel, Stat, TabPanel, Tabs } from '@/components/ui';
import { PageHeader } from '@/components/layout/AppShell';
import { productViews } from '@/data/derived';
import { purchaseDue, uid } from '@/data/engine';
import { dispatch, useAppData } from '@/data/store';
import { addDays, fmtDate } from '@/lib/dates';
import { money, money0, qty } from '@/lib/format';

export default function Purchases() {
  const s = useAppData();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'bills';
  const [limit, setLimit] = useState(25);
  const bills = [...s.purchases].sort((a, b) => b.date.localeCompare(a.date));
  const orders = [...s.orders].sort((a, b) => b.createdOn.localeCompare(a.createdOn));
  const month = s.anchor.slice(0, 7);

  const draftFromSuggestions = () => {
    const need = productViews(s).filter((v) => v.reorder.needed && !s.orders.some((o) => o.status === 'draft' && o.items.some((i) => i.productId === v.product.id)));
    if (!need.length) return toast('Nothing new to order', { description: 'Every product that needs reordering is already on a draft.' });
    const bySup = new Map<string, typeof need>();
    need.forEach((v) => bySup.set(v.product.supplierId, [...(bySup.get(v.product.supplierId) ?? []), v]));
    dispatch((d) => {
      bySup.forEach((list, sup) => {
        d.seq.po += 1;
        const lead = d.suppliers.find((x) => x.id === sup)?.leadTimeDays ?? 2;
        d.orders.push({ id: uid('po'), number: `PO-${String(d.seq.po).padStart(4, '0')}`, supplierId: sup, status: 'draft', createdOn: d.anchor, expected: addDays(d.anchor, lead), note: 'Drafted from reorder suggestions', items: list.map((v) => ({ productId: v.product.id, qty: v.reorder.quantity, unitCost: v.product.cost, reason: v.reorder.reason })) });
      });
    });
    toast.success(`${bySup.size} draft order${bySup.size > 1 ? 's' : ''} created`, { description: 'Review and send them to suppliers yourself — nothing is sent automatically.' });
    params.set('tab', 'orders');
    setParams(params);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Purchasing"
        title="Purchases & orders"
        sub="Bills you receive add stock. Purchase orders are drafts you send to suppliers — they change nothing until goods are received."
        actions={
          <>
            <Button onClick={draftFromSuggestions}><Sparkles size={15} />Draft from reorder suggestions</Button>
            <ButtonLink to="/purchases/new" variant="primary"><Plus size={15} />Record purchase</ButtonLink>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Panel className="p-4"><Stat label="Purchases this month" value={money0(s.purchases.filter((p) => p.date.startsWith(month)).reduce((a, p) => a + p.total, 0))} /></Panel>
        <Panel className="p-4"><Stat label="Bills with dues" value={s.purchases.filter((p) => purchaseDue(p) > 0).length} /></Panel>
        <Panel className="p-4"><Stat label="Draft orders" value={s.orders.filter((o) => o.status === 'draft').length} /></Panel>
        <Panel className="p-4"><Stat label="Awaiting delivery" value={s.orders.filter((o) => o.status === 'ordered').length} /></Panel>
      </div>
      <Panel className="p-2 sm:p-4">
        <Tabs value={tab} onValueChange={(v) => { params.set('tab', v); setParams(params, { replace: true }); }} tabs={[{ value: 'bills', label: 'Purchase bills' }, { value: 'orders', label: 'Purchase orders' }]}>
          <TabPanel value="bills">
            <div className="-mx-1 overflow-x-auto">
              <table className="table-base min-w-[720px]">
                <thead><tr><th>Bill</th><th>Date</th><th>Supplier</th><th className="text-right">Items</th><th className="text-right">Taxable</th><th className="text-right">GST</th><th className="text-right">Total</th><th>Payment</th></tr></thead>
                <tbody>
                  {bills.slice(0, limit).map((p) => (
                    <tr key={p.id}>
                      <td className="font-mono text-xs">{p.billNumber}</td>
                      <td className="text-ink-2">{fmtDate(p.date)}</td>
                      <td><Link to={`/suppliers/${p.supplierId}`} className="hover:underline">{s.suppliers.find((x) => x.id === p.supplierId)?.name}</Link></td>
                      <td className="num text-right">{p.lines.length}</td>
                      <td className="num text-right">{money(p.taxable)}</td>
                      <td className="num text-right text-ink-2">{money(p.tax)}</td>
                      <td className="num text-right font-medium">{money(p.total)}</td>
                      <td>{purchaseDue(p) <= 0 ? <Badge tone="ok">Paid</Badge> : p.paid > 0 ? <Badge tone="warn">{money0(purchaseDue(p))} due</Badge> : <Badge tone="bad">Unpaid</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {limit < bills.length && <div className="p-3 text-center"><Button size="sm" onClick={() => setLimit((l) => l + 50)}>Load more</Button></div>}
          </TabPanel>
          <TabPanel value="orders">
            {orders.length === 0 ? (
              <Empty icon={<ClipboardList size={20} />} title="No purchase orders" action={<Button onClick={draftFromSuggestions}>Draft from suggestions</Button>} />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {orders.map((o) => {
                  const sup = s.suppliers.find((x) => x.id === o.supplierId);
                  const value = o.items.reduce((a, i) => a + i.qty * i.unitCost, 0);
                  return (
                    <div key={o.id} className="rounded-[20px] bg-white/55 p-4 ring-1 ring-black/[.03]">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-mono text-sm font-medium">{o.number}</div>
                          <div className="text-xs text-ink-2">{sup?.name} · created {fmtDate(o.createdOn)} · expected {fmtDate(o.expected)}</div>
                        </div>
                        <Badge tone={o.status === 'draft' ? 'warn' : o.status === 'ordered' ? 'info' : o.status === 'received' ? 'ok' : 'neutral'} dot>{o.status === 'ordered' ? 'Sent to supplier' : o.status}</Badge>
                      </div>
                      <ul className="mt-3 space-y-1 text-sm">
                        {o.items.map((i) => {
                          const p = s.products.find((x) => x.id === i.productId)!;
                          return <li key={i.productId} className="flex justify-between gap-2"><span className="truncate">{p.name}</span><span className="num text-ink-2">{qty(i.qty)} × {money(i.unitCost)}</span></li>;
                        })}
                      </ul>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 hairline">
                        <span className="num text-sm">≈ {money0(value)} <span className="text-xs text-ink-3">excl. GST</span></span>
                        <div className="flex gap-1.5">
                          {o.status === 'draft' && <Button size="sm" onClick={() => { dispatch((d) => void (d.orders.find((x) => x.id === o.id)!.status = 'ordered')); toast('Marked as sent', { description: `Share ${o.number} with ${sup?.name} by phone or WhatsApp — SmartStock does not send it.` }); }}><Send size={13} />Mark sent</Button>}
                          {(o.status === 'draft' || o.status === 'ordered') && <Button size="sm" variant="primary" onClick={() => navigate(`/purchases/new?po=${o.id}`)}><PackageCheck size={13} />Receive</Button>}
                          {(o.status === 'draft' || o.status === 'ordered') && <Button size="sm" variant="ghost" onClick={() => dispatch((d) => void (d.orders.find((x) => x.id === o.id)!.status = 'cancelled'))} aria-label={`Cancel ${o.number}`}><X size={13} /></Button>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabPanel>
        </Tabs>
      </Panel>
    </div>
  );
}
