-- SmartStock AI — core schema
-- Money: numeric(14,2). Quantities: numeric(12,3) (supports kg / litre fractions). Unit costs: numeric(12,4).
-- Event timestamps: timestamptz. Reporting dates: explicit business-local `date` columns.

create type public.member_role as enum ('owner', 'manager', 'cashier', 'inventory');
create type public.business_type as enum ('kirana', 'grocery', 'pharmacy', 'general', 'other');
create type public.location_kind as enum ('shelf', 'backroom');
create type public.movement_type as enum (
  'opening', 'purchase', 'sale', 'sale_return', 'void_reversal', 'purchase_return',
  'adjustment', 'write_off', 'transfer_in', 'transfer_out', 'rescue_out'
);
create type public.sale_status as enum ('posted', 'voided');
create type public.payment_method as enum ('cash', 'upi', 'card', 'bank');
create type public.rescue_type as enum ('supplier_return', 'surplus_sale', 'discount', 'donation');
create type public.rescue_status as enum ('requested', 'listed', 'approved', 'confirmed', 'cancelled');
create type public.po_status as enum ('draft', 'ordered', 'received', 'cancelled');

-- ───────────────────────── Identity & business ─────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  business_type public.business_type not null default 'kirana',
  owner_name text,
  phone text,
  email text,
  address_line text,
  city text,
  state_code char(2) not null check (state_code ~ '^[0-9]{2}$'),
  pincode text check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
  gst_registered boolean not null default false,
  gstin text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  invoice_prefix text not null default 'INV' check (invoice_prefix ~ '^[A-Z0-9]{1,6}$'),
  timezone text not null default 'Asia/Kolkata',
  fy_start_month int not null default 4 check (fy_start_month between 1 and 12),
  low_stock_default numeric(12, 3) not null default 10 check (low_stock_default >= 0),
  expiry_warning_days int not null default 7 check (expiry_warning_days between 1 and 90),
  block_expired_sales boolean not null default true,
  round_off_invoices boolean not null default true,
  cashier_max_discount_pct numeric(5, 2) not null default 10 check (cashier_max_discount_pct between 0 and 100),
  receipt_footer text,
  is_demo boolean not null default false,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  constraint gstin_required check (not gst_registered or gstin is not null),
  constraint gstin_matches_state check (gstin is null or left(gstin, 2) = state_code)
);

create table public.business_memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);
create index on public.business_memberships (user_id);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index stores_one_default on public.stores (business_id) where is_default;

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  kind public.location_kind not null default 'shelf',
  block text not null check (length(btrim(block)) > 0),
  rack text,
  shelf text,
  created_at timestamptz not null default now()
);
create unique index locations_unique_path on public.locations (business_id, store_id, lower(block), lower(coalesce(rack, '')), lower(coalesce(shelf, '')));

-- ───────────────────────── Catalogue ─────────────────────────

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  default_gst_rate numeric(5, 2) not null default 0 check (default_gst_rate between 0 and 40),
  created_at timestamptz not null default now()
);
create unique index product_categories_name on public.product_categories (business_id, lower(name));

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  contact_person text,
  phone text,
  email text,
  gstin text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  state_code char(2) check (state_code is null or state_code ~ '^[0-9]{2}$'),
  address text,
  lead_time_days int not null default 2 check (lead_time_days between 0 and 90),
  accepts_returns boolean not null default true,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);
