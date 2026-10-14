-- SmartStock AI — trusted posting functions
-- Public RPCs authenticate (auth.uid()), authorise (membership + role) and delegate to internal `_` functions.
-- Internal functions take an explicit user + business date so the demo seeder can replay history through
-- exactly the same code path. Internal functions are NOT executable by API roles (see final grants).

-- ───────────────────────── helpers ─────────────────────────

create or replace function public._err(p_code text, p_message text) returns void
language plpgsql as $$
begin
  raise exception using message = p_message, hint = p_code, errcode = 'P0001';
end $$;

create or replace function public._role_of(p_business uuid, p_user uuid) returns public.member_role
language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.business_memberships where business_id = p_business and user_id = p_user;
$$;

create or replace function public._business_date(p_business uuid) returns date
language sql stable security definer set search_path = public, pg_temp as $$
  select (now() at time zone b.timezone)::date from public.businesses b where b.id = p_business;
$$;

create or replace function public._fy_label(p_business uuid, p_date date) returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare m int; y int;
begin
  select fy_start_month into m from businesses where id = p_business;
  if m = 1 then return extract(year from p_date)::int::text; end if;
  y := case when extract(month from p_date)::int >= m then extract(year from p_date)::int else extract(year from p_date)::int - 1 end;
  return y::text || '-' || lpad(((y + 1) % 100)::text, 2, '0');
end $$;

create or replace function public._audit(p_business uuid, p_user uuid, p_action text, p_entity text, p_id uuid, p_details jsonb)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.audit_logs (business_id, actor, action, entity_type, entity_id, details)
  values (p_business, p_user, p_action, p_entity, p_id, p_details);
$$;

create or replace function public._default_location(p_business uuid, p_kind public.location_kind) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select id from public.locations where business_id = p_business
  order by (kind = p_kind) desc, created_at limit 1;
$$;

