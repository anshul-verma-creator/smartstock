# SmartStock AI

A retail operating system for Indian kirana shops, grocers and small pharmacies: billing, batch and expiry
tracking, explainable demand forecasts, profit and stock rescue. The interface uses a light pearl,
restrained-orange, frosted-glass design.

> **Current stage: frontend preview.** The full UI runs in the browser against a clearly labelled demo store
> (Sharma Kirana Store). The Supabase schema, RLS and posting functions are written and tested
> (`supabase/migrations`), but they are **not yet connected** to this UI.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5180. The demo store is rebuilt each day (45 days of history, replayed through the same posting
rules), and your changes persist in this browser until you use **Account menu → Reset demo data**.

```bash
npm test
```

```bash
npm run build
```

## What to show

| Screen | Route | Highlights |
|---|---|---|
| Dashboard | `/` | Isometric store hero, floating metrics, hourly weekly-sales bars, alert gauge (documented scale), priorities, expiry watchlist, reorder, performance and forecast, rescue, recent activity |
| Product | `/products/prd_AMUL-TZ1L` | Editorial layout; one product visual travels between sections on scroll and never covers text (checked automatically). Batches with Sell First, location and move, 7-day forecast, records tabs |
| New bill | `/pos` | Search or barcode (USB scanner, camera, typing), FEFO allocation, live GST, cash/UPI/card/credit/split, CSS-3D thermal printer, 80 mm + A4 printing |
| Alerts | `/alerts` | One alert engine shared by the bell, the dashboard and this page; dismissals are saved and reappear when the numbers change |
| AI Insights | `/insights` | Fast/slow movers, stock-out predictions, FEFO expiry risk, recommendation cards with formulas |
| Profit | `/profit` | Month picker, batch-cost gross profit, top selling vs most profitable (ranked separately), per-product unit economics |
| Stock Rescue | `/rescue` | Supplier return, surplus listing, owner-approved discounts that the POS applies automatically, donation; recovery counted once per unit |
| Monthly records | `/reports` | Overview, stock reconciliation (closing = opening + in − out), registers, GST summary, CSV and A4 |

Also: Inventory with CSV import/export, stock movements, purchases and purchase orders, suppliers and payables,
customers and credit (khata), invoice view with void, settings, sign-in and onboarding screens.
Use **Account menu → View as …** to see what Cashier, Manager and Inventory roles can do.

## How the numbers stay honest

- **One tax engine** (`src/lib/tax.ts`) for previews, receipts and posting. The authoritative SQL twin is `calc_tax_line`. Tests cover the spec case: 2 × ₹100 at 18% = ₹236.
- **Stock comes only from movements.** Balances change in the same step as a ledger movement, and tests check that they reconcile.
- **Posting is all-or-nothing.** A failed bill leaves the cart intact, and the same checkout key never creates two invoices.
- **Forecasts are labelled as estimates, and their formulas are shown.** Fewer than 14 days of history shows "not enough data".
- **Printing never saves a bill.** The status shows "Print dialog opened", never "Printed".

## Known limitations

- The UI uses in-browser demo data; sign-in and onboarding validate input but do not create accounts yet.
- No UPI or card processing, GST filing, GSTIN verification, marketplace integration or silent printing.
- Partial sales returns and credit notes are not built yet; full void is.
- GST rates in the demo are illustrative. Have a tax professional review rates and treatment.

## Backend (prepared, not wired)

`supabase/migrations` contains the Postgres schema, row-level security, `SECURITY DEFINER` posting RPCs (sale,
void, purchase, payments, stock and rescue operations, all with idempotency), reporting functions and a demo seeder.
They have been applied and exercised on a local Supabase stack. See `docs/ARCHITECTURE.md`.
