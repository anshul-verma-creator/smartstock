export type Unit = 'pcs' | 'pack' | 'box' | 'strip' | 'bottle' | 'dozen' | 'kg' | 'g' | 'l' | 'ml';
export type Shape = 'carton' | 'box' | 'tub' | 'packet' | 'bottle' | 'jar' | 'bag' | 'bar' | 'tube' | 'strip';
export type PayMethod = 'cash' | 'upi' | 'card' | 'bank';
export type Role = 'owner' | 'manager' | 'cashier' | 'inventory';

export interface Visual {
  shape: Shape;
  color: string;
  accent: string;
  label: string;
  /** optional transparent product photo; the drawn pack is the fallback */
  image?: string;
}

export interface Location {
  id: string;
  kind: 'shelf' | 'backroom';
  block: string;
  rack?: string;
  shelf?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email?: string;
  address: string;
  leadTimeDays: number;
  acceptsReturns: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  creditDays: number;
  isBusiness?: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  brand?: string;
  category: string;
  description?: string;
  unit: Unit;
  cost: number;
  price: number;
  mrp?: number;
  gst: number;
  includesTax: boolean;
  hsn?: string;
  barcode?: string;
  minStock: number;
  supplierId: string;
  locationId: string;
  trackBatches: boolean;
  trackExpiry: boolean;
  shelfLife?: number;
  visual: Visual;
  status: 'active' | 'inactive';
}

export interface Batch {
  id: string;
  productId: string;
  code: string;
  expiry: string | null;
  unitCost: number;
  receivedOn: string;
  supplierId: string;
  internal: boolean;
  markdownPct: number;
}

/** quantity of one batch at one location */
export interface Balance {
  batchId: string;
  locationId: string;
  qty: number;
}

export type MovementType =
  | 'purchase' | 'sale' | 'void_reversal' | 'purchase_return' | 'adjustment' | 'write_off'
  | 'transfer_in' | 'transfer_out' | 'rescue_out' | 'opening';

export interface Movement {
  id: string;
  date: string;
  ts: string;
  productId: string;
  batchId: string;
  locationId: string;
  type: MovementType;
  qty: number;
  unitCost: number;
  note: string;
  ref?: string;
}

export interface InvoiceLine {
  productId: string;
  name: string;
  sku: string;
  hsn?: string;
  unit: Unit;
  qty: number;
  unitPrice: number;
  includesTax: boolean;
  gst: number;
  lineDiscount: number;
  invoiceDiscountShare: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  total: number;
  cost: number;
  batches: { batchId: string; code: string; qty: number }[];
  rescueEventId?: string;
}

export interface Payment {
  id: string;
  date: string;
  ts: string;
  direction: 'in' | 'out';
  kind: 'sale_receipt' | 'customer_repayment' | 'supplier_payment' | 'refund';
  method: PayMethod;
  amount: number;
  reference?: string;
  customerId?: string;
  supplierId?: string;
  invoiceId?: string;
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  ts: string;
  status: 'posted' | 'voided';
  customerId?: string;
  customerName?: string;
  supplyType: 'intra' | 'inter';
  lines: InvoiceLine[];
  gross: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  tax: number;
  roundOff: number;
  total: number;
  paid: number;
  due: number;
  cost: number;
  payments: { method: PayMethod; amount: number; reference?: string }[];
  voidReason?: string;
  cashier: string;
}

export interface Purchase {
  id: string;
  billNumber: string;
  date: string;
  supplierId: string;
  lines: { productId: string; batchId: string; qty: number; unitCost: number; gst: number }[];
  taxable: number;
  tax: number;
  total: number;
  paid: number;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  supplierId: string;
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  createdOn: string;
  expected: string;
  items: { productId: string; qty: number; unitCost: number; reason?: string }[];
  note?: string;
}

export type RescueType = 'supplier_return' | 'surplus_sale' | 'discount' | 'donation';
export type RescueStatus = 'requested' | 'listed' | 'approved' | 'confirmed' | 'cancelled';

export interface RescueEvent {
  id: string;
  type: RescueType;
  status: RescueStatus;
  productId: string;
  batchId: string;
  supplierId?: string;
  qty: number;
  unitCost: number;
  offerPrice?: number;
  discountPct?: number;
  confirmedQty: number;
  recovered: number;
  reason: string;
  counterparty?: string;
  createdOn: string;
  confirmedOn?: string;
}

export interface Business {
  name: string;
  owner: string;
  phone: string;
  address: string;
  city: string;
  stateCode: string;
  stateName: string;
  pincode: string;
  gstRegistered: boolean;
  gstin?: string;
  invoicePrefix: string;
  expiryWarningDays: number;
  cashierMaxDiscountPct: number;
  roundOff: boolean;
  blockExpiredSales: boolean;
  footer: string;
  isDemo: boolean;
}

export interface AppData {
  version: number;
  anchor: string;
  business: Business;
  role: Role;
  locations: Location[];
  suppliers: Supplier[];
  customers: Customer[];
  products: Product[];
  batches: Batch[];
  balances: Balance[];
  movements: Movement[];
  invoices: Invoice[];
  payments: Payment[];
  purchases: Purchase[];
  orders: PurchaseOrder[];
  rescues: RescueEvent[];
  dismissed: string[];
  seq: { invoice: number; po: number };
}