create unique index suppliers_name on public.suppliers (business_id, lower(name));

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  phone text check (phone is null or phone ~ '^[0-9+ -]{6,16}$'),
  email text,
  address text,
  state_code char(2) check (state_code is null or state_code ~ '^[0-9]{2}$'),
  gstin text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  credit_limit numeric(14, 2) check (credit_limit is null or credit_limit >= 0),
  credit_days int not null default 15 check (credit_days between 0 and 365),
  notes text,
  created_at timestamptz not null default now()
);
create unique index customers_phone on public.customers (business_id, phone) where phone is not null;
create index customers_name on public.customers (business_id, lower(name));

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 160),
  sku text not null check (length(btrim(sku)) between 1 and 40),
  barcode text check (barcode is null or barcode ~ '^[0-9A-Za-z-]{4,32}$'),
  category_id uuid references public.product_categories (id) on delete set null,
  brand text,
  description text,
  unit text not null default 'pcs' check (unit in ('pcs', 'pack', 'box', 'strip', 'bottle', 'dozen', 'kg', 'g', 'l', 'ml')),
  purchase_price numeric(12, 2) not null default 0 check (purchase_price >= 0),
  selling_price numeric(12, 2) not null check (selling_price > 0),
  mrp numeric(12, 2) check (mrp is null or mrp > 0),
  price_includes_tax boolean not null default true,
  gst_rate numeric(5, 2) not null default 0 check (gst_rate in (0, 0.25, 1.5, 3, 5, 12, 18, 28, 40)),
  cess_rate numeric(5, 2) not null default 0 check (cess_rate between 0 and 100),
  hsn_code text check (hsn_code is null or hsn_code ~ '^[0-9]{4,8}$'),
  min_stock numeric(12, 3) not null default 0 check (min_stock >= 0),
  supplier_id uuid references public.suppliers (id) on delete set null,
  default_location_id uuid references public.locations (id) on delete set null,
  track_batches boolean not null default false,
  track_expiry boolean not null default false,
  shelf_life_days int check (shelf_life_days is null or shelf_life_days > 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  visual jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index products_sku on public.products (business_id, lower(sku));
create unique index products_barcode on public.products (business_id, barcode) where barcode is not null;
create index products_name on public.products (business_id, lower(name));
create index products_category on public.products (category_id);

-- ───────────────────────── Inventory ─────────────────────────

-- A batch is a lot of one product with one cost (and optionally an expiry).
-- Products that are not batch-tracked receive hidden internal lots (is_internal) per receipt → FIFO costing.
create table public.product_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  product_id uuid not null references public.products (id),
  batch_code text not null check (length(btrim(batch_code)) between 1 and 40),
  expiry_date date,
  unit_cost numeric(12, 4) not null check (unit_cost >= 0),
  received_on date not null,
  supplier_id uuid references public.suppliers (id) on delete set null,
  is_internal boolean not null default false,
  markdown_pct numeric(5, 2) not null default 0 check (markdown_pct between 0 and 90),
  created_at timestamptz not null default now(),
  unique (product_id, batch_code)
);
create index product_batches_expiry on public.product_batches (business_id, expiry_date);

create table public.stock_balances (
  business_id uuid not null references public.businesses (id) on delete cascade,
  product_id uuid not null references public.products (id),
  batch_id uuid not null references public.product_batches (id),
  location_id uuid not null references public.locations (id),
  quantity numeric(12, 3) not null check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (batch_id, location_id)
);
create index stock_balances_product on public.stock_balances (business_id, product_id);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  product_id uuid not null references public.products (id),
  batch_id uuid not null references public.product_batches (id),
  location_id uuid not null references public.locations (id),
  movement_type public.movement_type not null,
  quantity numeric(12, 3) not null check (quantity <> 0),
  unit_cost numeric(12, 4) not null check (unit_cost >= 0),
  ref_type text,
  ref_id uuid,
  note text,
  business_date date not null,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);
create index stock_movements_date on public.stock_movements (business_id, business_date);
create index stock_movements_product on public.stock_movements (product_id, occurred_at desc);
create index stock_movements_batch on public.stock_movements (batch_id);

create table public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  product_id uuid not null references public.products (id),
  batch_id uuid not null references public.product_batches (id),
  location_id uuid not null references public.locations (id),
  quantity_change numeric(12, 3) not null check (quantity_change <> 0),
  reason text not null check (reason in ('count_correction', 'damaged', 'lost', 'expired', 'found', 'opening', 'other')),
  note text,
  business_date date not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- ───────────────────────── Sales ─────────────────────────

