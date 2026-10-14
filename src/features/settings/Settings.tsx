import { Database, RotateCcw, ShieldCheck, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Field, Input, Panel, PanelHeader, Select } from '@/components/ui';
import { PageHeader } from '@/components/layout/AppShell';
import { dispatch, resetDemo, useAppData } from '@/data/store';
import type { Business, Role } from '@/data/types';

const ROLES: { r: Role; what: string }[] = [
  { r: 'owner', what: 'Everything, including settings, team and demo reset' },
  { r: 'manager', what: 'Billing, voids, discount approval, stock, purchases, reports' },
  { r: 'cashier', what: 'Billing, sales history, customers and repayments (discount limit applies)' },
  { r: 'inventory', what: 'Products, stock moves, purchases, suppliers, rescue requests' },
];

export default function Settings() {
  const s = useAppData();
  const [b, setB] = useState<Business>(s.business);
  const [err, setErr] = useState<Record<string, string>>({});
  const owner = s.role === 'owner';
  const set = <K extends keyof Business>(k: K, v: Business[K]) => setB((x) => ({ ...x, [k]: v }));
  const save = () => {
    const e: Record<string, string> = {};
    if (b.name.trim().length < 2) e.name = 'Enter the business name.';
    if (b.gstRegistered && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(b.gstin ?? '')) e.gstin = 'GSTIN has 15 characters, e.g. 08ABCDE1234F1Z5.';
    if (b.gstRegistered && b.gstin && b.gstin.slice(0, 2) !== b.stateCode) e.gstin = 'The first two digits must match your state code.';
    if (!/^[A-Z0-9]{1,6}$/.test(b.invoicePrefix)) e.prefix = 'Use 1–6 capital letters or digits.';
    setErr(e);
    if (Object.keys(e).length) return;
    dispatch((d) => void (d.business = { ...b, gstin: b.gstRegistered ? b.gstin : undefined }));
    toast.success('Settings saved', { description: 'New invoices use these details; saved invoices keep their original snapshot.' });
  };
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Settings" title="Business settings" sub={owner ? 'Changes apply to new bills only. Past invoices are never rewritten.' : 'Only the owner can change settings. You can view them.'} actions={owner ? <Button variant="primary" onClick={save}>Save changes</Button> : <Badge>Read only</Badge>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Business" />
          <fieldset disabled={!owner} className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name" error={err.name} className="sm:col-span-2" htmlFor="st-n"><Input id="st-n" value={b.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Owner" htmlFor="st-o"><Input id="st-o" value={b.owner} onChange={(e) => set('owner', e.target.value)} /></Field>
            <Field label="Phone" htmlFor="st-p"><Input id="st-p" value={b.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Address" className="sm:col-span-2" htmlFor="st-a"><Input id="st-a" value={b.address} onChange={(e) => set('address', e.target.value)} /></Field>
            <Field label="City" htmlFor="st-c"><Input id="st-c" value={b.city} onChange={(e) => set('city', e.target.value)} /></Field>
            <Field label="PIN code" htmlFor="st-pin"><Input id="st-pin" value={b.pincode} onChange={(e) => set('pincode', e.target.value)} /></Field>
          </fieldset>
        </Panel>
        <Panel>
          <PanelHeader title="GST & invoices" sub="Rates are configured per product. Assumptions need review by a tax professional." />
          <fieldset disabled={!owner} className="grid gap-4 sm:grid-cols-2">
            <Field label="GST registration" htmlFor="st-g"><Select id="st-g" value={b.gstRegistered ? 'y' : 'n'} onChange={(e) => set('gstRegistered', e.target.value === 'y')}><option value="y">Registered (tax invoice)</option><option value="n">Not registered (bill of supply)</option></Select></Field>
            <Field label="GSTIN" error={err.gstin} htmlFor="st-gi"><Input id="st-gi" value={b.gstin ?? ''} disabled={!b.gstRegistered} onChange={(e) => set('gstin', e.target.value.toUpperCase())} /></Field>
            <Field label="State" htmlFor="st-s"><Input id="st-s" value={`${b.stateName} (${b.stateCode})`} readOnly /></Field>
            <Field label="Invoice prefix" error={err.prefix} hint="e.g. SKS/2627/00001" htmlFor="st-ip"><Input id="st-ip" value={b.invoicePrefix} onChange={(e) => set('invoicePrefix', e.target.value.toUpperCase())} /></Field>
            <Field label="Round invoice totals to ₹1" htmlFor="st-r"><Select id="st-r" value={b.roundOff ? 'y' : 'n'} onChange={(e) => set('roundOff', e.target.value === 'y')}><option value="y">Yes</option><option value="n">No</option></Select></Field>
            <Field label="Receipt footer" htmlFor="st-f"><Input id="st-f" value={b.footer} onChange={(e) => set('footer', e.target.value)} /></Field>
          </fieldset>
        </Panel>
        <Panel>
          <PanelHeader title="Stock rules" />
          <fieldset disabled={!owner} className="grid gap-4 sm:grid-cols-2">
            <Field label="Expiry warning window (days)" htmlFor="st-e"><Input id="st-e" type="number" min={1} max={90} value={b.expiryWarningDays} onChange={(e) => set('expiryWarningDays', Number(e.target.value))} /></Field>
            <Field label="Expired stock at the counter" htmlFor="st-b"><Select id="st-b" value={b.blockExpiredSales ? 'y' : 'n'} onChange={(e) => set('blockExpiredSales', e.target.value === 'y')}><option value="y">Block sale (recommended)</option><option value="n">Allow (not recommended)</option></Select></Field>
            <Field label="Cashier discount limit (%)" htmlFor="st-d"><Input id="st-d" type="number" min={0} max={100} value={b.cashierMaxDiscountPct} onChange={(e) => set('cashierMaxDiscountPct', Number(e.target.value))} /></Field>
          </fieldset>
        </Panel>
        <Panel>
          <PanelHeader title="Team roles" sub="Switch role from the account menu to preview each permission set" action={<Users size={18} className="text-ink-2" />} />
          <ul className="space-y-2 text-sm">
            {ROLES.map((x) => (
              <li key={x.r} className="flex items-start justify-between gap-3 rounded-[14px] bg-white/55 px-3 py-2.5">
                <span><span className="font-medium capitalize">{x.r}</span><span className="block text-xs text-ink-2">{x.what}</span></span>
                {s.role === x.r && <Badge tone="brand">You</Badge>}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel id="about">
        <PanelHeader title="What is real vs demo" action={<ShieldCheck size={18} className="text-ink-2" />} />
        <div className="grid gap-4 text-sm text-ink-2 md:grid-cols-2">
          <div>
            <p className="font-medium text-ink">Working in this preview</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Billing with FEFO batch allocation, GST engine, split/credit payments and duplicate-click protection</li>
              <li>Stock ledger, transfers, write-offs, purchases, voids, customer and supplier balances</li>
              <li>Forecasts, expiry risk, reorder, alerts, stock rescue, monthly records and CSV exports</li>
              <li>Browser printing (80 mm receipt and A4 invoice), barcode scanning via camera, USB scanner or typing</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-ink">Not connected yet</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>This preview stores data in this browser only (demo store, {s.business.name}). The Supabase database, sign-in and row-level security are prepared in <code>supabase/migrations</code> but not wired to this UI.</li>
              <li>No UPI/card processing, GST filing, GSTIN verification, marketplace or silent printer integration.</li>
            </ul>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-4 hairline">
          <Database size={16} className="text-ink-2" />
          <span className="text-sm text-ink-2">Demo records are separate from real business data and can be rebuilt at any time.</span>
          <Button className="ml-auto" disabled={!owner} onClick={() => { resetDemo(); toast('Demo store rebuilt'); }}><RotateCcw size={15} />Reset demo data</Button>
        </div>
      </Panel>
    </div>
  );
}
