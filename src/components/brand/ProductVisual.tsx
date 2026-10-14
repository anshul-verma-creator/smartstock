import { useId, useState } from 'react';
import type { Visual } from '@/data/types';

/**
 * Original, procedurally drawn product packaging (no third-party artwork). One stable visual per product:
 * the same shape, colours and label are used on every screen and in every scroll position.
 */
function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
  return `#${[f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
const light = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 165;
};

function DrawnPack({ visual, brand, className, title, size }: { visual: Visual; brand?: string; className?: string; title?: string; size?: number }) {
  const id = useId().replace(/:/g, '');
  const c = visual.color;
  const a = visual.accent;
  const ink = light(c) ? '#1d1d1f' : '#ffffff';
  const lbl = visual.label;
  const br = (brand ?? '').slice(0, 12);
  const common = (
    <defs>
      <linearGradient id={`f${id}`} x1="0" x2="1">
        <stop offset="0" stopColor={shade(c, 0.18)} />
        <stop offset="0.55" stopColor={c} />
        <stop offset="1" stopColor={shade(c, -0.12)} />
      </linearGradient>
      <linearGradient id={`s${id}`} x1="0" x2="1">
        <stop offset="0" stopColor={shade(c, -0.25)} />
        <stop offset="1" stopColor={shade(c, -0.4)} />
      </linearGradient>
      <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity=".55" />
        <stop offset=".4" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`sh${id}`}>
        <stop offset="0" stopColor="#3a2a12" stopOpacity=".28" />
        <stop offset="1" stopColor="#3a2a12" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`w${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#eef1f4" />
      </linearGradient>
    </defs>
  );
  const shadow = <ellipse cx="104" cy="268" rx="78" ry="9" fill={`url(#sh${id})`} />;
  const brandText = (y: number, x = 92, color = ink) =>
    br ? (
      <text x={x} y={y} textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontWeight={700} fontSize={13} fill={color} opacity={0.85} letterSpacing="1.2">
        {br.toUpperCase()}
      </text>
    ) : null;

  let body: JSX.Element;
  switch (visual.shape) {
    case 'carton':
      body = (
        <g>
          <path d="M44 74 L140 74 L140 258 L44 258 Z" fill={`url(#w${id})`} />
          <path d="M140 74 L168 58 L168 240 L140 258 Z" fill={shade(c, -0.15)} />
          <path d="M44 74 L62 34 L150 34 L140 74 Z" fill={shade(c, 0.1)} />
          <path d="M140 74 L150 34 L168 58 Z" fill={shade(c, -0.3)} />
          <path d="M62 34 L150 34 L152 26 L64 26 Z" fill={shade(c, -0.05)} />
          <ellipse cx="108" cy="46" rx="16" ry="6" fill="#f7f7f7" />
          <rect x="92" y="34" width="32" height="12" fill="#f2f2f2" />
          <ellipse cx="108" cy="34" rx="16" ry="6" fill="#ffffff" stroke="#e3e3e3" />
          <path d="M44 74 L140 74 L140 150 C 120 140 70 168 44 152 Z" fill={c} />
          <path d="M44 150 C 70 166 116 138 140 148 L140 162 C 112 154 72 182 44 166 Z" fill="#fff" opacity=".95" />
          <path d="M60 210 c 14 -26 46 -26 64 -6 c -10 22 -48 30 -64 6z" fill="#fff" opacity=".9" />
          <path d="M44 236 C 70 224 108 232 140 222 L140 258 L44 258 Z" fill={shade(c, -0.05)} opacity=".9" />
          {brandText(100, 92, '#fff')}
          <text x="92" y="128" textAnchor="middle" fontFamily="Inter, system-ui" fontWeight={700} fontSize={24} fill="#fff" letterSpacing="-0.6">{lbl}</text>
          <text x="58" y="250" fontFamily="Inter, system-ui" fontWeight={700} fontSize={14} fill="#fff">1L</text>
          <path d="M140 74 L168 58 L168 240 L140 258 Z" fill={`url(#g${id})`} opacity=".25" />
          <path d="M48 78 L52 78 L52 254 L48 254Z" fill="#fff" opacity=".35" />
        </g>
      );
      break;
    case 'box':
      body = (
        <g>
          <path d="M40 92 L134 92 L134 258 L40 258 Z" fill={`url(#f${id})`} />
          <path d="M134 92 L166 74 L166 240 L134 258 Z" fill={`url(#s${id})`} />
          <path d="M40 92 L72 74 L166 74 L134 92 Z" fill={shade(c, 0.25)} />
          <rect x="52" y="140" width="70" height="44" rx="8" fill={a} />
          {brandText(124, 87)}
          <text x="87" y="168" textAnchor="middle" fontFamily="Inter" fontWeight={700} fontSize={lbl.length > 6 ? 13 : 17} fill={light(a) ? '#1d1d1f' : '#fff'}>{lbl}</text>
          <path d="M40 92 L134 92 L134 130 L40 130 Z" fill={`url(#g${id})`} />
        </g>
      );
      break;
    case 'tub':
      body = (
        <g>
          <path d="M44 120 L56 250 Q104 266 152 250 L164 120 Z" fill={`url(#f${id})`} />
          <ellipse cx="104" cy="120" rx="60" ry="16" fill={shade(c, 0.3)} />
          <ellipse cx="104" cy="114" rx="62" ry="16" fill={a} />
          <ellipse cx="104" cy="110" rx="56" ry="12" fill={shade(a, 0.2)} />
          <rect x="66" y="160" width="76" height="46" rx="10" fill={a} opacity=".95" />
          {brandText(150, 104, light(c) ? '#1d1d1f' : '#fff')}
          <text x="104" y="190" textAnchor="middle" fontFamily="Inter" fontWeight={700} fontSize={18} fill={light(a) ? '#1d1d1f' : '#fff'}>{lbl}</text>
          <path d="M52 124 L60 246" stroke="#fff" strokeOpacity=".5" strokeWidth="5" strokeLinecap="round" />
        </g>
      );
      break;
    case 'bottle':
      body = (
        <g>
          <rect x="90" y="18" width="28" height="16" rx="4" fill={a === '#FFFFFF' ? '#c9c9c9' : a} />
          <path d="M92 34 L116 34 L118 56 C 140 72 144 92 144 120 L144 244 Q144 258 130 258 L78 258 Q64 258 64 244 L64 120 C 64 92 68 72 90 56 Z" fill={`url(#f${id})`} />
          <rect x="64" y="140" width="80" height="62" fill={a} opacity={a === '#FFFFFF' ? 0.95 : 0.92} />
          {brandText(132, 104, ink)}
          <text x="104" y="178" textAnchor="middle" fontFamily="Inter" fontWeight={800} fontSize={18} fill={light(a) ? c : '#fff'}>{lbl}</text>
          <path d="M74 92 C 70 120 70 210 72 240" stroke="#fff" strokeOpacity=".55" strokeWidth="6" strokeLinecap="round" fill="none" />
        </g>
      );
      break;
    case 'jar':
      body = (
        <g>
          <rect x="58" y="64" width="92" height="30" rx="8" fill={a} />
          <rect x="58" y="64" width="92" height="10" rx="5" fill={shade(a, 0.25)} />
          <path d="M54 96 Q54 90 62 90 L146 90 Q154 90 154 96 L158 244 Q158 258 144 258 L64 258 Q50 258 50 244 Z" fill={`url(#f${id})`} />
          <rect x="54" y="140" width="100" height="70" fill="#fff" opacity=".92" />
          {brandText(164, 104, c)}
          <text x="104" y="194" textAnchor="middle" fontFamily="Inter" fontWeight={700} fontSize={19} fill={c}>{lbl}</text>
          <path d="M62 104 L64 240" stroke="#fff" strokeOpacity=".5" strokeWidth="5" strokeLinecap="round" />
        </g>
      );
      break;
    case 'bag':
      body = (
        <g>
          <path d="M46 70 L162 70 L170 250 Q170 260 160 260 L48 260 Q38 260 38 250 Z" fill={`url(#f${id})`} />
          <path d="M46 70 L162 70 L160 52 L48 52 Z" fill={shade(c, -0.2)} />
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d={`M${48 + i * 9.5} 52 l4.75 -6 l4.75 6`} fill={shade(c, -0.2)} />
          ))}
          <ellipse cx="104" cy="168" rx="50" ry="40" fill={a} opacity=".9" />
          {brandText(110, 104)}
          <text x="104" y="176" textAnchor="middle" fontFamily="Inter" fontWeight={800} fontSize={22} fill={light(a) ? '#1d1d1f' : '#fff'}>{lbl}</text>
          <path d="M52 80 L46 246" stroke="#fff" strokeOpacity=".35" strokeWidth="7" strokeLinecap="round" />
        </g>
      );
      break;
    case 'bar':
      body = (
        <g transform="translate(0 40)">
          <path d="M30 130 L150 108 L180 124 L60 148 Z" fill={shade(c, 0.25)} />
          <path d="M30 130 L60 148 L60 196 L30 176 Z" fill={shade(c, -0.25)} />
          <path d="M60 148 L180 124 L180 172 L60 196 Z" fill={`url(#f${id})`} />
          <text x="120" y="168" textAnchor="middle" fontFamily="Inter" fontWeight={800} fontSize={24} fill={a} transform="rotate(-11 120 168)">{lbl}</text>
        </g>
      );
      break;
    case 'tube':
      body = (
        <g>
          <path d="M70 36 L138 36 L130 236 L78 236 Z" fill={`url(#f${id})`} />
          <rect x="66" y="30" width="76" height="10" rx="2" fill={shade(c, -0.2)} />
          <rect x="88" y="236" width="32" height="24" rx="5" fill="#f2f2f2" stroke="#ddd" />
          <rect x="76" y="100" width="56" height="90" rx="6" fill={a} opacity=".95" />
          {brandText(124, 104, c)}
          <text x="104" y="158" textAnchor="middle" fontFamily="Inter" fontWeight={800} fontSize={16} fill={c}>{lbl}</text>
          <path d="M80 44 L84 228" stroke="#fff" strokeOpacity=".45" strokeWidth="5" strokeLinecap="round" />
        </g>
      );
      break;
    case 'strip':
      body = (
        <g transform="rotate(-8 104 150)">
          <rect x="34" y="70" width="140" height="170" rx="10" fill={`url(#w${id})`} stroke="#dfe5ec" />
          <rect x="34" y="70" width="140" height="34" rx="10" fill={a} />
          <text x="104" y="93" textAnchor="middle" fontFamily="Inter" fontWeight={700} fontSize={14} fill="#fff">{br || 'Tablets'} {lbl}</text>
          {Array.from({ length: 10 }, (_, i) => (
            <ellipse key={i} cx={66 + (i % 2) * 76} cy={126 + Math.floor(i / 2) * 22} rx="20" ry="8" fill="#fff" stroke="#c9d3de" />
          ))}
        </g>
      );
      break;
    default:
      body = (
        <g>
          <path d="M44 60 C 40 52 168 52 164 60 L 170 244 C 172 256 36 256 38 244 Z" fill={`url(#f${id})`} />
          {Array.from({ length: 13 }, (_, i) => (
            <path key={i} d={`M${46 + i * 9.2} 60 l4.6 -7 l4.6 7`} fill={shade(c, -0.15)} />
          ))}
          {Array.from({ length: 13 }, (_, i) => (
            <path key={`b${i}`} d={`M${42 + i * 9.8} 246 l4.9 7 l4.9 -7`} fill={shade(c, -0.15)} />
          ))}
          <path d="M60 120 C 80 104 128 104 148 120 L 148 196 C 128 210 80 210 60 196 Z" fill={a} opacity=".95" />
          {brandText(100, 104)}
          <text x="104" y="166" textAnchor="middle" fontFamily="Inter" fontWeight={800} fontSize={lbl.length > 6 ? 17 : 21} fill={light(a) ? '#1d1d1f' : '#fff'}>{lbl}</text>
          <path d="M54 72 C 50 120 50 200 54 236" stroke="#fff" strokeOpacity=".45" strokeWidth="7" strokeLinecap="round" fill="none" />
        </g>
      );
  }

  return (
    <svg viewBox="0 0 208 280" className={className} width={size} height={size ? (size * 280) / 208 : undefined} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      {common}
      {shadow}
      {body}
    </svg>
  );
}

