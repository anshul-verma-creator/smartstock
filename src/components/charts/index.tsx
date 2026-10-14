import { useId, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/components/ui';

/** "nice" axis maximum and ticks */
function niceTicks(max: number, count = 4) {
  if (max <= 0) return { max: 1, ticks: [0, 1] };
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
  return { max: top, ticks };
}

function Tooltip({ xPct, children }: { xPct: number; children: ReactNode }) {
  return (
    <div
      className="glass-strong pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-[calc(100%+6px)] whitespace-nowrap rounded-[12px] px-3 py-2 text-xs shadow-lift"
      style={{ left: `clamp(80px, ${xPct}%, calc(100% - 80px))` }}
    >
      {children}
    </div>
  );
}

// ───────────── Fine vertical bars (weekly sales) ─────────────
export function FineBars({
  data, height = 170, highlight, format, label, xLabels, className,
}: {
  data: { key: string; value: number; tip: ReactNode }[];
  height?: number;
  highlight?: (i: number) => boolean;
  format: (v: number) => string;
  label: string;
  xLabels?: { index: number; text: string }[];
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = height;
  const padL = 40;
  const padB = 22;
  const { max, ticks } = useMemo(() => niceTicks(Math.max(...data.map((d) => d.value), 1)), [data]);
  const bw = (W - padL) / data.length;
  const y = (v: number) => (H - padB) * (1 - v / max) + 4;
  return (
    <div className={cn('relative', className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="rgba(23,23,23,.06)" />
            <text x={padL - 8} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#8e8e94" className="num">{format(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const hi = highlight?.(i);
          const h = Math.max(1, y(0) - y(d.value));
          return (
            <g key={d.key} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)}>
              <rect x={padL + i * bw} y={4} width={bw} height={H - padB} fill="transparent" />
              {hi && <rect x={padL + i * bw} y={4} width={bw} height={H - padB - 4} fill="rgba(255,138,0,.07)" />}
              <rect
                x={padL + i * bw + bw * 0.28}
                y={y(d.value)}
                width={Math.max(1.2, bw * 0.44)}
                height={h}
                rx={Math.min(1.5, bw * 0.2)}
                fill={hover === i ? '#171717' : hi ? '#ff8a00' : 'rgba(23,23,23,.18)'}
              />
            </g>
          );
        })}
        {xLabels?.map((l) => (
          <text key={l.index} x={padL + l.index * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#8e8e94">{l.text}</text>
        ))}
      </svg>
      {hover !== null && (
        <Tooltip xPct={((padL + hover * bw + bw / 2) / W) * 100}>
          {data[hover].tip}
        </Tooltip>
      )}
    </div>
  );
}

// ───────────── Line / area chart (actual solid, forecast dashed) ─────────────
export interface Series {
  name: string;
  color: string;
  values: (number | null)[];
  dashed?: boolean;
  area?: boolean;
}