-- The only place stock_balances changes. Writes the movement and the balance in the same transaction.
create or replace function public._move_stock(
  p_business uuid, p_product uuid, p_batch uuid, p_location uuid, p_type public.movement_type,
  p_qty numeric, p_unit_cost numeric, p_ref_type text, p_ref_id uuid, p_note text,
  p_date date, p_user uuid, p_at timestamptz default now()
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_name text; v_have numeric;
begin
  if p_qty = 0 then return; end if;
  if p_qty > 0 then
    insert into stock_balances (business_id, product_id, batch_id, location_id, quantity, updated_at)
    values (p_business, p_product, p_batch, p_location, p_qty, p_at)
    on conflict (batch_id, location_id) do update
      set quantity = stock_balances.quantity + excluded.quantity, updated_at = excluded.updated_at;
  else
    update stock_balances set quantity = quantity + p_qty, updated_at = p_at
    where batch_id = p_batch and location_id = p_location and quantity + p_qty >= 0;
    if not found then
      select name into v_name from products where id = p_product;
      select coalesce(sum(quantity), 0) into v_have from stock_balances where batch_id = p_batch and location_id = p_location;
      perform _err('INSUFFICIENT_STOCK', format('Not enough stock of %s at that location (have %s, need %s).', v_name, v_have, -p_qty));
    end if;
  end if;
  insert into stock_movements (business_id, product_id, batch_id, location_id, movement_type, quantity, unit_cost,
                               ref_type, ref_id, note, business_date, occurred_at, created_by)
  values (p_business, p_product, p_batch, p_location, p_type, p_qty, p_unit_cost, p_ref_type, p_ref_id, p_note, p_date, p_at, p_user);
end $$;

-- ───────────────────────── GST engine (authoritative) ─────────────────────────
-- Mirrored exactly by src/lib/tax.ts (live preview). Rounding: half away from zero to 2 dp.
--  exclusive: taxable = net; gst = round(taxable*r%); cess = round(taxable*c%); total = taxable+gst+cess
--  inclusive: taxable = round(net*100/(100+r+c)); cess = round(taxable*c%); gst = net-taxable-cess; total = net
--  intra-state: cgst = round(gst/2), sgst = gst-cgst.  inter-state: igst = gst.
--  unregistered seller: no GST is charged (rates treated as 0).
create or replace function public.calc_tax_line(
  p_gross numeric, p_discount numeric, p_includes_tax boolean, p_gst_rate numeric, p_cess_rate numeric,
  p_inter boolean, p_tax_applicable boolean
) returns table (taxable numeric, cgst numeric, sgst numeric, igst numeric, cess numeric, line_total numeric)
language plpgsql immutable as $$
declare
  n numeric := round(p_gross - p_discount, 2);
  r numeric := case when p_tax_applicable then p_gst_rate else 0 end;
  c numeric := case when p_tax_applicable then p_cess_rate else 0 end;
  g numeric;
begin
  if n < 0 then perform public._err('VALIDATION', 'Discount cannot exceed the line amount.'); end if;
  if p_includes_tax then
    taxable := round(n * 100 / (100 + r + c), 2);
    cess := round(taxable * c / 100, 2);
    g := n - taxable - cess;
    line_total := n;
  else
    taxable := n;
    g := round(taxable * r / 100, 2);
    cess := round(taxable * c / 100, 2);
    line_total := taxable + g + cess;
  end if;
  if p_inter then
    igst := g; cgst := 0; sgst := 0;
  else
    cgst := round(g / 2, 2); sgst := g - cgst; igst := 0;
  end if;
  return next;
end $$;

-- ───────────────────────── SALE POSTING ─────────────────────────

create or replace function public._post_sale(
  p_business uuid, p_user uuid, p_key uuid, p_payload jsonb, p_date date, p_at timestamptz, p_internal boolean default false
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  b businesses%rowtype;
  v_role member_role;
  v_existing record;
  v_sale_id uuid := gen_random_uuid();
  v_store uuid;
  v_cust customers%rowtype;
  v_has_customer boolean := false;
  v_pos text;
  v_inter boolean;
  v_lines jsonb := coalesce(p_payload -> 'lines', '[]'::jsonb);
  v_n int;
  v_line jsonb;
  v_prod products%rowtype;
  v_ev rescue_events%rowtype;
  v_qty numeric; v_price numeric; v_gross numeric; v_disc numeric; v_base numeric; v_max_base numeric := -1;
  a_prod uuid[] := '{}'; a_qty numeric[] := '{}'; a_price numeric[] := '{}'; a_gross numeric[] := '{}';
  a_disc numeric[] := '{}'; a_batch uuid[] := '{}'; a_rescue uuid[] := '{}'; a_share numeric[] := '{}';
  v_inv_disc numeric := round(coalesce(nullif(p_payload ->> 'invoice_discount', '')::numeric, 0), 2);
  v_total_base numeric := 0; v_gross_total numeric := 0; v_manual_disc numeric := 0;
  v_max_i int := 1; v_alloc numeric := 0;
  i int;
  t record; r record;
  v_item_id uuid;
  v_need numeric; v_take numeric; v_cost numeric; v_available numeric; v_expired numeric;
  s_taxable numeric := 0; s_cgst numeric := 0; s_sgst numeric := 0; s_igst numeric := 0; s_cess numeric := 0;
  s_lines numeric := 0; s_cost numeric := 0; s_disc numeric := 0;
  v_grand numeric; v_round numeric;
  v_fy text; v_seq int; v_invoice text;
  v_pay jsonb; v_paid numeric := 0; v_amt numeric; v_pay_id uuid; v_method text;
  v_settle text := nullif(p_payload ->> 'settle_method', '');
  v_outstanding numeric;
begin
  select * into b from businesses where id = p_business;
  if not found then perform _err('NOT_FOUND', 'Business not found.'); end if;
  v_role := _role_of(p_business, p_user);
  if v_role is null or v_role not in ('owner', 'manager', 'cashier') then
    perform _err('FORBIDDEN', 'You do not have permission to create bills.');
  end if;
  if p_key is null then perform _err('VALIDATION', 'Missing idempotency key.'); end if;

  -- Idempotency: serialise on (business, key); a retry returns the already-posted invoice.
  perform pg_advisory_xact_lock(hashtextextended(p_business::text || ':' || p_key::text, 0));
  select id, invoice_number, grand_total, amount_due into v_existing
  from sales where business_id = p_business and idempotency_key = p_key;
  if found then
    return jsonb_build_object('sale_id', v_existing.id, 'invoice_number', v_existing.invoice_number,
      'grand_total', v_existing.grand_total, 'amount_due', v_existing.amount_due, 'replayed', true);
  end if;

  if jsonb_typeof(v_lines) <> 'array' then perform _err('VALIDATION', 'Invalid bill lines.'); end if;
  v_n := jsonb_array_length(v_lines);
  if v_n = 0 then perform _err('VALIDATION', 'Add at least one item to the bill.'); end if;
  if v_n > 200 then perform _err('VALIDATION', 'A bill can have at most 200 lines.'); end if;
  if v_inv_disc < 0 then perform _err('VALIDATION', 'Bill discount cannot be negative.'); end if;

  if nullif(p_payload ->> 'customer_id', '') is not null then
    select * into v_cust from customers where id = (p_payload ->> 'customer_id')::uuid and business_id = p_business;
    if not found then perform _err('VALIDATION', 'The selected customer was not found.'); end if;
    v_has_customer := true;
  end if;

  v_pos := coalesce(nullif(p_payload ->> 'place_of_supply', ''),
                    case when v_has_customer and v_cust.gstin is not null then v_cust.state_code end,
                    b.state_code);
  if v_pos !~ '^[0-9]{2}$' then perform _err('VALIDATION', 'Place of supply must be a 2-digit GST state code.'); end if;
  v_inter := v_pos <> b.state_code;

  -- Pass 1: validate lines, resolve authoritative prices and discounts.
  for i in 0 .. v_n - 1 loop
    v_line := v_lines -> i;
    select * into v_prod from products where id = nullif(v_line ->> 'product_id', '')::uuid and business_id = p_business;
    if not found then perform _err('VALIDATION', 'A product in the bill no longer exists.'); end if;
    if v_prod.status <> 'active' then perform _err('VALIDATION', format('%s is inactive and cannot be sold.', v_prod.name)); end if;
    v_qty := nullif(v_line ->> 'quantity', '')::numeric;
    if v_qty is null or v_qty <= 0 then perform _err('VALIDATION', format('Enter a quantity above zero for %s.', v_prod.name)); end if;
    if round(v_qty, 3) <> v_qty then perform _err('VALIDATION', format('Quantity for %s can have at most 3 decimals.', v_prod.name)); end if;
    if v_prod.unit in ('pcs', 'pack', 'box', 'strip', 'bottle', 'dozen') and v_qty <> trunc(v_qty) then
      perform _err('VALIDATION', format('%s is sold in whole %s.', v_prod.name, v_prod.unit));
    end if;

    v_price := v_prod.selling_price;
    v_disc := round(coalesce(nullif(v_line ->> 'line_discount', '')::numeric, 0), 2);
    a_batch := a_batch || nullif(v_line ->> 'batch_id', '')::uuid;

    if nullif(v_line ->> 'rescue_event_id', '') is not null then
      select * into v_ev from rescue_events where id = (v_line ->> 'rescue_event_id')::uuid and business_id = p_business;
      if not found or v_ev.product_id <> v_prod.id then perform _err('VALIDATION', 'Invalid rescue offer on the bill.'); end if;
      if v_ev.rescue_type = 'discount' and v_ev.status = 'approved' then
        v_disc := round(round(v_qty * v_price, 2) * v_ev.discount_pct / 100, 2);
      elsif v_ev.rescue_type = 'surplus_sale' and p_internal then
        v_price := v_ev.offer_price;
        v_disc := 0;
      else
        perform _err('VALIDATION', format('The rescue offer for %s is no longer active.', v_prod.name));
      end if;
      a_batch[i + 1] := v_ev.batch_id;
      a_rescue := a_rescue || v_ev.id;
    else
      a_rescue := a_rescue || null::uuid;
      v_manual_disc := v_manual_disc + v_disc;
    end if;

    if a_batch[i + 1] is not null and not exists (select 1 from product_batches where id = a_batch[i + 1] and product_id = v_prod.id) then
      perform _err('VALIDATION', format('Selected batch does not belong to %s.', v_prod.name));
    end if;

    v_gross := round(v_qty * v_price, 2);
    if v_disc < 0 or v_disc > v_gross then perform _err('VALIDATION', format('Discount on %s cannot exceed its amount.', v_prod.name)); end if;
    v_base := v_gross - v_disc;
    a_prod := a_prod || v_prod.id; a_qty := a_qty || v_qty; a_price := a_price || v_price;
    a_gross := a_gross || v_gross; a_disc := a_disc || v_disc;
    v_total_base := v_total_base + v_base; v_gross_total := v_gross_total + v_gross;
    if v_base > v_max_base then v_max_base := v_base; v_max_i := i + 1; end if;
  end loop;

  if v_inv_disc > v_total_base then perform _err('VALIDATION', 'Bill discount cannot exceed the bill amount.'); end if;
  v_manual_disc := v_manual_disc + v_inv_disc;
  if v_role = 'cashier' and v_gross_total > 0 and v_manual_disc * 100 / v_gross_total > b.cashier_max_discount_pct + 0.005 then
    perform _err('DISCOUNT_LIMIT', format('Cashiers can give at most %s%% discount. Ask a manager to approve a larger discount.', b.cashier_max_discount_pct));
  end if;

  -- Invoice discount allocation: proportional to (gross - line discount); the largest line absorbs rounding.
  for i in 1 .. v_n loop
    if i = v_max_i or v_total_base = 0 then
      a_share := a_share || 0::numeric;
    else
      a_share := a_share || round(v_inv_disc * (a_gross[i] - a_disc[i]) / v_total_base, 2);
      v_alloc := v_alloc + a_share[i];
    end if;
  end loop;
  a_share[v_max_i] := v_inv_disc - v_alloc;

  -- Invoice number: row lock on the sequence serialises numbering; rolled back with the sale on failure (no gaps).
  v_fy := _fy_label(p_business, p_date);
  insert into invoice_sequences (business_id, fy_label) values (p_business, v_fy) on conflict do nothing;
  update invoice_sequences set next_number = next_number + 1
  where business_id = p_business and fy_label = v_fy returning next_number - 1 into v_seq;
  v_invoice := b.invoice_prefix || '/' ||
    case when length(v_fy) = 7 then substr(v_fy, 3, 2) || substr(v_fy, 6, 2) else substr(v_fy, 3, 2) end
    || '/' || lpad(v_seq::text, 5, '0');

  select id into v_store from stores where business_id = p_business and is_default;

  insert into sales (id, business_id, store_id, invoice_number, fy_label, document_type, invoice_date, posted_at,
    customer_id, customer_name, customer_phone, customer_gstin, place_of_supply, supply_type, items_count,
    gross_amount, taxable_total, grand_total, idempotency_key, business_snapshot, notes, created_by)
  values (v_sale_id, p_business, v_store, v_invoice, v_fy,
    case when b.gst_registered then 'tax_invoice' else 'bill_of_supply' end, p_date, p_at,
    v_cust.id, v_cust.name, v_cust.phone, v_cust.gstin, v_pos, case when v_inter then 'inter' else 'intra' end, v_n,
    0, 0, 0, p_key,
    jsonb_build_object('name', b.name, 'address_line', b.address_line, 'city', b.city, 'state_code', b.state_code,
      'pincode', b.pincode, 'phone', b.phone, 'gstin', b.gstin, 'gst_registered', b.gst_registered, 'footer', b.receipt_footer),
    nullif(p_payload ->> 'notes', ''), p_user);

  -- Pass 2: tax snapshot, FEFO batch allocation, stock movements.
  for i in 1 .. v_n loop
    select * into v_prod from products where id = a_prod[i];
    select * into t from calc_tax_line(a_gross[i], a_disc[i] + a_share[i], v_prod.price_includes_tax,
                                       v_prod.gst_rate, v_prod.cess_rate, v_inter, b.gst_registered);

    insert into sale_items (sale_id, business_id, line_no, product_id, product_name, sku, hsn_code, unit, quantity,
      unit_price, price_includes_tax, gst_rate, cess_rate, gross, line_discount, invoice_discount_share,
      taxable_value, cgst, sgst, igst, cess, line_total, rescue_event_id)
    values (v_sale_id, p_business, i, v_prod.id, v_prod.name, v_prod.sku, v_prod.hsn_code, v_prod.unit, a_qty[i],
      a_price[i], v_prod.price_includes_tax,
      case when b.gst_registered then v_prod.gst_rate else 0 end, case when b.gst_registered then v_prod.cess_rate else 0 end,
      a_gross[i], a_disc[i], a_share[i], t.taxable, t.cgst, t.sgst, t.igst, t.cess, t.line_total, a_rescue[i])
    returning id into v_item_id;

    v_need := a_qty[i];
    v_cost := 0;
    for r in
      select sb.batch_id, sb.location_id, sb.quantity, pb.unit_cost
      from stock_balances sb
      join product_batches pb on pb.id = sb.batch_id
      join locations l on l.id = sb.location_id
      where sb.product_id = a_prod[i] and sb.quantity > 0
        and (a_batch[i] is null or sb.batch_id = a_batch[i])
        and (not b.block_expired_sales or pb.expiry_date is null or pb.expiry_date >= p_date)
      order by pb.expiry_date asc nulls last, pb.received_on, pb.created_at, (l.kind = 'backroom'), l.block, l.rack, l.shelf
      for update of sb
    loop
      exit when v_need <= 0;
      v_take := least(v_need, r.quantity);
      insert into sale_item_allocations (sale_item_id, business_id, batch_id, location_id, quantity, unit_cost)
      values (v_item_id, p_business, r.batch_id, r.location_id, v_take, r.unit_cost);
      perform _move_stock(p_business, a_prod[i], r.batch_id, r.location_id, 'sale', -v_take, r.unit_cost,
                          'sale', v_sale_id, v_invoice, p_date, p_user, p_at);
      v_cost := v_cost + v_take * r.unit_cost;
      v_need := v_need - v_take;
    end loop;

    if v_need > 0 then
      select coalesce(sum(sb.quantity) filter (where pb.expiry_date is null or pb.expiry_date >= p_date), 0),
             coalesce(sum(sb.quantity) filter (where pb.expiry_date < p_date), 0)
      into v_available, v_expired
      from stock_balances sb join product_batches pb on pb.id = sb.batch_id
      where sb.product_id = a_prod[i] and (a_batch[i] is null or sb.batch_id = a_batch[i]);
      if b.block_expired_sales and v_expired > 0 and v_available < a_qty[i] then
        perform _err('INSUFFICIENT_STOCK', format('Only %s %s of %s can be sold; %s %s are expired and blocked from sale.',
          v_available, v_prod.unit, v_prod.name, v_expired, v_prod.unit));
      end if;
      perform _err('INSUFFICIENT_STOCK', format('Not enough stock for %s: %s %s available, %s requested.',
        v_prod.name, v_available, v_prod.unit, a_qty[i]));
    end if;

    v_cost := round(v_cost, 2);
    update sale_items set cost_total = v_cost where id = v_item_id;
    if a_rescue[i] is not null then
      update rescue_events
      set confirmed_quantity = confirmed_quantity + a_qty[i], recovered_value = recovered_value + t.taxable
      where id = a_rescue[i] and rescue_type = 'discount';
    end if;

    s_taxable := s_taxable + t.taxable; s_cgst := s_cgst + t.cgst; s_sgst := s_sgst + t.sgst;
    s_igst := s_igst + t.igst; s_cess := s_cess + t.cess; s_lines := s_lines + t.line_total;
    s_cost := s_cost + v_cost; s_disc := s_disc + a_disc[i] + a_share[i];
  end loop;

  v_grand := case when b.round_off_invoices then round(s_lines, 0) else s_lines end;
  v_round := v_grand - s_lines;

  if nullif(p_payload ->> 'expected_total', '') is not null and (p_payload ->> 'expected_total')::numeric <> v_grand then
    perform _err('TOTAL_MISMATCH', format('Prices changed since the bill was prepared. The correct total is ₹%s — please review the cart.', v_grand));
  end if;

  if v_has_customer and v_grand > 0 then
    insert into customer_ledger_entries (business_id, customer_id, entry_type, debit, sale_id, business_date, note, created_at)
    values (p_business, v_cust.id, 'sale', v_grand, v_sale_id, p_date, v_invoice, p_at);
  end if;

  -- Payments recorded at the counter, allocated to this invoice.
  for v_pay in select value from jsonb_array_elements(coalesce(p_payload -> 'payments', '[]'::jsonb))
             union all select jsonb_build_object('method', v_settle, 'amount', null) where v_settle is not null
  loop
    v_method := v_pay ->> 'method';
    if v_method not in ('cash', 'upi', 'card', 'bank') then perform _err('VALIDATION', 'Unknown payment method.'); end if;
    v_amt := case when v_pay ->> 'amount' is null then v_grand - v_paid else round((v_pay ->> 'amount')::numeric, 2) end;
    continue when v_pay ->> 'amount' is null and v_amt <= 0;
    if v_amt is null or v_amt <= 0 then perform _err('VALIDATION', 'Each payment amount must be greater than zero.'); end if;
    insert into payments (business_id, direction, kind, customer_id, method, amount, reference, business_date, paid_at, created_by)
    values (p_business, 'in', 'sale_receipt', v_cust.id, v_method::payment_method, v_amt, nullif(v_pay ->> 'reference', ''), p_date, p_at, p_user)
    returning id into v_pay_id;
    insert into payment_allocations (business_id, payment_id, sale_id, amount) values (p_business, v_pay_id, v_sale_id, v_amt);
    if v_has_customer then
      insert into customer_ledger_entries (business_id, customer_id, entry_type, credit, sale_id, payment_id, business_date, note, created_at)
      values (p_business, v_cust.id, 'payment', v_amt, v_sale_id, v_pay_id, p_date, v_invoice, p_at);
    end if;
    v_paid := v_paid + v_amt;
  end loop;

  if v_paid > v_grand then
    perform _err('VALIDATION', format('Payments (₹%s) are more than the bill total (₹%s). Record only the amount applied to the bill.', v_paid, v_grand));
  end if;
  if v_grand - v_paid > 0 then
    if not v_has_customer then
      perform _err('CREDIT_REQUIRES_CUSTOMER', 'Select a customer to record an unpaid (pay later) amount.');
    end if;
    if v_cust.credit_limit is not null then
      select coalesce(sum(amount_due), 0) into v_outstanding from sales
      where customer_id = v_cust.id and status = 'posted' and id <> v_sale_id;
      if v_outstanding + (v_grand - v_paid) > v_cust.credit_limit then
        perform _err('CREDIT_LIMIT', format('%s would exceed the credit limit of ₹%s (current dues ₹%s).', v_cust.name, v_cust.credit_limit, v_outstanding));
      end if;
    end if;
  end if;

  update sales set
    gross_amount = v_gross_total, discount_total = s_disc, taxable_total = s_taxable,
    cgst_total = s_cgst, sgst_total = s_sgst, igst_total = s_igst, cess_total = s_cess,
    tax_total = s_cgst + s_sgst + s_igst + s_cess, round_off = v_round, grand_total = v_grand,
    amount_paid = v_paid, amount_due = v_grand - v_paid, cost_total = s_cost
  where id = v_sale_id;

  perform _audit(p_business, p_user, 'sale.posted', 'sale', v_sale_id,
    jsonb_build_object('invoice_number', v_invoice, 'grand_total', v_grand, 'paid', v_paid));

  return jsonb_build_object('sale_id', v_sale_id, 'invoice_number', v_invoice, 'grand_total', v_grand,
    'amount_due', v_grand - v_paid, 'replayed', false);
end $$;

create or replace function public.post_sale(p_business uuid, p_idempotency_key uuid, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then perform _err('NOT_AUTHENTICATED', 'Please sign in again.'); end if;
  if not has_role(p_business, '{owner,manager,cashier}') then perform _err('FORBIDDEN', 'You do not have permission to create bills.'); end if;
  return _post_sale(p_business, auth.uid(), p_idempotency_key, p_payload, _business_date(p_business), now(), false);
end $$;

-- ───────────────────────── VOID ─────────────────────────

create or replace function public.void_sale(p_sale uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s sales%rowtype; r record; v_date date; v_pay uuid;
begin
  if auth.uid() is null then perform _err('NOT_AUTHENTICATED', 'Please sign in again.'); end if;
  select * into s from sales where id = p_sale for update;
  if not found then perform _err('NOT_FOUND', 'Invoice not found.'); end if;
  if not has_role(s.business_id, '{owner,manager}') then perform _err('FORBIDDEN', 'Only an owner or manager can void an invoice.'); end if;
  if s.status = 'voided' then return jsonb_build_object('sale_id', s.id, 'already_voided', true); end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then perform _err('VALIDATION', 'Enter a reason for voiding (at least 3 characters).'); end if;
  v_date := _business_date(s.business_id);

  for r in
    select a.batch_id, a.location_id, a.quantity, a.unit_cost, si.product_id
    from sale_item_allocations a join sale_items si on si.id = a.sale_item_id where si.sale_id = s.id
  loop
    perform _move_stock(s.business_id, r.product_id, r.batch_id, r.location_id, 'void_reversal', r.quantity, r.unit_cost,
                        'sale', s.id, 'Void ' || s.invoice_number, v_date, auth.uid(), now());
  end loop;

  if s.customer_id is not null and s.grand_total > 0 then
    insert into customer_ledger_entries (business_id, customer_id, entry_type, credit, sale_id, business_date, note)
    values (s.business_id, s.customer_id, 'void', s.grand_total, s.id, v_date, 'Void ' || s.invoice_number);
  end if;

  for r in
    select p.method, sum(pa.amount) as amount
    from payment_allocations pa join payments p on p.id = pa.payment_id
    where pa.sale_id = s.id and p.direction = 'in' group by p.method
  loop
    insert into payments (business_id, direction, kind, customer_id, method, amount, reference, business_date, created_by)
    values (s.business_id, 'out', 'refund', s.customer_id, r.method, r.amount, 'Void ' || s.invoice_number, v_date, auth.uid())
    returning id into v_pay;
    if s.customer_id is not null then
      insert into customer_ledger_entries (business_id, customer_id, entry_type, debit, sale_id, payment_id, business_date, note)
      values (s.business_id, s.customer_id, 'refund', r.amount, s.id, v_pay, v_date, 'Refund ' || s.invoice_number);
    end if;
  end loop;

  for r in select rescue_event_id, quantity, taxable_value from sale_items where sale_id = s.id and rescue_event_id is not null loop
    update rescue_events set confirmed_quantity = greatest(confirmed_quantity - r.quantity, 0),
      recovered_value = greatest(recovered_value - r.taxable_value, 0)
    where id = r.rescue_event_id;
  end loop;

  update sales set status = 'voided', amount_due = 0, voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
  where id = s.id;
  perform _audit(s.business_id, auth.uid(), 'sale.voided', 'sale', s.id,
    jsonb_build_object('invoice_number', s.invoice_number, 'grand_total', s.grand_total, 'reason', btrim(p_reason)));
  return jsonb_build_object('sale_id', s.id, 'already_voided', false);
end $$;

-- ───────────────────────── CUSTOMER REPAYMENT ─────────────────────────

create or replace function public._record_customer_payment(
  p_business uuid, p_user uuid, p_customer uuid, p_amount numeric, p_method text, p_reference text,
  p_key uuid, p_date date, p_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_amount numeric := round(p_amount, 2); v_out numeric; v_left numeric; v_take numeric; v_pay uuid; r record; v_cust customers%rowtype;
begin
  if _role_of(p_business, p_user) not in ('owner', 'manager', 'cashier') or _role_of(p_business, p_user) is null then
    perform _err('FORBIDDEN', 'You do not have permission to record customer payments.');
  end if;
  if p_key is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_business::text || ':pay:' || p_key::text, 0));
    select id into v_pay from payments where business_id = p_business and idempotency_key = p_key;
    if found then return jsonb_build_object('payment_id', v_pay, 'replayed', true); end if;
  end if;
  select * into v_cust from customers where id = p_customer and business_id = p_business;
  if not found then perform _err('NOT_FOUND', 'Customer not found.'); end if;
  if v_amount is null or v_amount <= 0 then perform _err('VALIDATION', 'Enter an amount greater than zero.'); end if;
  if p_method not in ('cash', 'upi', 'card', 'bank') then perform _err('VALIDATION', 'Unknown payment method.'); end if;
  select coalesce(sum(amount_due), 0) into v_out from sales where business_id = p_business and customer_id = p_customer and status = 'posted';
  if v_amount > v_out then
    perform _err('AMOUNT_EXCEEDS_DUE', format('%s owes ₹%s. The payment cannot be more than the outstanding amount.', v_cust.name, v_out));
  end if;

  insert into payments (business_id, direction, kind, customer_id, method, amount, reference, business_date, paid_at, idempotency_key, created_by)
  values (p_business, 'in', 'customer_repayment', p_customer, p_method::payment_method, v_amount, nullif(p_reference, ''), p_date, p_at, p_key, p_user)
  returning id into v_pay;

  v_left := v_amount;
  for r in select id, amount_due from sales
           where business_id = p_business and customer_id = p_customer and status = 'posted' and amount_due > 0
           order by invoice_date, posted_at for update
  loop
    exit when v_left <= 0;
    v_take := least(v_left, r.amount_due);
    insert into payment_allocations (business_id, payment_id, sale_id, amount) values (p_business, v_pay, r.id, v_take);
    update sales set amount_paid = amount_paid + v_take, amount_due = amount_due - v_take where id = r.id;
    v_left := v_left - v_take;
  end loop;

  insert into customer_ledger_entries (business_id, customer_id, entry_type, credit, payment_id, business_date, note, created_at)
  values (p_business, p_customer, 'payment', v_amount, v_pay, p_date, coalesce(nullif(p_reference, ''), 'Repayment'), p_at);
  perform _audit(p_business, p_user, 'customer.payment', 'payment', v_pay, jsonb_build_object('customer_id', p_customer, 'amount', v_amount, 'method', p_method));
  return jsonb_build_object('payment_id', v_pay, 'replayed', false);
end $$;

create or replace function public.record_customer_payment(
  p_business uuid, p_customer uuid, p_amount numeric, p_method text, p_reference text, p_idempotency_key uuid
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then perform _err('NOT_AUTHENTICATED', 'Please sign in again.'); end if;
  if not has_role(p_business, '{owner,manager,cashier}') then perform _err('FORBIDDEN', 'You do not have permission to record customer payments.'); end if;
  return _record_customer_payment(p_business, auth.uid(), p_customer, p_amount, p_method, p_reference, p_idempotency_key,
                                  _business_date(p_business), now());
end $$;

-- ───────────────────────── PURCHASES ─────────────────────────

create or replace function public._post_purchase(p_business uuid, p_user uuid, p_key uuid, p_payload jsonb, p_date date, p_at timestamptz)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  b businesses%rowtype; v_sup suppliers%rowtype; v_prod products%rowtype; v_batch product_batches%rowtype;
  v_existing uuid; v_purchase uuid := gen_random_uuid(); v_store uuid;
  v_line jsonb; v_qty numeric; v_cost numeric; v_rate numeric; v_taxable numeric; v_tax numeric;
  v_code text; v_exp date; v_loc uuid; v_bill_date date; v_inter boolean; v_on_hand numeric; v_batch_cost numeric;
  s_taxable numeric := 0; s_tax numeric := 0; v_grand numeric; v_paid numeric := 0; v_pay uuid; v_pay_json jsonb;
  v_n int := 0; v_po uuid;
begin
  select * into b from businesses where id = p_business;
  if _role_of(p_business, p_user) is null or _role_of(p_business, p_user) not in ('owner', 'manager', 'inventory') then
    perform _err('FORBIDDEN', 'You do not have permission to record purchases.');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_business::text || ':pur:' || p_key::text, 0));
  select id into v_existing from purchases where business_id = p_business and idempotency_key = p_key;
  if found then return jsonb_build_object('purchase_id', v_existing, 'replayed', true); end if;

  select * into v_sup from suppliers where id = nullif(p_payload ->> 'supplier_id', '')::uuid and business_id = p_business;
  if not found then perform _err('VALIDATION', 'Choose a supplier for this purchase.'); end if;
  v_bill_date := coalesce(nullif(p_payload ->> 'bill_date', '')::date, p_date);
  if v_bill_date > p_date then perform _err('VALIDATION', 'Bill date cannot be in the future.'); end if;
  v_inter := coalesce(p_payload ->> 'supply_type', 'intra') = 'inter';
  if jsonb_typeof(p_payload -> 'lines') <> 'array' or jsonb_array_length(p_payload -> 'lines') = 0 then
    perform _err('VALIDATION', 'Add at least one item to the purchase.');
  end if;
  select id into v_store from stores where business_id = p_business and is_default;
  v_po := nullif(p_payload ->> 'purchase_order_id', '')::uuid;

  insert into purchases (id, business_id, store_id, supplier_id, bill_number, bill_date, supply_type, taxable_total,
                         grand_total, purchase_order_id, idempotency_key, notes, created_by, created_at)
  values (v_purchase, p_business, v_store, v_sup.id, nullif(btrim(p_payload ->> 'bill_number'), ''), v_bill_date,
          case when v_inter then 'inter' else 'intra' end, 0, 0, v_po, p_key, nullif(p_payload ->> 'notes', ''), p_user, p_at);

  for v_line in select value from jsonb_array_elements(p_payload -> 'lines') loop
    v_n := v_n + 1;
    select * into v_prod from products where id = nullif(v_line ->> 'product_id', '')::uuid and business_id = p_business;
    if not found then perform _err('VALIDATION', 'A product in the purchase was not found.'); end if;
    v_qty := nullif(v_line ->> 'quantity', '')::numeric;
    v_cost := round(nullif(v_line ->> 'unit_cost', '')::numeric, 2);
    v_rate := coalesce(nullif(v_line ->> 'gst_rate', '')::numeric, v_prod.gst_rate);
    if v_qty is null or v_qty <= 0 then perform _err('VALIDATION', format('Enter a quantity above zero for %s.', v_prod.name)); end if;
    if v_prod.unit in ('pcs', 'pack', 'box', 'strip', 'bottle', 'dozen') and v_qty <> trunc(v_qty) then
      perform _err('VALIDATION', format('%s is counted in whole %s.', v_prod.name, v_prod.unit));
    end if;
    if v_cost is null or v_cost < 0 then perform _err('VALIDATION', format('Enter a valid cost for %s.', v_prod.name)); end if;
    if v_rate not in (0, 0.25, 1.5, 3, 5, 12, 18, 28, 40) then perform _err('VALIDATION', format('Invalid GST rate for %s.', v_prod.name)); end if;

    v_exp := nullif(v_line ->> 'expiry_date', '')::date;
    if v_prod.track_expiry and v_exp is null and v_prod.shelf_life_days is not null then v_exp := v_bill_date + v_prod.shelf_life_days; end if;
    if v_prod.track_expiry and v_exp is null then perform _err('VALIDATION', format('Enter the expiry date for %s.', v_prod.name)); end if;
    if v_exp is not null and v_exp < v_bill_date then perform _err('VALIDATION', format('%s: expiry date is before the bill date.', v_prod.name)); end if;

    v_loc := coalesce(nullif(v_line ->> 'location_id', '')::uuid, v_prod.default_location_id, _default_location(p_business, 'backroom'));
    if not exists (select 1 from locations where id = v_loc and business_id = p_business) then
      perform _err('VALIDATION', 'Choose a valid storage location.');
    end if;

    -- Inventory cost: GST-registered businesses claim input credit, so cost excludes GST; otherwise GST is a cost.
    v_batch_cost := case when b.gst_registered then v_cost else round(v_cost * (1 + v_rate / 100), 4) end;

    v_code := nullif(btrim(v_line ->> 'batch_code'), '');
    if v_prod.track_batches and v_code is null then perform _err('VALIDATION', format('Enter the batch number for %s.', v_prod.name)); end if;
    if v_code is not null and v_prod.track_batches then
      select * into v_batch from product_batches where product_id = v_prod.id and batch_code = v_code for update;
      if found then
        if v_batch.expiry_date is distinct from v_exp and v_exp is not null then
          perform _err('VALIDATION', format('Batch %s of %s already exists with a different expiry date.', v_code, v_prod.name));
        end if;
        select coalesce(sum(quantity), 0) into v_on_hand from stock_balances where batch_id = v_batch.id;
        update product_batches set unit_cost = round((v_on_hand * unit_cost + v_qty * v_batch_cost) / (v_on_hand + v_qty), 4)
        where id = v_batch.id returning * into v_batch;
      else
        insert into product_batches (business_id, product_id, batch_code, expiry_date, unit_cost, received_on, supplier_id)
        values (p_business, v_prod.id, v_code, v_exp, v_batch_cost, v_bill_date, v_sup.id) returning * into v_batch;
      end if;
    else
      insert into product_batches (business_id, product_id, batch_code, expiry_date, unit_cost, received_on, supplier_id, is_internal)
      values (p_business, v_prod.id,
              coalesce(v_code, 'LOT-' || to_char(v_bill_date, 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5))),
              v_exp, v_batch_cost, v_bill_date, v_sup.id, true)
      returning * into v_batch;
    end if;

    v_taxable := round(v_qty * v_cost, 2);
    v_tax := round(v_taxable * v_rate / 100, 2);
    insert into purchase_items (purchase_id, business_id, product_id, batch_id, location_id, quantity, unit_cost, gst_rate,
                                taxable_value, tax_amount, line_total)
    values (v_purchase, p_business, v_prod.id, v_batch.id, v_loc, v_qty, v_cost, v_rate, v_taxable, v_tax, v_taxable + v_tax);
    perform _move_stock(p_business, v_prod.id, v_batch.id, v_loc, 'purchase', v_qty, v_batch.unit_cost,
                        'purchase', v_purchase, coalesce(p_payload ->> 'bill_number', v_sup.name), v_bill_date, p_user, p_at);
    update products set purchase_price = v_cost, supplier_id = coalesce(supplier_id, v_sup.id) where id = v_prod.id;
    s_taxable := s_taxable + v_taxable; s_tax := s_tax + v_tax;
  end loop;

  v_grand := s_taxable + s_tax;
  insert into supplier_ledger_entries (business_id, supplier_id, entry_type, credit, purchase_id, business_date, note, created_at)
  select p_business, v_sup.id, 'purchase', v_grand, v_purchase, v_bill_date, coalesce(p_payload ->> 'bill_number', 'Purchase'), p_at
  where v_grand > 0;

  v_pay_json := p_payload -> 'payment';
  if v_pay_json is not null and coalesce(nullif(v_pay_json ->> 'amount', '')::numeric, 0) > 0 then
    v_paid := round((v_pay_json ->> 'amount')::numeric, 2);
    if v_paid > v_grand then perform _err('VALIDATION', 'Payment cannot be more than the purchase total.'); end if;
    if coalesce(v_pay_json ->> 'method', '') not in ('cash', 'upi', 'card', 'bank') then perform _err('VALIDATION', 'Unknown payment method.'); end if;
    insert into payments (business_id, direction, kind, supplier_id, method, amount, reference, business_date, paid_at, created_by)
    values (p_business, 'out', 'supplier_payment', v_sup.id, (v_pay_json ->> 'method')::payment_method, v_paid,
            nullif(v_pay_json ->> 'reference', ''), v_bill_date, p_at, p_user)
    returning id into v_pay;
    insert into payment_allocations (business_id, payment_id, purchase_id, amount) values (p_business, v_pay, v_purchase, v_paid);
    insert into supplier_ledger_entries (business_id, supplier_id, entry_type, debit, purchase_id, payment_id, business_date, note, created_at)
    values (p_business, v_sup.id, 'payment', v_paid, v_purchase, v_pay, v_bill_date, 'Paid with bill', p_at);
  end if;

  update purchases set taxable_total = s_taxable, tax_total = s_tax, grand_total = v_grand,
                       amount_paid = v_paid, amount_due = v_grand - v_paid where id = v_purchase;
  if v_po is not null then
    update purchase_orders set status = 'received' where id = v_po and business_id = p_business;
  end if;
  perform _audit(p_business, p_user, 'purchase.posted', 'purchase', v_purchase,
    jsonb_build_object('supplier', v_sup.name, 'grand_total', v_grand, 'lines', v_n));
  return jsonb_build_object('purchase_id', v_purchase, 'grand_total', v_grand, 'replayed', false);
end $$;

create or replace function public.post_purchase(p_business uuid, p_idempotency_key uuid, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then perform _err('NOT_AUTHENTICATED', 'Please sign in again.'); end if;
  if not has_role(p_business, '{owner,manager,inventory}') then perform _err('FORBIDDEN', 'You do not have permission to record purchases.'); end if;
  return _post_purchase(p_business, auth.uid(), p_idempotency_key, p_payload, _business_date(p_business), now());
end $$;

create or replace function public._record_supplier_payment(
  p_business uuid, p_user uuid, p_supplier uuid, p_amount numeric, p_method text, p_reference text, p_key uuid, p_date date, p_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_amount numeric := round(p_amount, 2); v_bal numeric; v_left numeric; v_take numeric; v_pay uuid; r record;
begin
  if _role_of(p_business, p_user) is null or _role_of(p_business, p_user) not in ('owner', 'manager') then
    perform _err('FORBIDDEN', 'Only an owner or manager can pay suppliers.');
  end if;
  if p_key is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_business::text || ':spay:' || p_key::text, 0));
    select id into v_pay from payments where business_id = p_business and idempotency_key = p_key;
    if found then return jsonb_build_object('payment_id', v_pay, 'replayed', true); end if;
  end if;
  if not exists (select 1 from suppliers where id = p_supplier and business_id = p_business) then perform _err('NOT_FOUND', 'Supplier not found.'); end if;
  if v_amount is null or v_amount <= 0 then perform _err('VALIDATION', 'Enter an amount greater than zero.'); end if;
  if p_method not in ('cash', 'upi', 'card', 'bank') then perform _err('VALIDATION', 'Unknown payment method.'); end if;
  select coalesce(sum(credit - debit), 0) into v_bal from supplier_ledger_entries where supplier_id = p_supplier;
  if v_amount > v_bal then perform _err('AMOUNT_EXCEEDS_DUE', format('You owe this supplier ₹%s. The payment cannot be more than that.', greatest(v_bal, 0))); end if;

  insert into payments (business_id, direction, kind, supplier_id, method, amount, reference, business_date, paid_at, idempotency_key, created_by)
  values (p_business, 'out', 'supplier_payment', p_supplier, p_method::payment_method, v_amount, nullif(p_reference, ''), p_date, p_at, p_key, p_user)
  returning id into v_pay;
  v_left := v_amount;
  for r in select id, amount_due from purchases where supplier_id = p_supplier and amount_due > 0 order by bill_date, created_at for update loop
    exit when v_left <= 0;
    v_take := least(v_left, r.amount_due);
    insert into payment_allocations (business_id, payment_id, purchase_id, amount) values (p_business, v_pay, r.id, v_take);
    update purchases set amount_paid = amount_paid + v_take, amount_due = amount_due - v_take where id = r.id;
    v_left := v_left - v_take;
  end loop;
  insert into supplier_ledger_entries (business_id, supplier_id, entry_type, debit, payment_id, business_date, note, created_at)
  values (p_business, p_supplier, 'payment', v_amount, v_pay, p_date, coalesce(nullif(p_reference, ''), 'Payment'), p_at);
  perform _audit(p_business, p_user, 'supplier.payment', 'payment', v_pay, jsonb_build_object('supplier_id', p_supplier, 'amount', v_amount));
  return jsonb_build_object('payment_id', v_pay, 'replayed', false);
end $$;

create or replace function public.record_supplier_payment(
  p_business uuid, p_supplier uuid, p_amount numeric, p_method text, p_reference text, p_idempotency_key uuid
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then perform _err('NOT_AUTHENTICATED', 'Please sign in again.'); end if;
  return _record_supplier_payment(p_business, auth.uid(), p_supplier, p_amount, p_method, p_reference, p_idempotency_key,
                                  _business_date(p_business), now());
end $$;

-- ───────────────────────── STOCK OPERATIONS ─────────────────────────

create or replace function public._require_stock_role(p_business uuid) returns void
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then perform _err('NOT_AUTHENTICATED', 'Please sign in again.'); end if;
  if not has_role(p_business, '{owner,manager,inventory}') then
    perform _err('FORBIDDEN', 'You do not have permission to change stock.');
  end if;
end $$;

-- Opening stock or found stock without a supplier bill (creates a batch).
create or replace function public.add_stock(
  p_business uuid, p_product uuid, p_quantity numeric, p_unit_cost numeric, p_location uuid,
  p_batch_code text, p_expiry date, p_reason text, p_note text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prod products%rowtype; v_batch product_batches%rowtype; v_date date; v_loc uuid; v_code text; v_on_hand numeric;
begin
  perform _require_stock_role(p_business);
  select * into v_prod from products where id = p_product and business_id = p_business;
  if not found then perform _err('NOT_FOUND', 'Product not found.'); end if;
  if p_reason not in ('opening', 'found') then perform _err('VALIDATION', 'Reason must be opening stock or found stock.'); end if;
  if p_quantity is null or p_quantity <= 0 then perform _err('VALIDATION', 'Enter a quantity above zero.'); end if;
  if v_prod.unit in ('pcs', 'pack', 'box', 'strip', 'bottle', 'dozen') and p_quantity <> trunc(p_quantity) then
    perform _err('VALIDATION', format('%s is counted in whole %s.', v_prod.name, v_prod.unit));
  end if;
  if p_unit_cost is null or p_unit_cost < 0 then perform _err('VALIDATION', 'Enter the unit cost.'); end if;
  v_date := _business_date(p_business);
  if v_prod.track_expiry and p_expiry is null then perform _err('VALIDATION', 'Enter the expiry date for this batch.'); end if;
  v_code := nullif(btrim(p_batch_code), '');
  if v_prod.track_batches and v_code is null then perform _err('VALIDATION', 'Enter the batch number.'); end if;
  v_loc := coalesce(p_location, v_prod.default_location_id, _default_location(p_business, 'backroom'));
  if not exists (select 1 from locations where id = v_loc and business_id = p_business) then perform _err('VALIDATION', 'Choose a valid location.'); end if;

  if v_code is not null and v_prod.track_batches then
    select * into v_batch from product_batches where product_id = p_product and batch_code = v_code for update;
  end if;
  if v_batch.id is null then
    insert into product_batches (business_id, product_id, batch_code, expiry_date, unit_cost, received_on, is_internal)
    values (p_business, p_product,
            coalesce(v_code, 'LOT-' || to_char(v_date, 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5))),
            p_expiry, round(p_unit_cost, 4), v_date, not v_prod.track_batches)
    returning * into v_batch;
  else
    if v_batch.expiry_date is distinct from p_expiry and p_expiry is not null then
      perform _err('VALIDATION', 'This batch number already exists with a different expiry date.');
    end if;
    select coalesce(sum(quantity), 0) into v_on_hand from stock_balances where batch_id = v_batch.id;
    update product_batches set unit_cost = round((v_on_hand * unit_cost + p_quantity * p_unit_cost) / (v_on_hand + p_quantity), 4)
    where id = v_batch.id returning * into v_batch;
  end if;

  insert into stock_adjustments (business_id, product_id, batch_id, location_id, quantity_change, reason, note, business_date, created_by)
  values (p_business, p_product, v_batch.id, v_loc, p_quantity, p_reason, p_note, v_date, auth.uid());
  perform _move_stock(p_business, p_product, v_batch.id, v_loc, case when p_reason = 'opening' then 'opening' else 'adjustment' end::movement_type,
                      p_quantity, v_batch.unit_cost, 'adjustment', null, coalesce(p_note, initcap(p_reason) || ' stock'), v_date, auth.uid(), now());
  perform _audit(p_business, auth.uid(), 'stock.added', 'product', p_product, jsonb_build_object('quantity', p_quantity, 'batch', v_batch.batch_code, 'reason', p_reason));
  return jsonb_build_object('batch_id', v_batch.id);
end $$;

-- Count corrections (±) and write-offs (damaged / lost / expired: always negative).
create or replace function public.adjust_stock(
  p_business uuid, p_batch uuid, p_location uuid, p_change numeric, p_reason text, p_note text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_batch product_batches%rowtype; v_date date; v_type movement_type; v_id uuid;
begin
  perform _require_stock_role(p_business);
  select * into v_batch from product_batches where id = p_batch and business_id = p_business;
  if not found then perform _err('NOT_FOUND', 'Batch not found.'); end if;
  if p_change is null or p_change = 0 then perform _err('VALIDATION', 'Enter a non-zero quantity change.'); end if;
  if p_reason not in ('count_correction', 'damaged', 'lost', 'expired', 'other') then perform _err('VALIDATION', 'Choose a valid reason.'); end if;
  if p_reason in ('damaged', 'lost', 'expired') and p_change > 0 then perform _err('VALIDATION', 'Write-offs reduce stock; enter a negative change.'); end if;
  if p_reason in ('other', 'count_correction') and length(btrim(coalesce(p_note, ''))) < 3 and p_reason = 'other' then
    perform _err('VALIDATION', 'Add a short note explaining this adjustment.');
  end if;
  v_type := case when p_reason in ('damaged', 'lost', 'expired') then 'write_off' else 'adjustment' end;
  v_date := _business_date(p_business);
  insert into stock_adjustments (business_id, product_id, batch_id, location_id, quantity_change, reason, note, business_date, created_by)
  values (p_business, v_batch.product_id, p_batch, p_location, p_change, p_reason, p_note, v_date, auth.uid()) returning id into v_id;
  perform _move_stock(p_business, v_batch.product_id, p_batch, p_location, v_type, p_change, v_batch.unit_cost,
                      'adjustment', v_id, coalesce(nullif(p_note, ''), replace(p_reason, '_', ' ')), v_date, auth.uid(), now());
  perform _audit(p_business, auth.uid(), 'stock.adjusted', 'batch', p_batch, jsonb_build_object('change', p_change, 'reason', p_reason, 'note', p_note));
  return jsonb_build_object('adjustment_id', v_id);
end $$;

-- Move stock between locations (shelf ↔ backroom). Total business stock is unchanged.
create or replace function public.transfer_product_stock(
  p_business uuid, p_product uuid, p_from uuid, p_to uuid, p_quantity numeric
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_left numeric := p_quantity; v_take numeric; r record; v_date date; v_ref uuid := gen_random_uuid(); v_name text;
begin
  perform _require_stock_role(p_business);
  if p_from = p_to then perform _err('VALIDATION', 'Choose two different locations.'); end if;
  if p_quantity is null or p_quantity <= 0 then perform _err('VALIDATION', 'Enter a quantity above zero.'); end if;
  if (select count(*) from locations where id in (p_from, p_to) and business_id = p_business) <> 2 then
    perform _err('VALIDATION', 'Choose valid locations.');
  end if;
  select name into v_name from products where id = p_product and business_id = p_business;
  if v_name is null then perform _err('NOT_FOUND', 'Product not found.'); end if;
  v_date := _business_date(p_business);
  for r in select sb.batch_id, sb.quantity, pb.unit_cost from stock_balances sb join product_batches pb on pb.id = sb.batch_id
           where sb.product_id = p_product and sb.location_id = p_from and sb.quantity > 0
           order by pb.expiry_date nulls last, pb.received_on for update of sb
  loop
    exit when v_left <= 0;
    v_take := least(v_left, r.quantity);
    perform _move_stock(p_business, p_product, r.batch_id, p_from, 'transfer_out', -v_take, r.unit_cost, 'transfer', v_ref, 'Transfer', v_date, auth.uid(), now());
    perform _move_stock(p_business, p_product, r.batch_id, p_to, 'transfer_in', v_take, r.unit_cost, 'transfer', v_ref, 'Transfer', v_date, auth.uid(), now());
    v_left := v_left - v_take;
  end loop;
  if v_left > 0 then perform _err('INSUFFICIENT_STOCK', format('Only %s of %s is at the source location.', p_quantity - v_left, v_name)); end if;
  perform _audit(p_business, auth.uid(), 'stock.transferred', 'product', p_product, jsonb_build_object('from', p_from, 'to', p_to, 'quantity', p_quantity));
  return jsonb_build_object('transfer_id', v_ref);
end $$;

-- Reconciliation: balances must equal the sum of movements per batch × location. Returns mismatches.
create or replace function public.check_stock_integrity(p_business uuid)
returns table (batch_id uuid, location_id uuid, balance numeric, ledger numeric)
language sql stable security invoker set search_path = public, pg_temp as $$
  with ledger as (
    select m.batch_id, m.location_id, sum(m.quantity) as qty from stock_movements m where m.business_id = p_business group by 1, 2
  )
  select coalesce(b.batch_id, l.batch_id), coalesce(b.location_id, l.location_id), coalesce(b.quantity, 0), coalesce(l.qty, 0)
  from (select * from stock_balances where business_id = p_business) b
  full join ledger l on l.batch_id = b.batch_id and l.location_id = b.location_id
  where coalesce(b.quantity, 0) <> coalesce(l.qty, 0);
$$;