/**
 * Product visual: the supplied transparent product photo when available, otherwise the drawn pack.
 * The image box is sized by `className` (e.g. h-20 w-16) and the photo is contained, bottom-aligned,
 * so every product sits on the same baseline. A failed image load falls back to the drawn pack.
 */
export function ProductVisual({ visual, brand, className, title, size, shadow = true }: { visual: Visual; brand?: string; className?: string; title?: string; size?: number; shadow?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!visual.image || failed) return <DrawnPack visual={visual} brand={brand} className={className} title={title} size={size} />;
  return (
    <span className={`relative inline-flex items-end justify-center ${className ?? ''}`} style={size ? { width: size, height: (size * 280) / 208 } : undefined} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <img
        src={visual.image}
        alt=""
        draggable={false}
        decoding="async"
        onError={() => setFailed(true)}
        className="max-h-full max-w-full select-none object-contain"
        style={shadow ? { filter: 'drop-shadow(0 10px 12px rgba(70,45,10,.16)) drop-shadow(0 2px 3px rgba(70,45,10,.08))' } : undefined}
      />
    </span>
  );
}

/** Small rounded thumbnail used in lists and tables. */
export function ProductThumb({ visual, brand, className }: { visual: Visual; brand?: string; className?: string }) {
  return (
    <span className={`inline-grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[12px] bg-white/80 ring-1 ring-black/[.04] ${className ?? ''}`}>
      <ProductVisual visual={visual} brand={brand} className="h-8 w-8" shadow={false} />
    </span>
  );
}
