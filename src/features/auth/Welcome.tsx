import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StoreBackdrop } from '@/components/brand/IsometricStore';
import { ProductVisual } from '@/components/brand/ProductVisual';
import { Logo } from '@/components/layout/AppShell';
import { Button, Field, Input, Segmented } from '@/components/ui';

export default function Welcome() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (mode === 'signup' && name.trim().length < 2) x.name = 'Enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(email)) x.email = 'Enter a valid email address.';
    if (pw.length < 8) x.pw = 'Use at least 8 characters.';
    setErr(x);
    if (Object.keys(x).length) return;
    navigate(mode === 'signup' ? '/onboarding' : '/');
  };
  return (
    <div className="relative grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="atmosphere" aria-hidden><i /><i /><i /></div>
      <section className="relative hidden overflow-hidden lg:block" aria-hidden>
        <StoreBackdrop className="absolute -left-[38%] top-10 w-[150%] max-w-none" />
        <div className="absolute bottom-16 left-16 right-16">
          <div className="glass flex items-center gap-4 rounded-[24px] p-5">
            <ProductVisual visual={{ shape: 'carton', color: '#2F7BD8', accent: '#FFFFFF', label: 'Taaza', image: '/assets/products/amul-taaza-1l.webp' }} brand="Amul" className="h-20 w-14" />
            <div>
              <p className="text-sm font-medium">“Sell batch BPL2610A first — 12 days left.”</p>
              <p className="text-xs text-ink-2">SmartStock tells you what to sell, reorder and rescue each morning.</p>
            </div>
          </div>
        </div>
      </section>
      <section className="relative z-[1] flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <Logo className="mb-10" />
          <h1 className="text-[40px] font-extralight leading-[1.05] tracking-[-0.02em]">{mode === 'signin' ? 'Welcome back' : 'Run your shop smarter'}</h1>
          <p className="mt-2 text-ink-2">Billing, stock, expiry and profit for Indian retailers — in one calm place.</p>
          <div className="panel-read mt-8 p-6">
            <Segmented label="Account" value={mode} onChange={setMode} options={[{ value: 'signin', label: 'Sign in' }, { value: 'signup', label: 'Create account' }]} className="mb-5 w-full [&>button]:flex-1" />
            <form onSubmit={submit} className="space-y-4" noValidate>
              {mode === 'signup' && <Field label="Your name" error={err.name} htmlFor="w-n"><Input id="w-n" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>}
              <Field label="Email" error={err.email} htmlFor="w-e"><Input id="w-e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
              <Field label="Password" error={err.pw} htmlFor="w-p">
                <div className="relative">
                  <Input id="w-p" type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} className="pr-10" />
                  <button type="button" onClick={() => setShow((x) => !x)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-2 hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </Field>
              <Button type="submit" variant="primary" size="lg" className="w-full">{mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight size={16} /></Button>
            </form>
            <div className="my-5 flex items-center gap-3 text-xs text-ink-3"><span className="h-px flex-1 bg-[var(--line)]" />or<span className="h-px flex-1 bg-[var(--line)]" /></div>
            <Link to="/" className="focus-ring block rounded-[14px] bg-ink px-4 py-3 text-center text-sm font-semibold text-white hover:bg-black">Explore the demo store</Link>
          </div>
          <p className="mt-5 flex items-start gap-2 text-xs text-ink-3">
            <ShieldCheck size={14} className="mt-0.5 shrink-0" />
            Preview build: sign-in is not connected yet, so these forms only validate and continue to the demo. Supabase Auth is prepared in the project for the next phase.
          </p>
        </div>
      </section>
    </div>
  );
}
