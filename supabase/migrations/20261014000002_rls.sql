-- SmartStock AI — Row Level Security
-- Reads are filtered by membership + role. Ledger/financial tables have NO write policies:
-- they can only be changed through SECURITY DEFINER posting functions that authorise the caller.

create or replace function public.has_role(p_business uuid, p_roles public.member_role[] default null)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.business_memberships m
    where m.business_id = p_business
      and m.user_id = auth.uid()
      and (p_roles is null or m.role = any (p_roles))
  );
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'businesses', 'business_memberships', 'stores', 'locations', 'product_categories',
    'suppliers', 'customers', 'products', 'product_batches', 'stock_balances', 'stock_movements',
    'stock_adjustments', 'invoice_sequences', 'sales', 'sale_items', 'sale_item_allocations',
    'purchase_orders', 'purchase_order_items', 'purchases', 'purchase_items', 'payments',
    'payment_allocations', 'customer_ledger_entries', 'supplier_ledger_entries', 'rescue_events',
    'purchase_returns', 'alert_states', 'audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- profiles: yourself, plus co-members' names (for "created by" labels)
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from public.business_memberships me
    join public.business_memberships them on them.business_id = me.business_id
    where me.user_id = auth.uid() and them.user_id = profiles.id
  )
);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- businesses: members read; owner edits settings. Creation only via create_business().
create policy businesses_select on public.businesses for select to authenticated using (public.has_role(id));
create policy businesses_update on public.businesses for update to authenticated
  using (public.has_role(id, '{owner}')) with check (public.has_role(id, '{owner}'));

create policy memberships_select on public.business_memberships for select to authenticated using (
  user_id = auth.uid() or public.has_role(business_id, '{owner,manager}')
);

create policy stores_select on public.stores for select to authenticated using (public.has_role(business_id));

create policy locations_select on public.locations for select to authenticated using (public.has_role(business_id));
create policy locations_insert on public.locations for insert to authenticated
  with check (public.has_role(business_id, '{owner,manager,inventory}'));
create policy locations_update on public.locations for update to authenticated
  using (public.has_role(business_id, '{owner,manager,inventory}'))
  with check (public.has_role(business_id, '{owner,manager,inventory}'));

create policy categories_select on public.product_categories for select to authenticated using (public.has_role(business_id));
create policy categories_insert on public.product_categories for insert to authenticated
  with check (public.has_role(business_id, '{owner,manager,inventory}'));
create policy categories_update on public.product_categories for update to authenticated
  using (public.has_role(business_id, '{owner,manager,inventory}'))
  with check (public.has_role(business_id, '{owner,manager,inventory}'));

create policy suppliers_select on public.suppliers for select to authenticated
  using (public.has_role(business_id, '{owner,manager,inventory}'));
create policy suppliers_insert on public.suppliers for insert to authenticated
  with check (public.has_role(business_id, '{owner,manager,inventory}'));
create policy suppliers_update on public.suppliers for update to authenticated
  using (public.has_role(business_id, '{owner,manager,inventory}'))
  with check (public.has_role(business_id, '{owner,manager,inventory}'));

-- customers: cashiers need them at the counter
create policy customers_select on public.customers for select to authenticated
  using (public.has_role(business_id, '{owner,manager,cashier}'));
create policy customers_insert on public.customers for insert to authenticated
  with check (public.has_role(business_id, '{owner,manager,cashier}'));
create policy customers_update on public.customers for update to authenticated
  using (public.has_role(business_id, '{owner,manager,cashier}'))
  with check (public.has_role(business_id, '{owner,manager,cashier}'));

create policy products_select on public.products for select to authenticated using (public.has_role(business_id));
create policy products_insert on public.products for insert to authenticated
  with check (public.has_role(business_id, '{owner,manager,inventory}'));
create policy products_update on public.products for update to authenticated
  using (public.has_role(business_id, '{owner,manager,inventory}'))
  with check (public.has_role(business_id, '{owner,manager,inventory}'));
-- hard delete only possible for products without history (FKs restrict otherwise)
create policy products_delete on public.products for delete to authenticated
  using (public.has_role(business_id, '{owner,manager}'));

