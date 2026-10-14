-- SmartStock AI — demo replay steps and lifecycle (create / continue / delete)

-- Scripted stock-rescue history (runs before the regular sales of day t).
create or replace function public._demo_script(p_business uuid, p_user uuid, p_anchor date, t int, p_cust uuid[]) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  d date := p_anchor + t; v_at timestamptz := (p_anchor + t + time '10:00') at time zone 'Asia/Kolkata';
  v_batch uuid; v_prod uuid; v_ev uuid; q int;
begin
  if t = -12 then
    select id into v_batch from product_batches where business_id = p_business and batch_code = 'DH260930';
    perform _request_rescue(p_business, p_user, 'supplier_return', v_batch, 12,
      '{"reason":"Slow week, 12 days to expiry; supplier accepts returns"}', d, v_at);
  elsif t = -7 then
    select r.id into v_ev from rescue_events r join product_batches b on b.id = r.batch_id
    where r.business_id = p_business and b.batch_code = 'DH260930' and r.rescue_type = 'supplier_return';
    perform _confirm_rescue(v_ev, p_user, 12, '{}', d, v_at);
  elsif t = -10 then
    select b.id into v_batch from product_batches b join products p on p.id = b.product_id
    where p.business_id = p_business and p.sku = 'SPRITE-600' and b.received_on = p_anchor - 110;
    perform _request_rescue(p_business, p_user, 'surplus_sale', v_batch, 24,
      '{"offer_price":26,"reason":"Slow-moving, 9 days to expiry"}', d, v_at);
  elsif t = -8 then
    select r.id into v_ev from rescue_events r join products p on p.id = r.product_id
    where r.business_id = p_business and p.sku = 'SPRITE-600' and r.status = 'listed';
    perform _confirm_rescue(v_ev, p_user, 24, jsonb_build_object('customer_id', p_cust[9], 'method', 'bank'), d, v_at);
  elsif t in (-6, -5) then
    select id, product_id into v_batch, v_prod from product_batches where business_id = p_business and batch_code = 'BR261006';
    if t = -6 then
      v_ev := _request_rescue(p_business, p_user, 'discount', v_batch, 20,
        '{"discount_pct":20,"reason":"3 days to expiry; forecast leaves about 8 unsold"}', d, v_at);
      perform _approve_discount(v_ev, p_user);
    else
      select id into v_ev from rescue_events where batch_id = v_batch and rescue_type = 'discount';
    end if;
    foreach q in array case when t = -6 then array[4, 4] else array[4, 3] end loop
      v_at := v_at + interval '95 minutes';
      perform _post_sale(p_business, p_user, gen_random_uuid(), jsonb_build_object('settle_method', 'cash',
        'lines', jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', q, 'rescue_event_id', v_ev))), d, v_at, false);
    end loop;
  elsif t = -4 then
    select id into v_batch from product_batches where business_id = p_business and batch_code = 'BR261006';
    v_ev := _request_rescue(p_business, p_user, 'donation', v_batch, 5,
      '{"counterparty":"Roti Bank Jaipur","reason":"Unsold but fresh, 1 day to expiry"}', d, v_at);
    perform _confirm_rescue(v_ev, p_user, 5, '{}', d, v_at);
    select id into v_ev from rescue_events where batch_id = v_batch and rescue_type = 'discount';
    perform _close_rescue(v_ev, p_user);
  end if;
end $$;

-- Replays retail sales (and customer repayments) for day offsets p_from..p_to through _post_sale.
create or replace function public._demo_sales_days(p_business uuid, p_user uuid, p_anchor date, p_from int, p_to int) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_cat jsonb := _demo_catalog(); p jsonb; t int; d date; v_qty numeric; v_left numeric; v_chunk numeric;
  v_prod uuid; v_batch uuid; v_k int; v_recv date; v_ninv int; v_inv record; v_r numeric; v_r2 numeric;
  v_payload jsonb; v_cust uuid[]; v_at timestamptz; v_due numeric; v_i int; v_seq int := 0;
begin
  select array_agg(id order by phone) into v_cust from customers where business_id = p_business;
  create temp table if not exists _demo_day (inv int, product_id uuid, batch_id uuid, qty numeric) on commit drop;

  for t in p_from .. p_to loop
    d := p_anchor + t;
    perform _demo_script(p_business, p_user, p_anchor, t, v_cust);
    truncate _demo_day;
    for p in select value from jsonb_array_elements(v_cat) loop
      v_qty := _demo_qty(p, t, p_anchor);
      continue when v_qty <= 0;
      v_k := _demo_period(p);
      v_recv := p_anchor + (-45 + floor((t + 45)::numeric / v_k)::int * v_k);
      select b.id, b.product_id into v_batch, v_prod from product_batches b join products pr on pr.id = b.product_id
      where b.business_id = p_business and pr.sku = p ->> 'sku' and b.batch_code = _demo_lot_code(p, v_recv);
      v_left := v_qty; v_i := 0;
      while v_left > 0 loop
        v_i := v_i + 1; v_seq := v_seq + 1;
        v_r := _demo_rand(p ->> 'sku' || ':' || t || ':c' || v_i);
        v_chunk := least(v_left, case when p ->> 'unit' = 'kg' then 0.5 * (1 + floor(v_r * 4)) else 1 + floor(v_r * 2.4) end);
        insert into _demo_day values (floor(_demo_rand(t || ':s' || v_seq) * 100000)::int, v_prod, v_batch, v_chunk);
        v_left := v_left - v_chunk;
      end loop;
    end loop;

    select greatest(3, ceil(count(*) / 2.3))::int into v_ninv from _demo_day;
    update _demo_day set inv = inv % v_ninv;

    for v_inv in
      select inv, jsonb_agg(jsonb_build_object('product_id', product_id, 'batch_id', batch_id, 'quantity', q)) as lines
      from (select inv, product_id, batch_id, sum(qty) as q from _demo_day group by 1, 2, 3) x
      group by inv order by inv
    loop
      v_r := _demo_rand('pay:' || t || ':' || v_inv.inv);
      v_r2 := _demo_rand('cust:' || t || ':' || v_inv.inv);
      v_at := (d + time '08:30' + (v_inv.inv::numeric / v_ninv) * interval '12 hours'
               + (v_r2 * 40)::int * interval '1 minute') at time zone 'Asia/Kolkata';
      if t = 0 then v_at := least(v_at, now() - (v_ninv - v_inv.inv) * interval '3 minutes'); end if;
      v_payload := jsonb_build_object('lines', v_inv.lines);
      if v_r < 0.40 then
        v_payload := v_payload || '{"settle_method":"cash"}';
      elsif v_r < 0.78 then
        v_payload := v_payload || '{"settle_method":"upi"}';
      elsif v_r < 0.86 then
        v_payload := v_payload || '{"settle_method":"card"}';
      elsif v_r < 0.92 then
        v_payload := v_payload || '{"settle_method":"upi","payments":[{"method":"cash","amount":10}]}';
      else
        v_payload := v_payload || jsonb_build_object('customer_id', v_cust[1 + floor(v_r2 * 8)::int]);
      end if;
      if v_r < 0.92 and v_r2 < 0.12 then
        v_payload := v_payload || jsonb_build_object('customer_id', v_cust[1 + floor(v_r2 * 66)::int % 8]);
      end if;
      perform _post_sale(p_business, p_user, gen_random_uuid(), v_payload, d, v_at, false);
    end loop;

    -- regular customers settle every five days; the last two credit customers stay overdue
    if (t + 45) % 5 = 4 then
      for v_i in 1 .. 6 loop
        select coalesce(sum(amount_due), 0) into v_due from sales where customer_id = v_cust[v_i] and status = 'posted';
        if v_due > 0 then
          perform _record_customer_payment(p_business, p_user, v_cust[v_i],
            least(v_due, round(v_due * (0.6 + 0.4 * _demo_rand('rep:' || t || ':' || v_i)), 0)),
            case when v_i % 2 = 0 then 'upi' else 'cash' end, 'Khata settlement', null, d,
            (d + time '19:15') at time zone 'Asia/Kolkata');
        end if;
      end loop;
    end if;
  end loop;
end $$;

-- Open items that make today's dashboard actionable.
create or replace function public._demo_finish(p_business uuid, p_user uuid, p_anchor date) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_batch uuid; v_po uuid; v_sup uuid; v_at timestamptz := now();
begin
  select id into v_batch from product_batches where business_id = p_business and batch_code = 'BR261012';
  perform _request_rescue(p_business, p_user, 'discount', v_batch, 40,
    '{"discount_pct":15,"reason":"40 packets with 3 days left; about 18 expected to sell at full price"}', p_anchor, v_at);
  select b.id into v_batch from product_batches b join products p on p.id = b.product_id
  where p.business_id = p_business and p.sku = 'SPRITE-600' and b.received_on = p_anchor - 100;
  perform _request_rescue(p_business, p_user, 'surplus_sale', v_batch, 40,
    '{"offer_price":29,"reason":"Slow-moving: about 0.6 sold per day, 20 days to expiry"}', p_anchor, v_at);
  select id into v_batch from product_batches where business_id = p_business and batch_code = 'ORS23J07';
  perform _request_rescue(p_business, p_user, 'supplier_return', v_batch, 6, '{"reason":"Expired, return for credit note"}', p_anchor, v_at);

  select id into v_sup from suppliers where business_id = p_business and name = 'Shree Ganesh Traders';
  insert into purchase_orders (business_id, supplier_id, status, expected_date, notes, created_by)
  values (p_business, v_sup, 'draft', p_anchor + 2, 'Draft from reorder suggestions (demo)', p_user) returning id into v_po;
  insert into purchase_order_items (purchase_order_id, business_id, product_id, quantity, unit_cost)
  select v_po, p_business, p.id, x.q, p.purchase_price
  from (values ('PARLE-G250', 60), ('TATA-SALT1', 40), ('COKE-750', 48)) x(sku, q)
  join products p on p.business_id = p_business and p.sku = x.sku;
end $$;

create or replace function public.create_demo_business() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_id uuid; v_anchor date; v_next int;
begin
  if v_uid is null then perform _err('NOT_AUTHENTICATED', 'Please sign in again.'); end if;
  select b.id into v_id from businesses b join business_memberships m on m.business_id = b.id
  where m.user_id = v_uid and m.role = 'owner' and b.is_demo limit 1;
  if v_id is not null then
    select next_step into v_next from demo_state where business_id = v_id;
    return jsonb_build_object('business_id', v_id, 'next_step', coalesce(v_next, 7), 'total_steps', 6, 'existing', true);
  end if;
  v_anchor := (now() at time zone 'Asia/Kolkata')::date;
  v_id := _create_business_core(v_uid, jsonb_build_object(
    'name', 'Sharma Kirana Store (Demo)', 'business_type', 'kirana',
    'owner_name', coalesce((select full_name from profiles where id = v_uid), 'Demo Owner'),
    'phone', '9414000000', 'address_line', '12, MI Road', 'city', 'Jaipur', 'state_code', '08', 'pincode', '302001',
    'gst_registered', true, 'gstin', '08ABCDE1234F1Z5', 'invoice_prefix', 'SKS', 'expiry_warning_days', 14,
    'low_stock_default', 10, 'receipt_footer', 'DEMO DATA - not a real tax invoice. Thank you, visit again!'), true);
  insert into demo_state (business_id, anchor, next_step) values (v_id, v_anchor, 1);
  perform _demo_setup(v_id, v_uid, v_anchor);
  return jsonb_build_object('business_id', v_id, 'next_step', 1, 'total_steps', 6, 'existing', false);
end $$;

create or replace function public.continue_demo_seed(p_business uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s demo_state%rowtype; v_from int; v_to int;
begin
  if not has_role(p_business, '{owner}') then perform _err('FORBIDDEN', 'Only the owner can build the demo store.'); end if;
  select * into s from demo_state where business_id = p_business for update;
  if not found then perform _err('NOT_FOUND', 'This is not a demo business.'); end if;
  if s.next_step between 1 and 5 then
    v_from := -45 + (s.next_step - 1) * 9;
    v_to := case when s.next_step = 5 then 0 else v_from + 8 end;
    perform _demo_sales_days(p_business, auth.uid(), s.anchor, v_from, v_to);
  elsif s.next_step = 6 then
    perform _demo_finish(p_business, auth.uid(), s.anchor);
  end if;
  update demo_state set next_step = least(s.next_step + 1, 7), updated_at = now() where business_id = p_business;
  return jsonb_build_object('next_step', least(s.next_step + 1, 7), 'total_steps', 6, 'done', s.next_step >= 6);
end $$;

-- Removes the demo business and everything in it. Refuses to touch a real business.
create or replace function public.delete_demo_business(p_business uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not has_role(p_business, '{owner}') then perform _err('FORBIDDEN', 'Only the owner can delete the demo store.'); end if;
  if not coalesce((select is_demo from businesses where id = p_business), false) then
    perform _err('FORBIDDEN', 'Only demo businesses can be deleted. Real business records are never removed.');
  end if;
  delete from businesses where id = p_business;
end $$;