export function LineChart({
  labels, series, height = 220, format, label, className, tipLabel,
}: {
  labels: string[];
  series: Series[];
  height?: number;
  format: (v: number) => string;
  label: string;
  className?: string;
  tipLabel?: (i: number) => string;
}) {
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = height;
  const padL = 46;
  const padR = 12;
  const padB = 24;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const { max, ticks } = niceTicks(Math.max(...all, 1));
  const n = labels.length;
  const x = (i: number) => padL + (n <= 1 ? 0 : (i * (W - padL - padR)) / (n - 1));
  const y = (v: number) => (H - padB - 8) * (1 - v / max) + 8;
  const path = (vals: (number | null)[]) => {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  };
  const step = Math.max(1, Math.ceil(n / 7));
  return (
    <div className={cn('relative', className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={label}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.max(0, Math.min(n - 1, Math.round(((px - padL) / (W - padL - padR)) * (n - 1)))));
        }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {series.map((s, si) => (
            <linearGradient key={si} id={`a${uid}${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity=".22" />
              <stop offset="1" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="rgba(23,23,23,.06)" />
            <text x={padL - 8} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#8e8e94">{format(t)}</text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % step === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#8e8e94">{l}</text>
          ) : null,
        )}
        {series.map((s, si) => {
          const d = path(s.values);
          const first = s.values.findIndex((v) => v !== null);
          let last = -1;
          s.values.forEach((v, i) => v !== null && (last = i));
          return (
            <g key={si}>
              {s.area && first >= 0 && <path d={`${d} L${x(last)} ${y(0)} L${x(first)} ${y(0)} Z`} fill={`url(#a${uid}${si})`} />}
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '5 5' : undefined} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={8} y2={H - padB} stroke="rgba(23,23,23,.15)" />
            {series.map((s, si) =>
              s.values[hover] !== null ? <circle key={si} cx={x(hover)} cy={y(s.values[hover]!)} r={4} fill="#fff" stroke={s.color} strokeWidth={2} /> : null,
            )}
          </g>
        )}
      </svg>
      {hover !== null && (
        <Tooltip xPct={(x(hover) / W) * 100}>
          <div className="mb-1 font-medium">{tipLabel ? tipLabel(hover) : labels[hover]}</div>
          {series.map((s) =>
            s.values[hover] !== null ? (
              <div key={s.name} className="flex items-center gap-2 text-ink-2">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.name}: <span className="num font-medium text-ink">{format(s.values[hover]!)}</span>
              </div>
            ) : null,
          )}
        </Tooltip>
      )}
    </div>
  );
}

// ───────────── Decorative capsule spark (Monthly revenue card) ─────────────
export function CapsuleSpark({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(...values, 1);
  return (
    <svg viewBox={`0 0 ${values.length * 12} 40`} className={className} aria-hidden="true">
      {values.map((v, i) => {
        const h = 8 + (v / max) * 30;
        return <rect key={i} x={i * 12 + 2} y={(40 - h) / 2} width={7} height={h} rx={3.5} fill={i >= values.length - 4 ? 'rgba(23,23,23,.14)' : '#ff8a00'} opacity={i >= values.length - 4 ? 1 : 0.55 + (i / values.length) * 0.45} />;
      })}
    </svg>
  );
}

// ───────────── Semicircular alert indicator ─────────────
/**
 * Documented scale: alert pressure = (2 × critical + 1 × warning) ÷ (2 × total active alerts), 0–100%.
 * 0–33% Safe, 34–66% Warning, 67–100% Critical. The numeric breakdown is always shown next to it.
 */
export function SemiGauge({ critical, warning, info }: { critical: number; warning: number; info: number }) {
  const total = critical + warning + info;
  const p = total ? (2 * critical + warning) / (2 * total) : 0;
  const ticks = 34;
  const zone = p < 0.34 ? 'Safe' : p < 0.67 ? 'Warning' : 'Critical';
  return (
    <div className="relative mx-auto max-w-[260px]">
      <svg viewBox="0 0 220 124" className="h-auto w-full" role="img" aria-label={`Alert pressure ${Math.round(p * 100)}%, ${zone}`}>
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const a = Math.PI - (i / ticks) * Math.PI;
          const r1 = 84;
          const r2 = i % 5 === 0 ? 100 : 95;
          const on = i / ticks <= p + 1e-9;
          return (
            <line
              key={i}
              x1={110 + r1 * Math.cos(a)}
              y1={112 - r1 * Math.sin(a)}
              x2={110 + r2 * Math.cos(a)}
              y2={112 - r2 * Math.sin(a)}
              stroke={on ? '#ff8a00' : 'rgba(23,23,23,.16)'}
              strokeWidth={i % 5 === 0 ? 2 : 1.4}
              strokeLinecap="round"
            />
          );
        })}
        <g transform={`rotate(${-90 + p * 180} 110 112)`}>
          <line x1="110" y1="112" x2="110" y2="40" stroke="#ff8a00" strokeWidth="2" strokeLinecap="round" />
          <path d="M104 40 L116 40 L110 30 Z" fill="#ff8a00" />
        </g>
        <circle cx="110" cy="112" r="4" fill="#171717" />
        <text x="44" y="122" fontSize="9" fill={zone === 'Safe' ? '#171717' : '#8e8e94'} textAnchor="middle">Safe</text>
        <text x="110" y="66" fontSize="9" fill={zone === 'Warning' ? '#171717' : '#8e8e94'} textAnchor="middle" fontWeight={zone === 'Warning' ? 600 : 400}>Warning</text>
        <text x="178" y="122" fontSize="9" fill={zone === 'Critical' ? '#b42318' : '#8e8e94'} textAnchor="middle" fontWeight={zone === 'Critical' ? 600 : 400}>Critical</text>
      </svg>
    </div>
  );
}

// ───────────── Horizontal share bars ─────────────
export function ShareBars({ items, format }: { items: { label: string; value: number; color?: string }[]; format: (v: number) => string }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  return (
    <div className="space-y-2.5">
      {items.map((i) => (
        <div key={i.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-ink-2">{i.label}</span>
            <span className="num font-medium">{format(i.value)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink/[.06]">
            <div className="h-full rounded-full" style={{ width: `${(i.value / total) * 100}%`, background: i.color ?? '#ff8a00' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
