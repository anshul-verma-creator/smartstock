-- SmartStock AI — onboarding, members, stock rescue

-- ───────────────────────── Onboarding ─────────────────────────

create or replace function public._create_business_core(p_user uuid, p_payload jsonb, p_is_demo boolean) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid; v_store uuid; v_type business_type;
  v_gst boolean := coalesce((p_payload ->> 'gst_registered')::boolean, false);
  v_gstin text := nullif(upper(btrim(p_payload ->> 'gstin')), '');
begin
  v_type := coalesce(nullif(p_payload ->> 'business_type', ''), 'kirana')::business_type;
  if length(btrim(coalesce(p_payload ->> 'name', ''))) < 2 then perform _err('VALIDATION', 'Enter your business name.'); end if;
  if coalesce(p_payload ->> 'state_code', '') !~ '^[0-9]{2}$' then perform _err('VALIDATION', 'Choose your state.'); end if;
  if v_gst and v_gstin is null then perform _err('VALIDATION', 'Enter your GSTIN, or mark the business as not GST-registered.'); end if;
  if not v_gst then v_gstin := null; end if;
  if v_gstin is not null and v_gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then
    perform _err('VALIDATION', 'That GSTIN does not look right. It has 15 characters, e.g. 08ABCDE1234F1Z5.');
  end if;
  if v_gstin is not null and left(v_gstin, 2) <> p_payload ->> 'state_code' then
    perform _err('VALIDATION', 'The first two digits of the GSTIN must match your state code.');
  end if;

  insert into businesses (name, business_type, owner_name, phone, email, address_line, city, state_code, pincode,
    gst_registered, gstin, invoice_prefix, fy_start_month, low_stock_default, expiry_warning_days, receipt_footer, is_demo, created_by)
  values (btrim(p_payload ->> 'name'), v_type, nullif(btrim(p_payload ->> 'owner_name'), ''), nullif(btrim(p_payload ->> 'phone'), ''),
    nullif(btrim(p_payload ->> 'email'), ''), nullif(btrim(p_payload ->> 'address_line'), ''), nullif(btrim(p_payload ->> 'city'), ''),
    p_payload ->> 'state_code', nullif(btrim(p_payload ->> 'pincode'), ''), v_gst, v_gstin,
    coalesce(nullif(upper(btrim(p_payload ->> 'invoice_prefix')), ''), 'INV'),
    coalesce(nullif(p_payload ->> 'fy_start_month', '')::int, 4),
    coalesce(nullif(p_payload ->> 'low_stock_default', '')::numeric, 10),
    coalesce(nullif(p_payload ->> 'expiry_warning_days', '')::int, 7),
    coalesce(nullif(p_payload ->> 'receipt_footer', ''), 'Thank you! Visit again.'), p_is_demo, p_user)
  returning id into v_id;

  -- Membership is derived from the authenticated caller, never from the payload.
  insert into business_memberships (business_id, user_id, role) values (v_id, p_user, 'owner');
  insert into stores (business_id, name, is_default) values (v_id, 'Main store', true) returning id into v_store;
  insert into locations (business_id, store_id, kind, block, rack, shelf) values
    (v_id, v_store, 'backroom', 'Backroom', null, null),
    (v_id, v_store, 'shelf', 'Block A', 'Rack 1', 'Shelf 1'),
    (v_id, v_store, 'shelf', 'Block A', 'Rack 1', 'Shelf 2'),
    (v_id, v_store, 'shelf', 'Block B', 'Rack 1', 'Shelf 1');

  insert into product_categories (business_id, name, default_gst_rate)
  select v_id, c.name, c.rate from (values
    ('Dairy', 0::numeric), ('Bakery', 0), ('Staples', 5), ('Beverages', 5), ('Snacks', 5), ('Household', 18), ('Personal care', 5)
  ) c(name, rate)
  union all
  select v_id, 'Pharmacy', 5 where v_type = 'pharmacy' or p_is_demo;

  update profiles set full_name = coalesce(full_name, nullif(btrim(p_payload ->> 'owner_name'), '')) where id = p_user;
  perform _audit(v_id, p_user, 'business.created', 'business', v_id, jsonb_build_object('name', p_payload ->> 'name', 'demo', p_is_demo));
  return v_id;
