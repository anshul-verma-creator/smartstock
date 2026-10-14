import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/components/ui';

export type PrinterStatus = 'idle' | 'ready' | 'printing' | 'dialog' | 'failed';

const STATUS_TEXT: Record<PrinterStatus, string> = {
  idle: 'Ready · waiting for a saved bill',
  ready: 'Ready to print',
  printing: 'Feeding receipt…',
  dialog: 'Print dialog opened',
  failed: 'Print failed — use the A4 copy or try again',
};

/**
 * Compact thermal receipt printer built with CSS 3D transforms (graphite body, warm-orange status light).
 * It is purely a presentation of the print step: it never creates, finalises or changes a sale.
 * `feedKey` changes each time a print starts, which replays the paper-feed animation.
 */
export function Printer3D({ status, label, feedKey, paper, compact }: { status: PrinterStatus; label?: string; feedKey: number; paper: ReactNode; compact?: boolean }) {
  const [tilt, setTilt] = useState({ x: -20, y: -28 });
  const ref = useRef<HTMLDivElement>(null);
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [feeding, setFeeding] = useState(false);

  useEffect(() => {
    if (!feedKey) return;
    setFeeding(false);
    const r = requestAnimationFrame(() => setFeeding(true));
    return () => cancelAnimationFrame(r);
  }, [feedKey]);

  const W = compact ? 200 : 236;
  const H = compact ? 84 : 98;
  const D = compact ? 150 : 172;
  const led = status === 'printing' ? 'animate-pulse bg-brand shadow-[0_0_10px_2px_rgba(255,138,0,.85)]' : status === 'failed' ? 'bg-bad shadow-[0_0_8px_rgba(217,45,32,.8)]' : status === 'idle' ? 'bg-brand/40' : 'bg-brand shadow-[0_0_8px_1px_rgba(255,138,0,.7)]';

  const face = 'absolute left-1/2 top-1/2 [backface-visibility:hidden]';
  return (
    <div className="flex flex-col items-center">
      <div
        ref={ref}
        className="relative grid w-full place-items-center"
        style={{ perspective: 1100, height: compact ? 250 : 300 }}
        onMouseMove={(e) => {
          if (reduce) return;
          const r = ref.current!.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          setTilt({ x: -20 - py * 6, y: -28 + px * 10 });
        }}
        onMouseLeave={() => setTilt({ x: -20, y: -28 })}
        aria-hidden
      >
        {/* soft contact shadow */}
        <div className="absolute bottom-6 h-10 w-[70%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(40,30,15,.35),transparent)] blur-[6px]" />
        <div className="relative transition-transform duration-500 ease-soft" style={{ transformStyle: 'preserve-3d', transform: `translateY(40px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}>
          {/* front */}
          <div className={face} style={{ width: W, height: H, transform: `translate(-50%,-50%) translateZ(${D / 2}px)`, background: 'linear-gradient(180deg,#4a4a4f 0%,#36363a 45%,#2a2a2d 100%)', borderRadius: 14, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18), inset 0 -8px 16px rgba(0,0,0,.25)' }}>
            <div className="absolute inset-x-5 top-4 flex items-center justify-between">
              <span className="text-[9px] font-semibold tracking-[.25em] text-white/45">SMARTSTOCK · T80</span>
              <span className={cn('h-2 w-2 rounded-full transition-all', led)} />
            </div>
            <div className="absolute inset-x-5 bottom-4 h-[3px] rounded-full bg-black/40 shadow-[0_1px_0_rgba(255,255,255,.12)]" />
          </div>
          {/* right side */}
          <div className={face} style={{ width: D, height: H, transform: `translate(-50%,-50%) rotateY(90deg) translateZ(${W / 2}px)`, background: 'linear-gradient(90deg,#2b2b2e,#1f1f22)', borderRadius: 14 }} />
          {/* left side */}
          <div className={face} style={{ width: D, height: H, transform: `translate(-50%,-50%) rotateY(-90deg) translateZ(${W / 2}px)`, background: '#2f2f33', borderRadius: 14 }} />
          {/* top */}
          <div className={face} style={{ width: W, height: D, transform: `translate(-50%,-50%) rotateX(90deg) translateZ(${H / 2}px)`, background: 'radial-gradient(120% 90% at 30% 20%,#5b5b61 0%,#3c3c41 55%,#2e2e32 100%)', borderRadius: 16, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08)' }}>
            {/* paper slot near the back */}
            <div className="absolute inset-x-6 top-7 h-[7px] rounded-full bg-black/70 shadow-[inset_0_2px_3px_rgba(0,0,0,.8),0_1px_0_rgba(255,255,255,.12)]" />
            <div className="absolute bottom-5 right-6 h-6 w-6 rounded-full bg-[#2a2a2e] shadow-[inset_0_1px_1px_rgba(255,255,255,.15),0_2px_3px_rgba(0,0,0,.4)]" />
            <div className="absolute bottom-6 left-6 h-1 w-14 rounded-full bg-white/10" />
          </div>
          {/* paper emerging from the slot */}
          <div
            className="absolute left-1/2 overflow-hidden"
            style={{ width: W - 64, height: compact ? 150 : 190, transform: `translate(-50%, -100%) translateY(${-H / 2}px) translateZ(${-D / 2 + 31}px) rotateX(-6deg)`, transformOrigin: 'bottom center' }}
          >
            <div
              key={feedKey}
              className={cn('absolute inset-x-0 bottom-0 origin-bottom', feeding && !reduce ? 'animate-[feed_1.8s_cubic-bezier(.3,.7,.2,1)_both]' : '')}
              style={{ transform: status === 'idle' ? 'translateY(86%)' : feeding || reduce ? undefined : 'translateY(70%)' }}
            >
              <div className="max-h-[400px] overflow-hidden rounded-t-[3px] shadow-[0_-6px_18px_rgba(0,0,0,.12)] [mask-image:linear-gradient(180deg,#000_70%,transparent)]">{paper}</div>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-1 flex items-center gap-2 text-xs font-medium text-ink-2" role="status" aria-live="polite">
        <span className={cn('h-2 w-2 rounded-full', led)} aria-hidden />
        {STATUS_TEXT[status]}
        {label && status !== 'idle' ? <span className="font-mono text-ink">{label}</span> : null}
      </p>
    </div>
  );
}
