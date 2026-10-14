# SmartStock AI — Architecture

SmartStock AI is a retail operating system for Indian kirana shops, grocery stores and small pharmacies.
This document is the source of truth for **what is authoritative, where logic lives, and how money and stock move**.

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| UI | React 18 + TypeScript (strict) + Vite | Fast, widely supported |
| Styling | Tailwind CSS 3 + CSS design tokens (`src/styles/tokens.css`) | Pearl/orange frosted-glass system shared by every page |
| Primitives | Radix Dialog / Dropdown / Tabs / Popover | Accessible focus, keyboard and ARIA behaviour |
| Server state | TanStack Query 5 | Caching, retries, invalidation after posting |
| Forms | React Hook Form + Zod | Validated inputs with plain-language errors |
| Charts | Hand-written SVG components (`src/components/charts`) | Fine-bar aesthetic, tiny bundle, truthful axes |
| Backend | Supabase: Postgres 17, Auth, RLS | One trusted transactional engine |
| Business writes | `SECURITY DEFINER` PL/pgSQL RPCs (`supabase/migrations`) | Atomic, authorised, idempotent posting |
| Tests | Vitest (unit: tax/forecast/expiry/reorder; DB: posting, RLS, idempotency) | |

No Edge Functions are used: every privileged operation is a Postgres function that checks
`auth.uid()` membership + role itself, runs inside one transaction and rolls back on any error.
The service-role key is never used by the browser.

## 2. Authoritative records vs derived values

| Authoritative (append-only ledgers / documents) | Derived (maintained atomically or computed) |
|---|---|
| `stock_movements` — every quantity change, signed, with unit-cost snapshot | `stock_balances` (per batch × location) updated in the same transaction as each movement; `check_stock_integrity()` reconciles them |
| `sales` + `sale_items` + `sale_item_allocations` — immutable invoice snapshots incl. tax split and realised batch cost | Dashboard / monthly figures (SQL report functions read these snapshots, never recompute tax) |
| `payments` + `payment_allocations` | `sales.amount_paid`, `purchases.amount_paid` (maintained by the posting functions) |
| `customer_ledger_entries`, `supplier_ledger_entries` | Customer dues / supplier payables = Σ ledger |
| `purchases` + `purchase_items`, `purchase_returns` | Product "last cost" (`products.purchase_price`) |
| `rescue_events` (+ sale lines tagged with `rescue_event_id`) | Stock-rescue recovery analytics |
| `audit_logs` | — |

Business settings live as columns on `businesses` (one row per business) to avoid a second source of truth.

## 3. Entity map

```
auth.users ─1:1─ profiles
businesses ─< business_memberships >─ auth.users      (role: owner | manager | cashier | inventory)
businesses ─< stores ─< locations (Block → Rack → Shelf, kind shelf|backroom)
businesses ─< product_categories, suppliers, customers, invoice_sequences
products ─< product_batches ─< stock_balances (× locations)
         └─< stock_movements (batch, location, type, qty±, unit_cost, ref)
sales ─< sale_items ─< sale_item_allocations (batch, location, qty, unit_cost)
sales ─< payment_allocations >─ payments >─ purchases
customers ─< customer_ledger_entries     suppliers ─< supplier_ledger_entries
purchases ─< purchase_items              purchase_orders ─< purchase_order_items (reorder drafts)
rescue_events (supplier_return | surplus_sale | discount | donation) → purchase_returns / sale_items
alert_states (persisted dismissals)      audit_logs
```

Every non-batch-tracked product still gets internal *lots* (one per receipt, hidden in the UI).
This gives FIFO costing and identical stock code paths for every product.

## 4. Core workflows

**Sale posting** — `post_sale(business_id, idempotency_key, payload)`:
auth → membership/role → idempotency check (returns the existing invoice on retry) → validate cart, discounts
(cashier limit) and customer → lock FEFO batches (`FOR UPDATE`), refuse expired stock when the business blocks it
→ authoritative GST maths (`calc_tax_line`) → reject if the client total differs (stale prices) →
next invoice number (row-locked per financial year) → insert sale, items, allocations, tax snapshot →
payments + allocations → stock movements + balances → customer ledger (credit) → audit log → commit.
Any failure raises and the whole transaction rolls back; the POS keeps the cart.

**Void** — `void_sale` (owner/manager): never edits values; adds reversing stock movements to the original
batches/locations, refund payments, ledger credit and an audit entry; marks the sale `voided`.

**Purchase** — `post_purchase`: creates/extends batches, movements, balances, supplier ledger, optional payment, PO receipt.

**Payments** — `record_customer_payment` / `record_supplier_payment` allocate oldest-first, never exceed dues,
never create sales or change stock.

**Stock** — `add_stock` (opening/found), `adjust_stock` (count correction, damage, loss, expiry write-off), `transfer_stock`
(shelf ↔ backroom; total unchanged).

**Stock rescue** — request → (approve for discounts) → confirm. Supplier return creates a purchase-return movement
and a supplier credit; a surplus sale posts a real invoice to the buyer; an approved discount tags POS lines;
donation is an auditable stock-out. Recovery is summed per event, so a unit is counted once.

## 5. Tax engine

`supabase/migrations/*_posting.sql::calc_tax_line` is authoritative at posting time.
`src/lib/tax.ts` mirrors it exactly (decimal.js, half-up) for the live POS preview; `src/lib/tax.test.ts`
contains the shared fixtures and `tests/db/posting.test.ts` checks the database produces the same numbers.
See `docs/TAX.md` for rules and assumptions that need professional review.

## 6. Roles

| Capability | owner | manager | cashier | inventory |
|---|---|---|---|---|
| POS / create bills, view & reprint sales | ✓ | ✓ | ✓ | – |
| Void sale, approve rescue discount | ✓ | ✓ | – | – |
| Customers, record customer repayment | ✓ | ✓ | ✓ | – |
| Products, stock adjust/transfer, purchases, suppliers, POs, rescue requests | ✓ | ✓ | – | ✓ |
| Reports, profit, monthly records, audit log | ✓ | ✓ | – | – |
| Business settings, members, demo reset | ✓ | – | – | – |

Enforced in RLS (reads) and inside each RPC (writes). The UI hides what a role cannot do, but hiding is not the control.

## 7. Phased checklist

- [x] Database: schema, RLS, posting RPCs, reporting, demo seeder (applied and exercised locally; seeding reconciles, integrity check clean)
- [x] Frontend: design system, all screens, in-browser posting engine mirroring the RPC rules, 3D printer, scroll-linked product stage
- [x] Unit tests: GST engine, forecasting/expiry risk/reorder, demo reconciliation, posting engine (29 tests)
- [ ] Wire UI to Supabase (auth, queries, RPC calls) — next phase, on request
- [ ] DB integration tests for RLS/idempotency through the API; partial returns and credit notes

The frontend currently runs on `src/data/*` (in-browser store). `src/data/engine.ts` applies the same rules as the
SQL functions so that swapping in Supabase RPCs does not change the behaviour of any screen.
