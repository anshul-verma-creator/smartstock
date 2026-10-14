-- SmartStock AI — reporting views and functions
-- All report functions read stored snapshots (never recompute tax) and run as the caller (RLS applies),
-- except product_daily_sales which exposes only quantities to every member for forecasting.

create or replace view public.product_stock with (security_invoker = true) as
select sb.business_id, sb.product_id,
       sum(sb.quantity) as quantity,
       sum(sb.quantity) filter (where l.kind = 'shelf') as shelf_quantity,
       sum(sb.quantity) filter (where l.kind = 'backroom') as backroom_quantity,
       sum(sb.quantity * pb.unit_cost) as stock_value
from public.stock_balances sb
join public.product_batches pb on pb.id = sb.batch_id
join public.locations l on l.id = sb.location_id
group by sb.business_id, sb.product_id;

create or replace view public.customer_balances with (security_invoker = true) as
select business_id, customer_id, sum(debit - credit) as balance, max(business_date) as last_activity
from public.customer_ledger_entries group by business_id, customer_id;

create or replace view public.supplier_balances with (security_invoker = true) as
select business_id, supplier_id, sum(credit - debit) as balance, max(business_date) as last_activity
from public.supplier_ledger_entries group by business_id, supplier_id;

-- Net sales = posted (non-voided) invoices. Voided invoices are excluded from the day they were issued.
create or replace function public.report_sales_daily(p_business uuid, p_from date, p_to date)
returns table (day date, invoices bigint, voided bigint, gross numeric, discount numeric, taxable numeric, tax numeric,
               total numeric, cost numeric, collected_at_sale numeric, credit numeric)
language sql stable security invoker set search_path = public, pg_temp as $$
  select s.invoice_date,
         count(*) filter (where s.status = 'posted'),
         count(*) filter (where s.status = 'voided'),
         coalesce(sum(s.gross_amount) filter (where s.status = 'posted'), 0),
         coalesce(sum(s.discount_total) filter (where s.status = 'posted'), 0),
         coalesce(sum(s.taxable_total) filter (where s.status = 'posted'), 0),
         coalesce(sum(s.tax_total) filter (where s.status = 'posted'), 0),
         coalesce(sum(s.grand_total) filter (where s.status = 'posted'), 0),
         coalesce(sum(s.cost_total) filter (where s.status = 'posted'), 0),
         coalesce(sum(r.amt) filter (where s.status = 'posted'), 0),
         coalesce(sum(s.grand_total - r.amt) filter (where s.status = 'posted'), 0)
  from sales s
  left join lateral (
    select coalesce(sum(pa.amount), 0) as amt from payment_allocations pa join payments p on p.id = pa.payment_id
    where pa.sale_id = s.id and p.kind = 'sale_receipt'
  ) r on true
  where s.business_id = p_business and s.invoice_date between p_from and p_to
  group by s.invoice_date order by s.invoice_date;
$$;

create or replace function public.report_product_sales(p_business uuid, p_from date, p_to date)
returns table (product_id uuid, product_name text, unit text, quantity numeric, revenue numeric, total_with_tax numeric,
               cost numeric, gross_profit numeric, invoices bigint)
language sql stable security invoker set search_path = public, pg_temp as $$
  select si.product_id, max(si.product_name), max(si.unit), sum(si.quantity), sum(si.taxable_value), sum(si.line_total),
         sum(si.cost_total), sum(si.taxable_value - si.cost_total), count(distinct si.sale_id)
  from sale_items si join sales s on s.id = si.sale_id
  where s.business_id = p_business and s.status = 'posted' and s.invoice_date between p_from and p_to
  group by si.product_id;
$$;

create or replace function public.report_category_sales(p_business uuid, p_from date, p_to date)
returns table (category text, revenue numeric, cost numeric, quantity numeric)
language sql stable security invoker set search_path = public, pg_temp as $$
  select coalesce(c.name, 'Uncategorised'), sum(si.taxable_value), sum(si.cost_total), sum(si.quantity)
  from sale_items si join sales s on s.id = si.sale_id
  join products p on p.id = si.product_id left join product_categories c on c.id = p.category_id
  where s.business_id = p_business and s.status = 'posted' and s.invoice_date between p_from and p_to
  group by 1 order by 2 desc;
$$;

