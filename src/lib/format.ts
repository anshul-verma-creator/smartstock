const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export const money = (v: number) => inr.format(v);
export const money0 = (v: number) => inr0.format(Math.round(v));
export const qty = (v: number) => num.format(v);
export const pct = (v: number, dp = 1) => `${v.toFixed(dp)}%`;

/** ₹2.4L / ₹18.5k style for small chart labels */
export function moneyShort(v: number) {
  const a = Math.abs(v);
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`;
  return `₹${Math.round(v)}`;
}

export const UNIT_LABEL: Record<string, string> = {
  pcs: 'units', pack: 'packs', box: 'boxes', strip: 'strips', bottle: 'bottles', dozen: 'dozen', kg: 'kg', g: 'g', l: 'L', ml: 'ml',
};
export const unitLabel = (u: string) => UNIT_LABEL[u] ?? u;
export const isWholeUnit = (u: string) => ['pcs', 'pack', 'box', 'strip', 'bottle', 'dozen'].includes(u);
