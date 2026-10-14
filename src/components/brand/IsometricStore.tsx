import { memo, useState } from 'react';

/**
 * Pale monochrome isometric kirana store (aisles, checkout, backroom) drawn procedurally.
 * Decorative only: hidden from assistive technology and never encodes data.
 */
const S = 15;
const C = 0.866;
const iso = (x: number, y: number, z: number) => [(x - y) * C * S, (x + y) * 0.5 * S - z * S] as const;
const pts = (a: (readonly [number, number])[]) => a.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

interface Box {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  tone?: 'base' | 'warm' | 'cool' | 'dark';
  outline?: boolean;
}

const TONES = {
  base: ['#ffffff', '#efede8', '#e2dfd8'],
  warm: ['#fff3e4', '#f7e0c2', '#efd2ad'],
  cool: ['#f6f7f9', '#e6e9ee', '#d9dde4'],
  dark: ['#f1efea', '#dcd8cf', '#cdc8bd'],
};

function buildScene(): Box[] {
  const boxes: Box[] = [];
  // aisle shelving: 4 double-sided rows
  const rows = [6, 12, 18, 24];
  rows.forEach((y, ri) => {
    for (let seg = 0; seg < 2; seg++) {
      const x0 = 6 + seg * 11;
      boxes.push({ x: x0, y, z: 0, w: 10, d: 1.8, h: 0.5, tone: 'dark' });
      for (let lvl = 0; lvl < 4; lvl++) {
        const z = 0.5 + lvl * 1.35;
        boxes.push({ x: x0, y, z, w: 10, d: 1.8, h: 0.12 });
        for (let k = 0; k < 7; k++) {
          const tone = (k + lvl + ri + seg) % 9 === 0 ? 'warm' : (k + lvl) % 4 === 0 ? 'cool' : 'base';
          const hh = 0.6 + ((k * 7 + lvl * 3 + ri) % 4) * 0.12;
          boxes.push({ x: x0 + 0.25 + k * 1.38, y: y + 0.25, z: z + 0.12, w: 1.05, d: 1.3, h: hh, tone });
        }
      }
      boxes.push({ x: x0, y, z: 5.9, w: 10, d: 1.8, h: 0.12 });
    }
  });
  // fridge wall at the back
  for (let i = 0; i < 5; i++) boxes.push({ x: 4 + i * 4.2, y: 0.4, z: 0, w: 4, d: 2.2, h: 6.4, tone: i === 2 ? 'cool' : 'base', outline: true });
  // checkout counter + register
  boxes.push({ x: 32, y: 26, z: 0, w: 7, d: 2.6, h: 2.4, tone: 'dark' });
  boxes.push({ x: 33, y: 26.5, z: 2.4, w: 1.8, d: 1.4, h: 1.0, tone: 'cool' });
  boxes.push({ x: 36, y: 26.6, z: 2.4, w: 2.2, d: 1.2, h: 0.35, tone: 'warm' });
  // backroom: partition + stacked cartons
  boxes.push({ x: 30, y: 0, z: 0, w: 0.3, d: 16, h: 6.6, tone: 'base' });
  const stacks = [
    [32, 2, 3], [35.4, 2, 2], [38.8, 2, 3], [32, 6, 2], [35.4, 6, 3], [38.8, 6, 1], [32, 10.5, 1], [36, 10.5, 2],
  ];
  stacks.forEach(([x, y, n], i) => {
    for (let k = 0; k < n; k++) boxes.push({ x, y, z: k * 1.55, w: 3, d: 3, h: 1.5, tone: (i + k) % 5 === 0 ? 'warm' : 'base' });
  });
  return boxes.sort((a, b) => a.x + a.y + a.z * 0.01 - (b.x + b.y + b.z * 0.01) || a.z - b.z);
}

const scene = buildScene();

