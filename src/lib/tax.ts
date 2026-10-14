import Decimal from 'decimal.js';

/**
 * Central GST engine. Every screen (POS preview, receipts, reports) uses this module; nothing else computes tax.
 * Rounding: half away from zero to 2 dp (matches Postgres `round(numeric, 2)`).
 *
 *  exclusive: taxable = net; gst = round(taxable × r%); cess = round(taxable × c%); total = taxable + gst + cess
 *  inclusive: taxable = round(net × 100 / (100 + r + c)); cess = round(taxable × c%); gst = net − taxable − cess; total = net
 *  intra-state: cgst = round(gst / 2), sgst = gst − cgst      inter-state: igst = gst
 *  unregistered seller: no GST is charged.
 */
Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

const r2 = (d: Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export interface TaxLineInput {
  quantity: number;
  unitPrice: number;
  /** item-level discount in rupees, in the same price basis as unitPrice */
  lineDiscount?: number;
  priceIncludesTax: boolean;
  gstRate: number;
  cessRate?: number;
}

export interface TaxLineResult {
  gross: number;
  lineDiscount: number;
  invoiceDiscountShare: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  tax: number;
  total: number;
}

export interface InvoiceInput {
  lines: TaxLineInput[];
  invoiceDiscount?: number;
  interState: boolean;
  taxApplicable: boolean;
  roundOff: boolean;
}

export interface InvoiceResult {
  lines: TaxLineResult[];
  gross: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  tax: number;
  subtotal: number;
  roundOff: number;
  grandTotal: number;
}

export function calcTaxLine(
  gross: Decimal.Value,
  discount: Decimal.Value,
  includesTax: boolean,
  gstRate: number,
  cessRate: number,
  interState: boolean,
  taxApplicable: boolean,
) {
  const n = r2(new Decimal(gross).minus(discount));
  if (n.isNegative()) throw new Error('Discount cannot exceed the line amount.');
  const r = new Decimal(taxApplicable ? gstRate : 0);
  const c = new Decimal(taxApplicable ? cessRate : 0);
  let taxable: Decimal;
  let gst: Decimal;
  let cess: Decimal;
  let total: Decimal;
  if (includesTax) {
    taxable = r2(n.times(100).div(new Decimal(100).plus(r).plus(c)));
    cess = r2(taxable.times(c).div(100));
    gst = n.minus(taxable).minus(cess);
    total = n;
  } else {
    taxable = n;
    gst = r2(taxable.times(r).div(100));
    cess = r2(taxable.times(c).div(100));
    total = taxable.plus(gst).plus(cess);
  }
  const cgst = interState ? new Decimal(0) : r2(gst.div(2));
  const sgst = interState ? new Decimal(0) : gst.minus(cgst);
  const igst = interState ? gst : new Decimal(0);
  return { taxable, cgst, sgst, igst, cess, total };
}

/**
 * Whole-invoice calculation. Invoice discount is allocated in proportion to (gross − line discount);
 * the largest line (first on ties) absorbs the rounding remainder so shares always sum exactly.
 */
export function calcInvoice(input: InvoiceInput): InvoiceResult {
  const invDisc = r2(new Decimal(input.invoiceDiscount ?? 0));
  const prepared = input.lines.map((l) => {
    const gross = r2(new Decimal(l.quantity).times(l.unitPrice));
    const ld = r2(new Decimal(l.lineDiscount ?? 0));
    if (ld.isNegative() || ld.greaterThan(gross)) throw new Error('Discount cannot exceed the line amount.');
    return { l, gross, ld, base: gross.minus(ld) };
  });
  const totalBase = prepared.reduce((s, p) => s.plus(p.base), new Decimal(0));
  if (invDisc.greaterThan(totalBase)) throw new Error('Bill discount cannot exceed the bill amount.');

  let maxIdx = 0;
  prepared.forEach((p, i) => {
    if (p.base.greaterThan(prepared[maxIdx].base)) maxIdx = i;
  });
  const shares = prepared.map((p, i) =>
    i === maxIdx || totalBase.isZero() ? new Decimal(0) : r2(invDisc.times(p.base).div(totalBase)),
  );
  shares[maxIdx] = invDisc.minus(shares.reduce((s, x) => s.plus(x), new Decimal(0)));

  const sum = { gross: new Decimal(0), discount: new Decimal(0), taxable: new Decimal(0), cgst: new Decimal(0), sgst: new Decimal(0), igst: new Decimal(0), cess: new Decimal(0), total: new Decimal(0) };
  const lines: TaxLineResult[] = prepared.map((p, i) => {
    const t = calcTaxLine(p.gross, p.ld.plus(shares[i]), p.l.priceIncludesTax, p.l.gstRate, p.l.cessRate ?? 0, input.interState, input.taxApplicable);
    sum.gross = sum.gross.plus(p.gross);
    sum.discount = sum.discount.plus(p.ld).plus(shares[i]);
    sum.taxable = sum.taxable.plus(t.taxable);
    sum.cgst = sum.cgst.plus(t.cgst);
    sum.sgst = sum.sgst.plus(t.sgst);
    sum.igst = sum.igst.plus(t.igst);
    sum.cess = sum.cess.plus(t.cess);
    sum.total = sum.total.plus(t.total);
    return {
      gross: p.gross.toNumber(),
      lineDiscount: p.ld.toNumber(),
      invoiceDiscountShare: shares[i].toNumber(),
      taxable: t.taxable.toNumber(),
      cgst: t.cgst.toNumber(),
      sgst: t.sgst.toNumber(),
      igst: t.igst.toNumber(),
      cess: t.cess.toNumber(),
      tax: t.cgst.plus(t.sgst).plus(t.igst).plus(t.cess).toNumber(),
      total: t.total.toNumber(),
    };
  });
  const grand = input.roundOff ? sum.total.toDecimalPlaces(0, Decimal.ROUND_HALF_UP) : sum.total;
  const tax = sum.cgst.plus(sum.sgst).plus(sum.igst).plus(sum.cess);
  return {
    lines,
    gross: sum.gross.toNumber(),
    discount: sum.discount.toNumber(),
    taxable: sum.taxable.toNumber(),
    cgst: sum.cgst.toNumber(),
    sgst: sum.sgst.toNumber(),
    igst: sum.igst.toNumber(),
    cess: sum.cess.toNumber(),
    tax: tax.toNumber(),
    subtotal: sum.total.toNumber(),
    roundOff: grand.minus(sum.total).toNumber(),
    grandTotal: grand.toNumber(),
  };
}
