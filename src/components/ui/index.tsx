import * as RDialog from '@radix-ui/react-dialog';
import * as RMenu from '@radix-ui/react-dropdown-menu';
import * as RTabs from '@radix-ui/react-tabs';
import { clsx, type ClassValue } from 'clsx';
import { X } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { twMerge } from 'tailwind-merge';

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));

// ───────────── Button ─────────────
type Variant = 'primary' | 'glass' | 'ghost' | 'danger' | 'dark';
type Size = 'sm' | 'md' | 'lg' | 'icon';
const variants: Record<Variant, string> = {
  primary:
    'bg-brand text-ink shadow-[0_8px_20px_-8px_rgba(255,138,0,.65),inset_0_1px_0_rgba(255,255,255,.35)] hover:bg-brand-strong hover:-translate-y-px active:translate-y-0',
  glass: 'glass text-ink hover:bg-white/80 hover:-translate-y-px active:translate-y-0',
  ghost: 'text-ink-2 hover:text-ink hover:bg-white/60',
  danger: 'bg-bad text-white hover:brightness-110',
  dark: 'bg-ink text-white hover:bg-black shadow-[0_8px_20px_-10px_rgba(0,0,0,.5)]',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs rounded-[12px] gap-1.5',
  md: 'h-10 px-4 text-sm rounded-[14px] gap-2',
  lg: 'h-12 px-6 text-[15px] rounded-[16px] gap-2',
  icon: 'h-10 w-10 rounded-[14px] justify-center',
};
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'glass', size = 'md', loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'focus-ring inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-semibold transition-all duration-200 ease-soft disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
});

export function ButtonLink({ variant = 'glass', size = 'md', className, ...rest }: LinkProps & { variant?: Variant; size?: Size }) {
  return (
    <Link
      className={cn('focus-ring inline-flex shrink-0 items-center justify-center whitespace-nowrap font-semibold transition-all duration-200 ease-soft', variants[variant], sizes[size], className)}
      {...rest}
    />
  );
}

// ───────────── Panel ─────────────
export function Panel({ className, children, read, as: As = 'section', ...rest }: { className?: string; children: ReactNode; read?: boolean; as?: 'section' | 'div' | 'article' } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={cn(read ? 'panel-read' : 'panel', 'p-5 sm:p-6', className)} {...rest}>
      {children}
    </As>
  );
}

export function PanelHeader({ title, sub, action, className }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-medium text-ink">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-ink-2">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

// ───────────── Badge ─────────────
type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'brand' | 'info';
const tones: Record<Tone, string> = {
  neutral: 'bg-ink/[.05] text-ink-2',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  brand: 'bg-brand-soft text-brand-ink',
  info: 'bg-[rgba(59,111,201,.1)] text-[#2d5aa6]',
};
export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-medium', tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

// ───────────── Form fields ─────────────
const fieldBase =
  'w-full rounded-[14px] border border-white/80 bg-white/65 px-3.5 text-sm text-ink shadow-[inset_0_1px_2px_rgba(23,23,23,.04)] placeholder:text-ink-3 transition focus:border-brand/50 focus:bg-white/90 focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(fieldBase, 'h-10', className)} {...rest} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(fieldBase, 'h-10 appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%236b6b70%27 stroke-width=%272%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")] bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-8', className)} {...rest}>
      {children}
    </select>
  );
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, 'min-h-[80px] py-2.5', className)} {...rest} />;
});

export function Field({ label, hint, error, children, className, htmlFor }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-bad" role="alert">{error}</p> : hint ? <p className="text-xs text-ink-3">{hint}</p> : null}
    </div>
  );
}

