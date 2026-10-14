import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Logo } from '@/components/layout/AppShell';
import { Button, cn, Field, Input, Select } from '@/components/ui';
import { dispatch } from '@/data/store';

export const STATES: [string, string][] = [
  ['01', 'Jammu & Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'], ['04', 'Chandigarh'], ['05', 'Uttarakhand'], ['06', 'Haryana'], ['07', 'Delhi'], ['08', 'Rajasthan'],
  ['09', 'Uttar Pradesh'], ['10', 'Bihar'], ['18', 'Assam'], ['19', 'West Bengal'], ['20', 'Jharkhand'], ['21', 'Odisha'], ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'],
  ['24', 'Gujarat'], ['27', 'Maharashtra'], ['29', 'Karnataka'], ['30', 'Goa'], ['32', 'Kerala'], ['33', 'Tamil Nadu'], ['36', 'Telangana'], ['37', 'Andhra Pradesh'],
];

const STEPS = ['Business', 'Location & GST', 'Invoices & stock', 'Done'];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ name: '', type: 'kirana', owner: '', phone: '', address: '', city: '', state: '08', pincode: '', gst: 'n', gstin: '', prefix: 'INV', fy: '4', low: '10', warn: '7' });
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (f.name.trim().length < 2) e.name = 'Enter your shop’s name.';
      if (f.owner.trim().length < 2) e.owner = 'Enter the owner’s name.';
      if (!/^[6-9]\d{9}$/.test(f.phone.replace(/\D/g, ''))) e.phone = 'Enter a 10-digit mobile number.';
    }
    if (step === 1) {
      if (!f.city.trim()) e.city = 'Enter your city.';
      if (f.pincode && !/^[1-9]\d{5}$/.test(f.pincode)) e.pincode = 'PIN codes have 6 digits.';
      if (f.gst === 'y') {
        if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(f.gstin)) e.gstin = 'A GSTIN has 15 characters, like 08ABCDE1234F1Z5.';
        else if (f.gstin.slice(0, 2) !== f.state) e.gstin = 'The first two digits must match your state code.';
      }
    }
    if (step === 2 && !/^[A-Z0-9]{1,6}$/.test(f.prefix)) e.prefix = 'Use 1–6 capital letters or digits.';
    setErr(e);
    return Object.keys(e).length === 0;
  };
  const next = () => {
    if (!validate()) return;
    if (step === 2) {
      dispatch((d) => {
        d.business = { ...d.business, name: f.name.trim(), owner: f.owner.trim(), phone: f.phone, address: f.address, city: f.city, stateCode: f.state, stateName: STATES.find(([c]) => c === f.state)?.[1] ?? '', pincode: f.pincode, gstRegistered: f.gst === 'y', gstin: f.gst === 'y' ? f.gstin : undefined, invoicePrefix: f.prefix, expiryWarningDays: Number(f.warn) || 7 };
      });
    }
    setStep((x) => x + 1);
  };

  return (
    <div className="relative grid min-h-dvh place-items-center p-4">
      <div className="atmosphere" aria-hidden><i /><i /><i /></div>
      <div className="relative z-[1] w-full max-w-2xl">
        <Logo className="mb-8" />
        <ol className="mb-6 flex gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <div className={cn('h-1 rounded-full transition-colors', i <= step ? 'bg-brand' : 'bg-ink/10')} />
              <span className={cn('mt-2 block text-xs', i === step ? 'font-medium text-ink' : 'text-ink-3')} aria-current={i === step ? 'step' : undefined}>{s}</span>
            </li>
          ))}
        </ol>
        <div className="panel-read p-6 sm:p-8">
          {step === 0 && (
            <>
              <h1 className="text-[30px] font-extralight tracking-tight">Tell us about your shop</h1>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Shop name" error={err.name} className="sm:col-span-2" htmlFor="o-n"><Input id="o-n" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
                <Field label="Type of business" htmlFor="o-t"><Select id="o-t" value={f.type} onChange={(e) => set('type', e.target.value)}><option value="kirana">Kirana / general store</option><option value="grocery">Grocery / supermarket</option><option value="pharmacy">Pharmacy</option><option value="other">Other retail</option></Select></Field>
                <Field label="Owner name" error={err.owner} htmlFor="o-o"><Input id="o-o" value={f.owner} onChange={(e) => set('owner', e.target.value)} /></Field>
                <Field label="Mobile number" error={err.phone} htmlFor="o-p"><Input id="o-p" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="98290 12345" /></Field>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <h1 className="text-[30px] font-extralight tracking-tight">Where are you, and are you GST-registered?</h1>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Address" className="sm:col-span-2" htmlFor="o-a"><Input id="o-a" value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
                <Field label="City" error={err.city} htmlFor="o-c"><Input id="o-c" value={f.city} onChange={(e) => set('city', e.target.value)} /></Field>
                <Field label="PIN code" error={err.pincode} htmlFor="o-pin"><Input id="o-pin" inputMode="numeric" value={f.pincode} onChange={(e) => set('pincode', e.target.value)} /></Field>
                <Field label="State" hint="Used to decide CGST + SGST or IGST" htmlFor="o-s"><Select id="o-s" value={f.state} onChange={(e) => set('state', e.target.value)}>{STATES.map(([c, n]) => <option key={c} value={c}>{n} ({c})</option>)}</Select></Field>
                <Field label="GST registration" htmlFor="o-g"><Select id="o-g" value={f.gst} onChange={(e) => set('gst', e.target.value)}><option value="n">Not registered</option><option value="y">Registered</option></Select></Field>
                {f.gst === 'y' && <Field label="GSTIN" error={err.gstin} className="sm:col-span-2" htmlFor="o-gi"><Input id="o-gi" value={f.gstin} onChange={(e) => set('gstin', e.target.value.toUpperCase())} placeholder="08ABCDE1234F1Z5" /></Field>}
              </div>
              <p className="mt-4 text-xs text-ink-3">Not registered? You will issue a bill of supply without GST. A GSTIN is never required unless you are registered. SmartStock does not verify GSTINs with the government portal.</p>
            </>
          )}
          {step === 2 && (
            <>
              <h1 className="text-[30px] font-extralight tracking-tight">Invoices and stock alerts</h1>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Invoice prefix" error={err.prefix} hint={`Bills look like ${f.prefix || 'INV'}/2627/00001`} htmlFor="o-ip"><Input id="o-ip" value={f.prefix} onChange={(e) => set('prefix', e.target.value.toUpperCase())} /></Field>
                <Field label="Financial year starts" htmlFor="o-fy"><Select id="o-fy" value={f.fy} onChange={(e) => set('fy', e.target.value)}><option value="4">April (standard)</option><option value="1">January</option></Select></Field>
                <Field label="Default low-stock level" htmlFor="o-l"><Input id="o-l" type="number" min={0} value={f.low} onChange={(e) => set('low', e.target.value)} /></Field>
                <Field label="Warn me about expiry (days before)" htmlFor="o-w"><Input id="o-w" type="number" min={1} max={90} value={f.warn} onChange={(e) => set('warn', e.target.value)} /></Field>
                <Field label="Currency" htmlFor="o-cur"><Input id="o-cur" value="Indian Rupee (₹ INR)" readOnly /></Field>
              </div>
            </>
          )}
          {step === 3 && (
            <div className="py-6 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ok-soft text-ok"><Check size={26} /></div>
              <h1 className="mt-4 text-[30px] font-extralight tracking-tight">{f.name} is ready</h1>
              <p className="mx-auto mt-2 max-w-md text-ink-2">Your details are applied to the demo store preview so you can see your name on bills. Real business creation connects with the database in the next phase.</p>
              <Button variant="primary" size="lg" className="mt-6" onClick={() => { toast.success('Welcome to SmartStock AI'); navigate('/'); }}>Open dashboard <ArrowRight size={16} /></Button>
            </div>
          )}
          {step < 3 && (
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => (step ? setStep((x) => x - 1) : navigate('/welcome'))}><ArrowLeft size={15} />Back</Button>
              <Button variant="primary" onClick={next}>{step === 2 ? 'Finish setup' : 'Continue'} <ArrowRight size={15} /></Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