create table public.invoice_sequences (
  business_id uuid not null references public.businesses (id) on delete cascade,
  fy_label text not null,
  next_number int not null default 1 check (next_number > 0),
  primary key (business_id, fy_label)
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  store_id uuid not null references public.stores (id),
  invoice_number text not null,
  fy_label text not null,
  document_type text not null check (document_type in ('tax_invoice', 'bill_of_supply')),
  invoice_date date not null,
  posted_at timestamptz not null default now(),
  status public.sale_status not null default 'posted',
  customer_id uuid references public.customers (id),
  customer_name text,
  customer_phone text,
  customer_gstin text,
  place_of_supply char(2) not null,
  supply_type text not null check (supply_type in ('intra', 'inter')),
  items_count int not null check (items_count > 0),
  gross_amount numeric(14, 2) not null,
  discount_total numeric(14, 2) not null default 0 check (discount_total >= 0),
  taxable_total numeric(14, 2) not null,
  cgst_total numeric(14, 2) not null default 0,
  sgst_total numeric(14, 2) not null default 0,
  igst_total numeric(14, 2) not null default 0,
  cess_total numeric(14, 2) not null default 0,
  tax_total numeric(14, 2) not null default 0,
  round_off numeric(8, 2) not null default 0,
  grand_total numeric(14, 2) not null check (grand_total >= 0),
  amount_paid numeric(14, 2) not null default 0 check (amount_paid >= 0),
  amount_due numeric(14, 2) not null default 0 check (amount_due >= 0),
  cost_total numeric(14, 2) not null default 0,
  idempotency_key uuid not null,
  business_snapshot jsonb not null,
  notes text,
  created_by uuid references auth.users (id),
  voided_at timestamptz,
  voided_by uuid references auth.users (id),
  void_reason text,
  constraint sales_paid_le_total check (amount_paid <= grand_total),
  constraint sales_tax_parts check (tax_total = cgst_total + sgst_total + igst_total + cess_total),
  constraint sales_total_reconciles check (grand_total = taxable_total + tax_total + round_off),
  unique (business_id, invoice_number),
  unique (business_id, idempotency_key)
);
create index sales_date on public.sales (business_id, invoice_date desc);
create index sales_customer on public.sales (customer_id) where customer_id is not null;
create index sales_due on public.sales (business_id) where amount_due > 0;

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  line_no int not null,
  product_id uuid not null references public.products (id),
  product_name text not null,
  sku text not null,
  hsn_code text,
  unit text not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  price_includes_tax boolean not null,
  gst_rate numeric(5, 2) not null,
  cess_rate numeric(5, 2) not null default 0,
  gross numeric(14, 2) not null,
  line_discount numeric(14, 2) not null default 0 check (line_discount >= 0),
  invoice_discount_share numeric(14, 2) not null default 0 check (invoice_discount_share >= 0),
  taxable_value numeric(14, 2) not null,
  cgst numeric(14, 2) not null default 0,
  sgst numeric(14, 2) not null default 0,
  igst numeric(14, 2) not null default 0,
  cess numeric(14, 2) not null default 0,
  line_total numeric(14, 2) not null,
  cost_total numeric(14, 2) not null default 0,
  rescue_event_id uuid,
  unique (sale_id, line_no)
);
create index sale_items_product on public.sale_items (product_id);
create index sale_items_business on public.sale_items (business_id);

create table public.sale_item_allocations (
  id uuid primary key default gen_random_uuid(),
  sale_item_id uuid not null references public.sale_items (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  batch_id uuid not null references public.product_batches (id),
  location_id uuid not null references public.locations (id),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_cost numeric(12, 4) not null
);
create index sale_item_allocations_item on public.sale_item_allocations (sale_item_id);
create index sale_item_allocations_batch on public.sale_item_allocations (batch_id);

-- ───────────────────────── Purchasing ─────────────────────────

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  supplier_id uuid references public.suppliers (id),
  status public.po_status not null default 'draft',
  expected_date date,
  notes text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index purchase_orders_business on public.purchase_orders (business_id, status);

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  product_id uuid not null references public.products (id),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_cost numeric(12, 2) check (unit_cost is null or unit_cost >= 0),
  basis jsonb,
  unique (purchase_order_id, product_id)
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  store_id uuid not null references public.stores (id),
  supplier_id uuid not null references public.suppliers (id),
  bill_number text,
  bill_date date not null,
  supply_type text not null default 'intra' check (supply_type in ('intra', 'inter')),
  taxable_total numeric(14, 2) not null,
  tax_total numeric(14, 2) not null default 0,
  grand_total numeric(14, 2) not null check (grand_total >= 0),
  amount_paid numeric(14, 2) not null default 0 check (amount_paid >= 0),
  amount_due numeric(14, 2) not null default 0 check (amount_due >= 0),
  purchase_order_id uuid references public.purchase_orders (id) on delete set null,
  idempotency_key uuid not null,
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  constraint purchases_paid_le_total check (amount_paid <= grand_total),
  unique (business_id, idempotency_key)
);
create unique index purchases_bill_unique on public.purchases (business_id, supplier_id, lower(bill_number)) where bill_number is not null;
create index purchases_date on public.purchases (business_id, bill_date desc);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  product_id uuid not null references public.products (id),
  batch_id uuid not null references public.product_batches (id),
  location_id uuid not null references public.locations (id),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  gst_rate numeric(5, 2) not null default 0,
  taxable_value numeric(14, 2) not null,
  tax_amount numeric(14, 2) not null default 0,
  line_total numeric(14, 2) not null
);
create index purchase_items_purchase on public.purchase_items (purchase_id);