// ───────────── Dialog ─────────────
export function Dialog({ open, onOpenChange, title, description, children, footer, wide }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-[rgba(242,241,237,.55)] backdrop-blur-[6px] data-[state=open]:animate-[rise_.2s_ease]" />
        <RDialog.Content
          className={cn(
            'glass-strong fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[26px] shadow-lift focus:outline-none',
            wide ? 'max-w-3xl' : 'max-w-lg',
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
            <div>
              <RDialog.Title className="text-lg font-medium tracking-tight">{title}</RDialog.Title>
              {description ? <RDialog.Description className="mt-1 text-sm text-ink-2">{description}</RDialog.Description> : <RDialog.Description className="sr-only">{title}</RDialog.Description>}
            </div>
            <RDialog.Close className="focus-ring -mr-2 -mt-1 rounded-full p-2 text-ink-2 hover:bg-white/70 hover:text-ink" aria-label="Close">
              <X size={18} />
            </RDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t px-6 py-4 hairline">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

// ───────────── Tabs ─────────────
export function Tabs({ tabs, value, onValueChange, className, children }: { tabs: { value: string; label: ReactNode }[]; value: string; onValueChange: (v: string) => void; className?: string; children: ReactNode }) {
  return (
    <RTabs.Root value={value} onValueChange={onValueChange} className={className}>
      <RTabs.List className="no-scrollbar relative flex gap-1 overflow-x-auto border-b hairline">
        {tabs.map((t) => (
          <RTabs.Trigger
            key={t.value}
            value={t.value}
            className="focus-ring relative whitespace-nowrap px-4 py-3 text-sm font-medium text-ink-2 transition-colors hover:text-ink data-[state=active]:text-ink after:absolute after:inset-x-3 after:-bottom-px after:h-[2px] after:rounded-full after:bg-brand after:opacity-0 after:transition-opacity data-[state=active]:after:opacity-100"
          >
            {t.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {children}
    </RTabs.Root>
  );
}
export const TabPanel = ({ value, children, className }: { value: string; children: ReactNode; className?: string }) => (
  <RTabs.Content value={value} className={cn('focus-ring pt-4', className)}>
    {children}
  </RTabs.Content>
);

// ───────────── Menu ─────────────
export function Menu({ trigger, items, align = 'end' }: { trigger: ReactNode; items: ({ label: ReactNode; onSelect: () => void; icon?: ReactNode; danger?: boolean; disabled?: boolean } | 'sep')[]; align?: 'start' | 'end' }) {
  return (
    <RMenu.Root>
      <RMenu.Trigger asChild>{trigger}</RMenu.Trigger>
      <RMenu.Portal>
        <RMenu.Content align={align} sideOffset={8} className="glass-strong z-50 min-w-[210px] rounded-[18px] p-1.5 shadow-lift">
          {items.map((it, i) =>
            it === 'sep' ? (
              <RMenu.Separator key={i} className="my-1 h-px bg-[var(--line)]" />
            ) : (
              <RMenu.Item
                key={i}
                disabled={it.disabled}
                onSelect={it.onSelect}
                className={cn(
                  'flex cursor-pointer select-none items-center gap-2.5 rounded-[12px] px-3 py-2 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-white/80 data-[disabled]:opacity-40',
                  it.danger ? 'text-bad' : 'text-ink',
                )}
              >
                {it.icon && <span className="text-ink-2">{it.icon}</span>}
                {it.label}
              </RMenu.Item>
            ),
          )}
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  );
}

// ───────────── misc ─────────────
export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="mb-1 grid h-12 w-12 place-items-center rounded-2xl bg-white/70 text-ink-2">{icon}</div>}
      <p className="font-medium">{title}</p>
      {children && <p className="max-w-sm text-sm text-ink-2">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-[14px] bg-ink/[.05] p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'focus-ring rounded-[10px] px-3 py-1.5 text-xs font-medium transition-all',
            value === o.value ? 'bg-white text-ink shadow-[0_2px_8px_-2px_rgba(0,0,0,.12)]' : 'text-ink-2 hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="num text-[22px] font-medium tracking-tight text-ink sm:text-2xl">{value}</div>
      <div className="mt-0.5 text-xs text-ink-2">{label}</div>
      {sub && <div className="mt-1 text-xs">{sub}</div>}
    </div>
  );
}

export function DemoTag({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border border-dashed border-ink/15 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-ink-3', className)}>
      Demo data
    </span>
  );
}