end $$;

create or replace function public.create_business(p_payload jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then perform _err('NOT_AUTHENTICATED', 'Please sign in again.'); end if;
  if (select count(*) from business_memberships where user_id = auth.uid()) >= 10 then
    perform _err('LIMIT', 'You can belong to at most 10 businesses.');
  end if;
  return _create_business_core(auth.uid(), p_payload, false);
end $$;

-- ───────────────────────── Members ─────────────────────────

create or replace function public.list_members(p_business uuid)
returns table (membership_id uuid, user_id uuid, role member_role, full_name text, email text, created_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not has_role(p_business, '{owner,manager}') then perform _err('FORBIDDEN', 'Only owners and managers can view the team.'); end if;
  return query
    select m.id, m.user_id, m.role, p.full_name, u.email::text, m.created_at
    from business_memberships m join auth.users u on u.id = m.user_id left join profiles p on p.id = m.user_id
    where m.business_id = p_business order by m.created_at;
end $$;

create or replace function public.add_member(p_business uuid, p_email text, p_role member_role) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid; v_id uuid;
begin
  if not has_role(p_business, '{owner}') then perform _err('FORBIDDEN', 'Only the owner can add team members.'); end if;
  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then perform _err('NOT_FOUND', 'No SmartStock account uses that email. Ask them to sign up first, then add them here.'); end if;
  if exists (select 1 from business_memberships where business_id = p_business and user_id = v_user) then
    perform _err('VALIDATION', 'This person is already a member.');
  end if;
  insert into business_memberships (business_id, user_id, role) values (p_business, v_user, p_role) returning id into v_id;
  perform _audit(p_business, auth.uid(), 'member.added', 'membership', v_id, jsonb_build_object('email', p_email, 'role', p_role));
  return v_id;
end $$;

create or replace function public.update_member(p_membership uuid, p_role member_role, p_remove boolean default false) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare m business_memberships%rowtype;
begin
  select * into m from business_memberships where id = p_membership for update;
  if not found then perform _err('NOT_FOUND', 'Member not found.'); end if;
  if not has_role(m.business_id, '{owner}') then perform _err('FORBIDDEN', 'Only the owner can change team members.'); end if;
  if m.role = 'owner' and (p_remove or p_role <> 'owner')
     and (select count(*) from business_memberships where business_id = m.business_id and role = 'owner') = 1 then
    perform _err('VALIDATION', 'A business needs at least one owner.');
  end if;
  if p_remove then
    delete from business_memberships where id = p_membership;
  else
    update business_memberships set role = p_role where id = p_membership;
  end if;
  perform _audit(m.business_id, auth.uid(), case when p_remove then 'member.removed' else 'member.updated' end, 'membership', m.id,
    jsonb_build_object('role', p_role));
end $$;

-- ───────────────────────── Stock rescue ─────────────────────────

-- Take a quantity out of a batch across its locations (backroom first, then shelves).
create or replace function public._take_from_batch(
  p_business uuid, p_batch uuid, p_qty numeric, p_type movement_type, p_ref_type text, p_ref_id uuid, p_note text,
  p_date date, p_user uuid, p_at timestamptz
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_left numeric := p_qty; v_take numeric; r record;
begin
  for r in select sb.location_id, sb.quantity, sb.product_id, pb.unit_cost from stock_balances sb
           join product_batches pb on pb.id = sb.batch_id join locations l on l.id = sb.location_id
           where sb.batch_id = p_batch and sb.quantity > 0 order by (l.kind = 'backroom') desc, l.block for update of sb
  loop
    exit when v_left <= 0;
    v_take := least(v_left, r.quantity);
    perform _move_stock(p_business, r.product_id, p_batch, r.location_id, p_type, -v_take, r.unit_cost, p_ref_type, p_ref_id, p_note, p_date, p_user, p_at);
    v_left := v_left - v_take;
  end loop;
  if v_left > 0 then perform _err('INSUFFICIENT_STOCK', format('Only %s units are left in this batch.', p_qty - v_left)); end if;
end $$;

create or replace function public._request_rescue(
  p_business uuid, p_user uuid, p_type rescue_type, p_batch uuid, p_quantity numeric, p_details jsonb, p_date date, p_at timestamptz
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_batch product_batches%rowtype; v_prod products%rowtype; v_on_hand numeric; v_id uuid; v_supplier uuid;
  v_expired boolean; v_status rescue_status;
begin
  if _role_of(p_business, p_user) is null or _role_of(p_business, p_user) not in ('owner', 'manager', 'inventory') then
    perform _err('FORBIDDEN', 'You do not have permission to start a stock rescue.');
  end if;
  select * into v_batch from product_batches where id = p_batch and business_id = p_business;
  if not found then perform _err('NOT_FOUND', 'Batch not found.'); end if;
  select * into v_prod from products where id = v_batch.product_id;
  select coalesce(sum(quantity), 0) into v_on_hand from stock_balances where batch_id = p_batch;
  if p_quantity is null or p_quantity <= 0 then perform _err('VALIDATION', 'Enter a quantity above zero.'); end if;
  if p_quantity > v_on_hand then perform _err('VALIDATION', format('Only %s units are in this batch.', v_on_hand)); end if;
  v_expired := v_batch.expiry_date is not null and v_batch.expiry_date < p_date;

  if p_type = 'supplier_return' then
    v_supplier := coalesce(nullif(p_details ->> 'supplier_id', '')::uuid, v_batch.supplier_id, v_prod.supplier_id);
    if v_supplier is null then perform _err('VALIDATION', 'Choose the supplier to return this stock to.'); end if;
    v_status := 'requested';
  elsif p_type = 'surplus_sale' then
    if v_expired then perform _err('VALIDATION', 'Expired stock can never be listed for sale.'); end if;
    if coalesce(nullif(p_details ->> 'offer_price', '')::numeric, 0) <= 0 then perform _err('VALIDATION', 'Enter an offer price.'); end if;
    v_status := 'listed';
  elsif p_type = 'discount' then
    if v_expired then perform _err('VALIDATION', 'Expired stock cannot be sold at a discount. Write it off or return it.'); end if;
    if coalesce(nullif(p_details ->> 'discount_pct', '')::numeric, 0) not between 1 and 90 then
      perform _err('VALIDATION', 'Discount must be between 1% and 90%.');
    end if;
    if exists (select 1 from rescue_events where batch_id = p_batch and rescue_type = 'discount' and status in ('requested', 'approved')) then
      perform _err('VALIDATION', 'This batch already has an active discount request.');
    end if;
    v_status := 'requested';
  else
    if v_expired then perform _err('VALIDATION', 'Expired products cannot be donated.'); end if;
    v_status := 'requested';
  end if;

  insert into rescue_events (business_id, rescue_type, status, product_id, batch_id, supplier_id, quantity, unit_cost,
    offer_price, discount_pct, reason, counterparty, requested_by, created_at, business_date)
  values (p_business, p_type, v_status, v_prod.id, p_batch, v_supplier, p_quantity, v_batch.unit_cost,
    nullif(p_details ->> 'offer_price', '')::numeric, nullif(p_details ->> 'discount_pct', '')::numeric,
    nullif(p_details ->> 'reason', ''), nullif(p_details ->> 'counterparty', ''), p_user, p_at, p_date)
  returning id into v_id;
  perform _audit(p_business, p_user, 'rescue.requested', 'rescue_event', v_id, jsonb_build_object('type', p_type, 'quantity', p_quantity));
  return v_id;
end $$;

create or replace function public.request_rescue(p_business uuid, p_type rescue_type, p_batch uuid, p_quantity numeric, p_details jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then perform _err('NOT_AUTHENTICATED', 'Please sign in again.'); end if;
  return _request_rescue(p_business, auth.uid(), p_type, p_batch, p_quantity, coalesce(p_details, '{}'::jsonb), _business_date(p_business), now());
end $$;

create or replace function public._approve_discount(p_event uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare ev rescue_events%rowtype;
begin
  select * into ev from rescue_events where id = p_event for update;
  if not found then perform _err('NOT_FOUND', 'Rescue request not found.'); end if;
  if _role_of(ev.business_id, p_user) is null or _role_of(ev.business_id, p_user) not in ('owner', 'manager') then
    perform _err('FORBIDDEN', 'Only an owner or manager can approve a discount.');
  end if;
  if ev.rescue_type <> 'discount' or ev.status <> 'requested' then perform _err('VALIDATION', 'This request cannot be approved.'); end if;
  update rescue_events set status = 'approved', confirmed_by = p_user where id = p_event;
  update product_batches set markdown_pct = ev.discount_pct where id = ev.batch_id;
  perform _audit(ev.business_id, p_user, 'rescue.discount_approved', 'rescue_event', p_event, jsonb_build_object('discount_pct', ev.discount_pct));
end $$;

create or replace function public.approve_rescue_discount(p_event uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then perform _err('NOT_AUTHENTICATED', 'Please sign in again.'); end if;
  perform _approve_discount(p_event, auth.uid());
end $$;

create or replace function public._confirm_rescue(
  p_event uuid, p_user uuid, p_quantity numeric, p_details jsonb, p_date date, p_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  ev rescue_events%rowtype; v_role member_role; v_qty numeric; v_value numeric; v_ret uuid; v_sale jsonb; v_taxable numeric;
  v_method text;
begin
  select * into ev from rescue_events where id = p_event for update;
  if not found then perform _err('NOT_FOUND', 'Rescue request not found.'); end if;
  v_role := _role_of(ev.business_id, p_user);
  if v_role is null or v_role = 'cashier' or (v_role = 'inventory' and ev.rescue_type <> 'supplier_return') then
    perform _err('FORBIDDEN', 'You do not have permission to confirm this rescue.');
  end if;
  if ev.status not in ('requested', 'listed') or ev.rescue_type = 'discount' then
    perform _err('VALIDATION', 'This rescue is not waiting for confirmation.');
  end if;
  v_qty := coalesce(p_quantity, ev.quantity);
  if v_qty <= 0 or v_qty > ev.quantity then perform _err('VALIDATION', format('Confirm between 1 and %s units.', ev.quantity)); end if;

  if ev.rescue_type = 'supplier_return' then
    v_value := round(coalesce(nullif(p_details ->> 'credit_value', '')::numeric, v_qty * ev.unit_cost), 2);
    if v_value < 0 then perform _err('VALIDATION', 'Credit value cannot be negative.'); end if;
    insert into purchase_returns (business_id, supplier_id, product_id, batch_id, quantity, unit_cost, value, reason, rescue_event_id, business_date, created_by, created_at)
    values (ev.business_id, ev.supplier_id, ev.product_id, ev.batch_id, v_qty, ev.unit_cost, v_value, ev.reason, ev.id, p_date, p_user, p_at)
    returning id into v_ret;
    perform _take_from_batch(ev.business_id, ev.batch_id, v_qty, 'purchase_return', 'purchase_return', v_ret, 'Returned to supplier', p_date, p_user, p_at);
    if v_value > 0 then
      insert into supplier_ledger_entries (business_id, supplier_id, entry_type, debit, purchase_return_id, business_date, note, created_at)
      values (ev.business_id, ev.supplier_id, 'return', v_value, v_ret, p_date, 'Supplier return credit', p_at);
    end if;
  elsif ev.rescue_type = 'surplus_sale' then
    if nullif(p_details ->> 'customer_id', '') is null then perform _err('VALIDATION', 'Choose the buyer (add them as a customer first).'); end if;
    v_method := nullif(p_details ->> 'method', '');
    v_sale := _post_sale(ev.business_id, p_user, gen_random_uuid(),
      jsonb_build_object('customer_id', p_details ->> 'customer_id', 'settle_method', v_method,
        'notes', 'Surplus stock sale',
        'lines', jsonb_build_array(jsonb_build_object('product_id', ev.product_id, 'quantity', v_qty, 'rescue_event_id', ev.id))),
      p_date, p_at, true);
    select taxable_value into v_taxable from sale_items where sale_id = (v_sale ->> 'sale_id')::uuid;
    v_value := v_taxable;
    update rescue_events set sale_id = (v_sale ->> 'sale_id')::uuid, counterparty = coalesce(counterparty, (select name from customers where id = (p_details ->> 'customer_id')::uuid))
    where id = ev.id;
  else
    v_value := 0;
    perform _take_from_batch(ev.business_id, ev.batch_id, v_qty, 'rescue_out', 'rescue', ev.id,
      'Donated' || coalesce(' to ' || coalesce(nullif(p_details ->> 'counterparty', ''), ev.counterparty), ''), p_date, p_user, p_at);
  end if;

  update rescue_events set status = 'confirmed', confirmed_quantity = v_qty, recovered_value = v_value,
    confirmed_by = p_user, confirmed_at = p_at, business_date = p_date,
    counterparty = coalesce(nullif(p_details ->> 'counterparty', ''), counterparty)
  where id = ev.id;
  perform _audit(ev.business_id, p_user, 'rescue.confirmed', 'rescue_event', ev.id,
    jsonb_build_object('type', ev.rescue_type, 'quantity', v_qty, 'value', v_value));
  return jsonb_build_object('event_id', ev.id, 'recovered_value', v_value, 'sale', v_sale);
end $$;

create or replace function public.confirm_rescue(p_event uuid, p_quantity numeric, p_details jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_business uuid;
begin
  if auth.uid() is null then perform _err('NOT_AUTHENTICATED', 'Please sign in again.'); end if;
  select business_id into v_business from rescue_events where id = p_event;
  if v_business is null then perform _err('NOT_FOUND', 'Rescue request not found.'); end if;
  return _confirm_rescue(p_event, auth.uid(), p_quantity, coalesce(p_details, '{}'::jsonb), _business_date(v_business), now());
end $$;

-- Cancel an open request, or end an approved discount (keeps what was already recovered).
create or replace function public._close_rescue(p_event uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare ev rescue_events%rowtype; v_role member_role;
begin
  select * into ev from rescue_events where id = p_event for update;
  if not found then perform _err('NOT_FOUND', 'Rescue request not found.'); end if;
  v_role := _role_of(ev.business_id, p_user);
  if v_role is null or v_role = 'cashier' or (ev.status = 'approved' and v_role = 'inventory') then
    perform _err('FORBIDDEN', 'You do not have permission to close this rescue.');
  end if;
  if ev.status not in ('requested', 'listed', 'approved') then perform _err('VALIDATION', 'This rescue is already closed.'); end if;
  if ev.status = 'approved' then
    update product_batches set markdown_pct = 0 where id = ev.batch_id;
    update rescue_events set status = case when confirmed_quantity > 0 then 'confirmed' else 'cancelled' end::rescue_status,
      confirmed_at = now() where id = p_event;
  else
    update rescue_events set status = 'cancelled' where id = p_event;
  end if;
  perform _audit(ev.business_id, p_user, 'rescue.closed', 'rescue_event', p_event, null);
end $$;

create or replace function public.close_rescue(p_event uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then perform _err('NOT_AUTHENTICATED', 'Please sign in again.'); end if;
  perform _close_rescue(p_event, auth.uid());
end $$;