create policy batches_select on public.product_batches for select to authenticated using (public.has_role(business_id));
create policy balances_select on public.stock_balances for select to authenticated using (public.has_role(business_id));
create policy movements_select on public.stock_movements for select to authenticated using (public.has_role(business_id));
create policy adjustments_select on public.stock_adjustments for select to authenticated
  using (public.has_role(business_id, '{owner,manager,inventory}'));
create policy sequences_select on public.invoice_sequences for select to authenticated
  using (public.has_role(business_id, '{owner,manager}'));

create policy sales_select on public.sales for select to authenticated
  using (public.has_role(business_id, '{owner,manager,cashier}'));
create policy sale_items_select on public.sale_items for select to authenticated
  using (public.has_role(business_id, '{owner,manager,cashier}'));
create policy sale_alloc_select on public.sale_item_allocations for select to authenticated
  using (public.has_role(business_id, '{owner,manager,inventory}'));

create policy po_select on public.purchase_orders for select to authenticated
  using (public.has_role(business_id, '{owner,manager,inventory}'));
create policy po_insert on public.purchase_orders for insert to authenticated
  with check (public.has_role(business_id, '{owner,manager,inventory}') and status in ('draft', 'ordered'));
create policy po_update on public.purchase_orders for update to authenticated
  using (public.has_role(business_id, '{owner,manager,inventory}') and status in ('draft', 'ordered'))
  with check (public.has_role(business_id, '{owner,manager,inventory}') and status in ('draft', 'ordered', 'cancelled'));
create policy po_delete on public.purchase_orders for delete to authenticated
  using (public.has_role(business_id, '{owner,manager,inventory}') and status = 'draft');
create policy poi_select on public.purchase_order_items for select to authenticated
  using (public.has_role(business_id, '{owner,manager,inventory}'));
create policy poi_write on public.purchase_order_items for all to authenticated
  using (public.has_role(business_id, '{owner,manager,inventory}') and exists (
    select 1 from public.purchase_orders po where po.id = purchase_order_id and po.status in ('draft', 'ordered')))
  with check (public.has_role(business_id, '{owner,manager,inventory}') and exists (
    select 1 from public.purchase_orders po where po.id = purchase_order_id and po.business_id = purchase_order_items.business_id and po.status in ('draft', 'ordered')));

create policy purchases_select on public.purchases for select to authenticated
  using (public.has_role(business_id, '{owner,manager,inventory}'));
create policy purchase_items_select on public.purchase_items for select to authenticated
  using (public.has_role(business_id, '{owner,manager,inventory}'));
create policy purchase_returns_select on public.purchase_returns for select to authenticated
  using (public.has_role(business_id, '{owner,manager,inventory}'));

-- payments: cashier sees customer-side money only
create policy payments_select on public.payments for select to authenticated using (
  public.has_role(business_id, '{owner,manager}')
  or (public.has_role(business_id, '{cashier}') and kind in ('sale_receipt', 'customer_repayment', 'refund') and supplier_id is null)
);
create policy allocations_select on public.payment_allocations for select to authenticated using (
  public.has_role(business_id, '{owner,manager}')
  or (public.has_role(business_id, '{cashier}') and sale_id is not null)
);
create policy customer_ledger_select on public.customer_ledger_entries for select to authenticated
  using (public.has_role(business_id, '{owner,manager,cashier}'));
create policy supplier_ledger_select on public.supplier_ledger_entries for select to authenticated
  using (public.has_role(business_id, '{owner,manager,inventory}'));

create policy rescue_select on public.rescue_events for select to authenticated
  using (public.has_role(business_id, '{owner,manager,inventory}'));

create policy alert_states_select on public.alert_states for select to authenticated using (public.has_role(business_id));
create policy alert_states_insert on public.alert_states for insert to authenticated
  with check (public.has_role(business_id) and acted_by = auth.uid());
create policy alert_states_update on public.alert_states for update to authenticated
  using (public.has_role(business_id)) with check (public.has_role(business_id) and acted_by = auth.uid());
create policy alert_states_delete on public.alert_states for delete to authenticated using (public.has_role(business_id));

create policy audit_select on public.audit_logs for select to authenticated
  using (public.has_role(business_id, '{owner,manager}'));

-- anon gets nothing at all
revoke all on all tables in schema public from anon;