-- ───────────────────────── Payments & ledgers ─────────────────────────

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  kind text not null check (kind in ('sale_receipt', 'customer_repayment', 'supplier_payment', 'refund')),
  customer_id uuid references public.customers (id),
  supplier_id uuid references public.suppliers (id),
  method public.payment_method not null,
  amount numeric(14, 2) not null check (amount > 0),
  reference text,
  business_date date not null,
  paid_at timestamptz not null default now(),
  idempotency_key uuid,
  notes text,
  created_by uuid references auth.users (id)
);
create unique index payments_idempotency on public.payments (business_id, idempotency_key) where idempotency_key is not null;
create index payments_date on public.payments (business_id, business_date);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  payment_id uuid not null references public.payments (id) on delete cascade,
  sale_id uuid references public.sales (id),
  purchase_id uuid references public.purchases (id),
  amount numeric(14, 2) not null check (amount > 0),
  constraint allocation_target check ((sale_id is null) <> (purchase_id is null))
);
create unique index payment_allocations_sale on public.payment_allocations (payment_id, sale_id) where sale_id is not null;
create unique index payment_allocations_purchase on public.payment_allocations (payment_id, purchase_id) where purchase_id is not null;

-- Customer ledger: debit increases what the customer owes; credit reduces it.
create table public.customer_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id),
  entry_type text not null check (entry_type in ('sale', 'payment', 'void', 'refund')),
  debit numeric(14, 2) not null default 0 check (debit >= 0),
  credit numeric(14, 2) not null default 0 check (credit >= 0),
  sale_id uuid references public.sales (id),
  payment_id uuid references public.payments (id),
  business_date date not null,
  note text,
  created_at timestamptz not null default now(),
  constraint one_sided check ((debit = 0) <> (credit = 0))
);
create index customer_ledger_customer on public.customer_ledger_entries (customer_id, created_at);

-- Supplier ledger: credit increases what we owe the supplier; debit reduces it.
create table public.supplier_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id),
  entry_type text not null check (entry_type in ('purchase', 'payment', 'return')),
  debit numeric(14, 2) not null default 0 check (debit >= 0),
  credit numeric(14, 2) not null default 0 check (credit >= 0),
  purchase_id uuid references public.purchases (id),
  payment_id uuid references public.payments (id),
  purchase_return_id uuid,
  business_date date not null,
  note text,
  created_at timestamptz not null default now(),
  constraint one_sided check ((debit = 0) <> (credit = 0))
);
create index supplier_ledger_supplier on public.supplier_ledger_entries (supplier_id, created_at);

-- ───────────────────────── Stock rescue ─────────────────────────

create table public.rescue_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  rescue_type public.rescue_type not null,
  status public.rescue_status not null,
  product_id uuid not null references public.products (id),
  batch_id uuid not null references public.product_batches (id),
  supplier_id uuid references public.suppliers (id),
  customer_id uuid references public.customers (id),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_cost numeric(12, 4) not null,
  offer_price numeric(12, 2) check (offer_price is null or offer_price > 0),
  discount_pct numeric(5, 2) check (discount_pct is null or discount_pct between 1 and 90),
  confirmed_quantity numeric(12, 3) not null default 0 check (confirmed_quantity >= 0),
  recovered_value numeric(14, 2) not null default 0 check (recovered_value >= 0),
  reason text,
  counterparty text,
  sale_id uuid references public.sales (id),
  requested_by uuid references auth.users (id),
  confirmed_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  business_date date not null
);
create index rescue_events_business on public.rescue_events (business_id, status);
create unique index rescue_one_active_discount on public.rescue_events (batch_id)
  where rescue_type = 'discount' and status in ('requested', 'approved');

alter table public.sale_items
  add constraint sale_items_rescue_fk foreign key (rescue_event_id) references public.rescue_events (id);

create table public.purchase_returns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id),
  product_id uuid not null references public.products (id),
  batch_id uuid not null references public.product_batches (id),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_cost numeric(12, 4) not null,
  value numeric(14, 2) not null,
  reason text,
  rescue_event_id uuid references public.rescue_events (id),
  business_date date not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
alter table public.supplier_ledger_entries
  add constraint supplier_ledger_return_fk foreign key (purchase_return_id) references public.purchase_returns (id);

-- ───────────────────────── Alerts & audit ─────────────────────────

-- Alerts are computed live from records; a dismissal is persisted against the alert's state key,
-- so the alert re-appears automatically when its underlying state changes.
create table public.alert_states (
  business_id uuid not null references public.businesses (id) on delete cascade,
  alert_key text not null,
  status text not null check (status in ('dismissed', 'snoozed')),
  snoozed_until date,
  acted_by uuid not null references auth.users (id) default auth.uid(),
  acted_at timestamptz not null default now(),
  primary key (business_id, alert_key)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  actor uuid references auth.users (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_business on public.audit_logs (business_id, created_at desc);

-- ───────────────────────── Housekeeping triggers ─────────────────────────

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger purchase_orders_touch before update on public.purchase_orders
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'phone', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