-- Quantities only — available to every member (inventory staff need it for reorder planning).
create or replace function public.product_daily_sales(p_business uuid, p_from date, p_to date)
returns table (product_id uuid, day date, quantity numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not has_role(p_business) then perform _err('FORBIDDEN', 'Not a member of this business.'); end if;
  return query
    select si.product_id, s.invoice_date, sum(si.quantity)
    from sale_items si join sales s on s.id = si.sale_id
    where s.business_id = p_business and s.status = 'posted' and s.invoice_date between p_from and p_to
    group by 1, 2;
end $$;

create or replace function public.report_collections(p_business uuid, p_from date, p_to date)
returns table (kind text, direction text, method payment_method, amount numeric, payments bigint)
language sql stable security invoker set search_path = public, pg_temp as $$
  select kind, direction, method, sum(amount), count(*) from payments
  where business_id = p_business and business_date between p_from and p_to group by 1, 2, 3 order by 1, 2, 3;
$$;

create or replace function public.report_tax_summary(p_business uuid, p_from date, p_to date)
returns table (gst_rate numeric, supply_type text, invoices bigint, taxable numeric, cgst numeric, sgst numeric,
               igst numeric, cess numeric, total numeric)
language sql stable security invoker set search_path = public, pg_temp as $$
  select si.gst_rate, s.supply_type, count(distinct s.id), sum(si.taxable_value), sum(si.cgst), sum(si.sgst),
         sum(si.igst), sum(si.cess), sum(si.line_total)
  from sale_items si join sales s on s.id = si.sale_id
  where s.business_id = p_business and s.status = 'posted' and s.invoice_date between p_from and p_to
  group by 1, 2 order by 1, 2;
$$;

create or replace function public.report_purchase_tax(p_business uuid, p_from date, p_to date)
returns table (gst_rate numeric, taxable numeric, tax numeric, total numeric)
language sql stable security invoker set search_path = public, pg_temp as $$
  select pi.gst_rate, sum(pi.taxable_value), sum(pi.tax_amount), sum(pi.line_total)
  from purchase_items pi join purchases p on p.id = pi.purchase_id
  where p.business_id = p_business and p.bill_date between p_from and p_to group by 1 order by 1;
$$;

-- Closing = Opening + Purchased + Sales returns − Sold − Purchase returns + Adjustments − Write-offs.
-- Adjustments are signed (+ adds stock). Write-offs include damaged/lost/expired and donations (positive numbers).
-- Transfers move stock between locations and net to zero per product.
create or replace function public.report_stock_reconciliation(p_business uuid, p_from date, p_to date)
returns table (product_id uuid, product_name text, sku text, unit text,
               opening numeric, purchased numeric, sold numeric, sales_returns numeric, purchase_returns numeric,
               adjustments numeric, write_offs numeric, closing numeric, opening_value numeric, closing_value numeric)
language sql stable security invoker set search_path = public, pg_temp as $$
  with m as (
    select product_id,
      coalesce(sum(quantity) filter (where business_date < p_from), 0) as opening,
      coalesce(sum(quantity) filter (where business_date between p_from and p_to and movement_type = 'purchase'), 0) as purchased,
      coalesce(-sum(quantity) filter (where business_date between p_from and p_to and movement_type = 'sale'), 0) as sold,
      coalesce(sum(quantity) filter (where business_date between p_from and p_to and movement_type in ('sale_return', 'void_reversal')), 0) as sales_returns,
      coalesce(-sum(quantity) filter (where business_date between p_from and p_to and movement_type = 'purchase_return'), 0) as purchase_returns,
      coalesce(sum(quantity) filter (where business_date between p_from and p_to and movement_type in ('adjustment', 'opening')), 0) as adjustments,
      coalesce(-sum(quantity) filter (where business_date between p_from and p_to and movement_type in ('write_off', 'rescue_out')), 0) as write_offs,
      coalesce(sum(quantity) filter (where business_date <= p_to), 0) as closing,
      coalesce(sum(quantity * unit_cost) filter (where business_date < p_from), 0) as opening_value,
      coalesce(sum(quantity * unit_cost) filter (where business_date <= p_to), 0) as closing_value
    from stock_movements where business_id = p_business group by product_id
  )
  select p.id, p.name, p.sku, p.unit, m.opening, m.purchased, m.sold, m.sales_returns, m.purchase_returns,
         m.adjustments, m.write_offs, m.closing, round(m.opening_value, 2), round(m.closing_value, 2)
  from m join products p on p.id = m.product_id
  order by p.name;
$$;

-- Recovery from stock rescue, counted once per unit: supplier-return credits, revenue (net of tax) of
-- sale lines tagged with a rescue event (surplus sales + approved discounts), and donated units (₹0).
create or replace function public.report_rescue(p_business uuid, p_from date, p_to date)
returns table (rescue_type text, events bigint, units numeric, recovered numeric)
language sql stable security invoker set search_path = public, pg_temp as $$
  select 'supplier_return', count(distinct pr.rescue_event_id), coalesce(sum(pr.quantity), 0), coalesce(sum(pr.value), 0)
  from purchase_returns pr where pr.business_id = p_business and pr.rescue_event_id is not null and pr.business_date between p_from and p_to
  union all
  select r.rescue_type::text, count(distinct r.id), coalesce(sum(si.quantity), 0), coalesce(sum(si.taxable_value), 0)
  from sale_items si join sales s on s.id = si.sale_id join rescue_events r on r.id = si.rescue_event_id
  where s.business_id = p_business and s.status = 'posted' and s.invoice_date between p_from and p_to
  group by r.rescue_type
  union all
  select 'donation', count(*), coalesce(sum(confirmed_quantity), 0), 0
  from rescue_events where business_id = p_business and rescue_type = 'donation' and status = 'confirmed'
    and business_date between p_from and p_to;
$$;