function BoxShape({ b }: { b: Box }) {
  const [top, left, right] = TONES[b.tone ?? 'base'];
  const { x, y, z, w, d, h } = b;
  const stroke = 'rgba(70,60,45,.16)';
  return (
    <g strokeWidth={0.6} stroke={stroke} strokeLinejoin="round">
      <polygon points={pts([iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)])} fill={left} />
      <polygon points={pts([iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)])} fill={right} />
      <polygon points={pts([iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)])} fill={top} />
      {b.outline && (
        <polyline points={pts([iso(x + 0.3, y + d, z + 0.5), iso(x + 0.3, y + d, z + h - 0.4), iso(x + w - 0.3, y + d, z + h - 0.4)])} fill="none" stroke="rgba(70,60,45,.12)" />
      )}
    </g>
  );
}

export const IsometricStore = memo(function IsometricStore({ className }: { className?: string }) {
  const floor = [iso(0, 0, 0), iso(44, 0, 0), iso(44, 32, 0), iso(0, 32, 0)];
  const grid: JSX.Element[] = [];
  for (let i = 0; i <= 44; i += 2) grid.push(<line key={`gx${i}`} x1={iso(i, 0, 0)[0]} y1={iso(i, 0, 0)[1]} x2={iso(i, 32, 0)[0]} y2={iso(i, 32, 0)[1]} />);
  for (let j = 0; j <= 32; j += 2) grid.push(<line key={`gy${j}`} x1={iso(0, j, 0)[0]} y1={iso(0, j, 0)[1]} x2={iso(44, j, 0)[0]} y2={iso(44, j, 0)[1]} />);
  return (
    <svg viewBox="-480 -150 1150 760" className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="iso-fade" cx="52%" cy="46%" r="58%">
          <stop offset="0.55" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="iso-mask">
          <rect x="-480" y="-150" width="1150" height="760" fill="url(#iso-fade)" />
        </mask>
        <pattern id="iso-tech" width="22" height="22" patternUnits="userSpaceOnUse">
          <path d="M22 0 L0 0 0 22" fill="none" stroke="rgba(70,60,45,.07)" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect x="-480" y="-150" width="1150" height="760" fill="url(#iso-tech)" opacity="0.7" />
      <g mask="url(#iso-mask)">
        <polygon points={pts(floor)} fill="#f7f6f2" stroke="rgba(70,60,45,.18)" />
        <g stroke="rgba(70,60,45,.07)" strokeWidth="0.6">{grid}</g>
        {/* back walls */}
        <polygon points={pts([iso(0, 0, 0), iso(44, 0, 0), iso(44, 0, 7), iso(0, 0, 7)])} fill="#fbfaf8" stroke="rgba(70,60,45,.14)" />
        <polygon points={pts([iso(0, 0, 0), iso(0, 32, 0), iso(0, 32, 7), iso(0, 0, 7)])} fill="#f3f1ec" stroke="rgba(70,60,45,.14)" />
        {[8, 16, 24].map((y) => (
          <polygon key={y} points={pts([iso(0, y, 2.5), iso(0, y + 4, 2.5), iso(0, y + 4, 5.2), iso(0, y, 5.2)])} fill="#ffffff" stroke="rgba(70,60,45,.12)" />
        ))}
        {scene.map((b, i) => (
          <BoxShape key={i} b={b} />
        ))}
        {/* dimension linework */}
        <g stroke="rgba(70,60,45,.22)" strokeWidth="0.7" fill="none" strokeDasharray="3 4">
          <polyline points={pts([iso(0, 34, 0), iso(44, 34, 0)])} />
          <polyline points={pts([iso(46, 0, 0), iso(46, 32, 0)])} />
        </g>
      </g>
    </svg>
  );
});

/**
 * Hero backdrop: the supplied monochrome isometric store render, blended into the pearl canvas
 * (multiply removes its white ground) and faded at the edges. Falls back to the drawn store if it fails to load.
 */
export function StoreBackdrop({ className }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <IsometricStore className={className} />;
  return (
    <img
      src="/assets/store-isometric.webp"
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
      style={{
        mixBlendMode: 'multiply',
        WebkitMaskImage: 'radial-gradient(120% 95% at 62% 48%, #000 55%, transparent 88%)',
        maskImage: 'radial-gradient(120% 95% at 62% 48%, #000 55%, transparent 88%)',
      }}
    />
  );
}
