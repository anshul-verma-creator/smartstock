
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "alert_states": {
                  Row: {
                    "acted_at": string,"acted_by": string,"alert_key": string,"business_id": string,"snoozed_until": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acted_at"?: string,"acted_by"?: string,"alert_key": string,"business_id": string,"snoozed_until"?: string | null,"status": string
                  }
                  Update: {
                    "acted_at"?: string,"acted_by"?: string,"alert_key"?: string,"business_id"?: string,"snoozed_until"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_states_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor": string | null,"business_id": string,"created_at": string,"details": Json | null,"entity_id": string | null,"entity_type": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor"?: string | null,"business_id": string,"created_at"?: string,"details"?: Json | null,"entity_id"?: string | null,"entity_type": string,"id"?: string
                  }
                  Update: {
                    "action"?: string,"actor"?: string | null,"business_id"?: string,"created_at"?: string,"details"?: Json | null,"entity_id"?: string | null,"entity_type"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"business_memberships": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"role": Database["public"]['Enums']["member_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"role": Database["public"]['Enums']["member_role"],"user_id": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"role"?: Database["public"]['Enums']["member_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_memberships_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"businesses": {
                  Row: {
                    "address_line": string | null,"block_expired_sales": boolean,"business_type": Database["public"]['Enums']["business_type"],"cashier_max_discount_pct": number,"city": string | null,"created_at": string,"created_by": string | null,"email": string | null,"expiry_warning_days": number,"fy_start_month": number,"gst_registered": boolean,"gstin": string | null,"id": string,"invoice_prefix": string,"is_demo": boolean,"low_stock_default": number,"name": string,"owner_name": string | null,"phone": string | null,"pincode": string | null,"receipt_footer": string | null,"round_off_invoices": boolean,"state_code": string,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address_line"?: string | null,"block_expired_sales"?: boolean,"business_type"?: Database["public"]['Enums']["business_type"],"cashier_max_discount_pct"?: number,"city"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"expiry_warning_days"?: number,"fy_start_month"?: number,"gst_registered"?: boolean,"gstin"?: string | null,"id"?: string,"invoice_prefix"?: string,"is_demo"?: boolean,"low_stock_default"?: number,"name": string,"owner_name"?: string | null,"phone"?: string | null,"pincode"?: string | null,"receipt_footer"?: string | null,"round_off_invoices"?: boolean,"state_code": string,"timezone"?: string
                  }
                  Update: {
                    "address_line"?: string | null,"block_expired_sales"?: boolean,"business_type"?: Database["public"]['Enums']["business_type"],"cashier_max_discount_pct"?: number,"city"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"expiry_warning_days"?: number,"fy_start_month"?: number,"gst_registered"?: boolean,"gstin"?: string | null,"id"?: string,"invoice_prefix"?: string,"is_demo"?: boolean,"low_stock_default"?: number,"name"?: string,"owner_name"?: string | null,"phone"?: string | null,"pincode"?: string | null,"receipt_footer"?: string | null,"round_off_invoices"?: boolean,"state_code"?: string,"timezone"?: string
                  }
                  Relationships: [
                    
                  ]
                },"customer_ledger_entries": {
                  Row: {
                    "business_date": string,"business_id": string,"created_at": string,"credit": number,"customer_id": string,"debit": number,"entry_type": string,"id": string,"note": string | null,"payment_id": string | null,"sale_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_date": string,"business_id": string,"created_at"?: string,"credit"?: number,"customer_id": string,"debit"?: number,"entry_type": string,"id"?: string,"note"?: string | null,"payment_id"?: string | null,"sale_id"?: string | null
                  }
                  Update: {
                    "business_date"?: string,"business_id"?: string,"created_at"?: string,"credit"?: number,"customer_id"?: string,"debit"?: number,"entry_type"?: string,"id"?: string,"note"?: string | null,"payment_id"?: string | null,"sale_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "customer_ledger_entries_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "customer_ledger_entries_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "customer_ledger_entries_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "customer_ledger_entries_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    }
                  ]
                },"customers": {
                  Row: {
                    "address": string | null,"business_id": string,"created_at": string,"credit_days": number,"credit_limit": number | null,"email": string | null,"gstin": string | null,"id": string,"name": string,"notes": string | null,"phone": string | null,"state_code": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"business_id": string,"created_at"?: string,"credit_days"?: number,"credit_limit"?: number | null,"email"?: string | null,"gstin"?: string | null,"id"?: string,"name": string,"notes"?: string | null,"phone"?: string | null,"state_code"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"business_id"?: string,"created_at"?: string,"credit_days"?: number,"credit_limit"?: number | null,"email"?: string | null,"gstin"?: string | null,"id"?: string,"name"?: string,"notes"?: string | null,"phone"?: string | null,"state_code"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "customers_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"demo_state": {
                  Row: {
                    "anchor": string,"business_id": string,"next_step": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anchor": string,"business_id": string,"next_step"?: number,"updated_at"?: string
                  }
                  Update: {
                    "anchor"?: string,"business_id"?: string,"next_step"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "demo_state_business_id_fkey"
      columns: ["business_id"]
isOneToOne: true
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"invoice_sequences": {
                  Row: {
                    "business_id": string,"fy_label": string,"next_number": number
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"fy_label": string,"next_number"?: number
                  }
                  Update: {
                    "business_id"?: string,"fy_label"?: string,"next_number"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoice_sequences_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"locations": {
                  Row: {
                    "block": string,"business_id": string,"created_at": string,"id": string,"kind": Database["public"]['Enums']["location_kind"],"rack": string | null,"shelf": string | null,"store_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "block": string,"business_id": string,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["location_kind"],"rack"?: string | null,"shelf"?: string | null,"store_id": string
                  }
                  Update: {
                    "block"?: string,"business_id"?: string,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["location_kind"],"rack"?: string | null,"shelf"?: string | null,"store_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "locations_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "locations_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_allocations": {
                  Row: {
                    "amount": number,"business_id": string,"id": string,"payment_id": string,"purchase_id": string | null,"sale_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"business_id": string,"id"?: string,"payment_id": string,"purchase_id"?: string | null,"sale_id"?: string | null
                  }
                  Update: {
                    "amount"?: number,"business_id"?: string,"id"?: string,"payment_id"?: string,"purchase_id"?: string | null,"sale_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_allocations_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_allocations_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_allocations_purchase_id_fkey"
      columns: ["purchase_id"]
isOneToOne: false
      referencedRelation: "purchases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_allocations_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"business_date": string,"business_id": string,"created_by": string | null,"customer_id": string | null,"direction": string,"id": string,"idempotency_key": string | null,"kind": string,"method": Database["public"]['Enums']["payment_method"],"notes": string | null,"paid_at": string,"reference": string | null,"supplier_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"business_date": string,"business_id": string,"created_by"?: string | null,"customer_id"?: string | null,"direction": string,"id"?: string,"idempotency_key"?: string | null,"kind": string,"method": Database["public"]['Enums']["payment_method"],"notes"?: string | null,"paid_at"?: string,"reference"?: string | null,"supplier_id"?: string | null
                  }
                  Update: {
                    "amount"?: number,"business_date"?: string,"business_id"?: string,"created_by"?: string | null,"customer_id"?: string | null,"direction"?: string,"id"?: string,"idempotency_key"?: string | null,"kind"?: string,"method"?: Database["public"]['Enums']["payment_method"],"notes"?: string | null,"paid_at"?: string,"reference"?: string | null,"supplier_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"product_batches": {
                  Row: {
                    "batch_code": string,"business_id": string,"created_at": string,"expiry_date": string | null,"id": string,"is_internal": boolean,"markdown_pct": number,"product_id": string,"received_on": string,"supplier_id": string | null,"unit_cost": number
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_code": string,"business_id": string,"created_at"?: string,"expiry_date"?: string | null,"id"?: string,"is_internal"?: boolean,"markdown_pct"?: number,"product_id": string,"received_on": string,"supplier_id"?: string | null,"unit_cost": number
                  }
                  Update: {
                    "batch_code"?: string,"business_id"?: string,"created_at"?: string,"expiry_date"?: string | null,"id"?: string,"is_internal"?: boolean,"markdown_pct"?: number,"product_id"?: string,"received_on"?: string,"supplier_id"?: string | null,"unit_cost"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_batches_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_batches_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_batches_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"product_categories": {
                  Row: {
                    "business_id": string,"created_at": string,"default_gst_rate": number,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"default_gst_rate"?: number,"id"?: string,"name": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"default_gst_rate"?: number,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_categories_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "barcode": string | null,"brand": string | null,"business_id": string,"category_id": string | null,"cess_rate": number,"created_at": string,"default_location_id": string | null,"description": string | null,"gst_rate": number,"hsn_code": string | null,"id": string,"min_stock": number,"mrp": number | null,"name": string,"price_includes_tax": boolean,"purchase_price": number,"selling_price": number,"shelf_life_days": number | null,"sku": string,"status": string,"supplier_id": string | null,"track_batches": boolean,"track_expiry": boolean,"unit": string,"updated_at": string,"visual": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "barcode"?: string | null,"brand"?: string | null,"business_id": string,"category_id"?: string | null,"cess_rate"?: number,"created_at"?: string,"default_location_id"?: string | null,"description"?: string | null,"gst_rate"?: number,"hsn_code"?: string | null,"id"?: string,"min_stock"?: number,"mrp"?: number | null,"name": string,"price_includes_tax"?: boolean,"purchase_price"?: number,"selling_price": number,"shelf_life_days"?: number | null,"sku": string,"status"?: string,"supplier_id"?: string | null,"track_batches"?: boolean,"track_expiry"?: boolean,"unit"?: string,"updated_at"?: string,"visual"?: NonNullable<Json>
                  }
                  Update: {
                    "barcode"?: string | null,"brand"?: string | null,"business_id"?: string,"category_id"?: string | null,"cess_rate"?: number,"created_at"?: string,"default_location_id"?: string | null,"description"?: string | null,"gst_rate"?: number,"hsn_code"?: string | null,"id"?: string,"min_stock"?: number,"mrp"?: number | null,"name"?: string,"price_includes_tax"?: boolean,"purchase_price"?: number,"selling_price"?: number,"shelf_life_days"?: number | null,"sku"?: string,"status"?: string,"supplier_id"?: string | null,"track_batches"?: boolean,"track_expiry"?: boolean,"unit"?: string,"updated_at"?: string,"visual"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "product_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_default_location_id_fkey"
      columns: ["default_location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string | null,"id": string,"phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name"?: string | null,"id": string,"phone"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string | null,"id"?: string,"phone"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"purchase_items": {
                  Row: {
                    "batch_id": string,"business_id": string,"gst_rate": number,"id": string,"line_total": number,"location_id": string,"product_id": string,"purchase_id": string,"quantity": number,"tax_amount": number,"taxable_value": number,"unit_cost": number
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_id": string,"business_id": string,"gst_rate"?: number,"id"?: string,"line_total": number,"location_id": string,"product_id": string,"purchase_id": string,"quantity": number,"tax_amount"?: number,"taxable_value": number,"unit_cost": number
                  }
                  Update: {
                    "batch_id"?: string,"business_id"?: string,"gst_rate"?: number,"id"?: string,"line_total"?: number,"location_id"?: string,"product_id"?: string,"purchase_id"?: string,"quantity"?: number,"tax_amount"?: number,"taxable_value"?: number,"unit_cost"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_items_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "product_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_items_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_items_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_items_purchase_id_fkey"
      columns: ["purchase_id"]
isOneToOne: false
      referencedRelation: "purchases"
      referencedColumns: ["id"]
    }
                  ]
                },"purchase_order_items": {
                  Row: {
                    "basis": Json | null,"business_id": string,"id": string,"product_id": string,"purchase_order_id": string,"quantity": number,"unit_cost": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "basis"?: Json | null,"business_id": string,"id"?: string,"product_id": string,"purchase_order_id": string,"quantity": number,"unit_cost"?: number | null
                  }
                  Update: {
                    "basis"?: Json | null,"business_id"?: string,"id"?: string,"product_id"?: string,"purchase_order_id"?: string,"quantity"?: number,"unit_cost"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_order_items_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
      columns: ["purchase_order_id"]
isOneToOne: false
      referencedRelation: "purchase_orders"
      referencedColumns: ["id"]
    }
                  ]
                },"purchase_orders": {
                  Row: {
                    "business_id": string,"created_at": string,"created_by": string | null,"expected_date": string | null,"id": string,"notes": string | null,"status": Database["public"]['Enums']["po_status"],"supplier_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"created_by"?: string | null,"expected_date"?: string | null,"id"?: string,"notes"?: string | null,"status"?: Database["public"]['Enums']["po_status"],"supplier_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"created_by"?: string | null,"expected_date"?: string | null,"id"?: string,"notes"?: string | null,"status"?: Database["public"]['Enums']["po_status"],"supplier_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_orders_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_orders_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"purchase_returns": {
                  Row: {
                    "batch_id": string,"business_date": string,"business_id": string,"created_at": string,"created_by": string | null,"id": string,"product_id": string,"quantity": number,"reason": string | null,"rescue_event_id": string | null,"supplier_id": string,"unit_cost": number,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_id": string,"business_date": string,"business_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"product_id": string,"quantity": number,"reason"?: string | null,"rescue_event_id"?: string | null,"supplier_id": string,"unit_cost": number,"value": number
                  }
                  Update: {
                    "batch_id"?: string,"business_date"?: string,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"product_id"?: string,"quantity"?: number,"reason"?: string | null,"rescue_event_id"?: string | null,"supplier_id"?: string,"unit_cost"?: number,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_returns_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "product_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_returns_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_returns_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_returns_rescue_event_id_fkey"
      columns: ["rescue_event_id"]
isOneToOne: false
      referencedRelation: "rescue_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_returns_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"purchases": {
                  Row: {
                    "amount_due": number,"amount_paid": number,"bill_date": string,"bill_number": string | null,"business_id": string,"created_at": string,"created_by": string | null,"grand_total": number,"id": string,"idempotency_key": string,"notes": string | null,"purchase_order_id": string | null,"store_id": string,"supplier_id": string,"supply_type": string,"tax_total": number,"taxable_total": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_due"?: number,"amount_paid"?: number,"bill_date": string,"bill_number"?: string | null,"business_id": string,"created_at"?: string,"created_by"?: string | null,"grand_total": number,"id"?: string,"idempotency_key": string,"notes"?: string | null,"purchase_order_id"?: string | null,"store_id": string,"supplier_id": string,"supply_type"?: string,"tax_total"?: number,"taxable_total": number
                  }
                  Update: {
                    "amount_due"?: number,"amount_paid"?: number,"bill_date"?: string,"bill_number"?: string | null,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"grand_total"?: number,"id"?: string,"idempotency_key"?: string,"notes"?: string | null,"purchase_order_id"?: string | null,"store_id"?: string,"supplier_id"?: string,"supply_type"?: string,"tax_total"?: number,"taxable_total"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchases_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchases_purchase_order_id_fkey"
      columns: ["purchase_order_id"]
isOneToOne: false
      referencedRelation: "purchase_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchases_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchases_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"rescue_events": {
                  Row: {
                    "batch_id": string,"business_date": string,"business_id": string,"confirmed_at": string | null,"confirmed_by": string | null,"confirmed_quantity": number,"counterparty": string | null,"created_at": string,"customer_id": string | null,"discount_pct": number | null,"id": string,"offer_price": number | null,"product_id": string,"quantity": number,"reason": string | null,"recovered_value": number,"requested_by": string | null,"rescue_type": Database["public"]['Enums']["rescue_type"],"sale_id": string | null,"status": Database["public"]['Enums']["rescue_status"],"supplier_id": string | null,"unit_cost": number
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_id": string,"business_date": string,"business_id": string,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"confirmed_quantity"?: number,"counterparty"?: string | null,"created_at"?: string,"customer_id"?: string | null,"discount_pct"?: number | null,"id"?: string,"offer_price"?: number | null,"product_id": string,"quantity": number,"reason"?: string | null,"recovered_value"?: number,"requested_by"?: string | null,"rescue_type": Database["public"]['Enums']["rescue_type"],"sale_id"?: string | null,"status": Database["public"]['Enums']["rescue_status"],"supplier_id"?: string | null,"unit_cost": number
                  }
                  Update: {
                    "batch_id"?: string,"business_date"?: string,"business_id"?: string,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"confirmed_quantity"?: number,"counterparty"?: string | null,"created_at"?: string,"customer_id"?: string | null,"discount_pct"?: number | null,"id"?: string,"offer_price"?: number | null,"product_id"?: string,"quantity"?: number,"reason"?: string | null,"recovered_value"?: number,"requested_by"?: string | null,"rescue_type"?: Database["public"]['Enums']["rescue_type"],"sale_id"?: string | null,"status"?: Database["public"]['Enums']["rescue_status"],"supplier_id"?: string | null,"unit_cost"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "rescue_events_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "product_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rescue_events_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rescue_events_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rescue_events_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rescue_events_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rescue_events_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"sale_item_allocations": {
                  Row: {
                    "batch_id": string,"business_id": string,"id": string,"location_id": string,"quantity": number,"sale_item_id": string,"unit_cost": number
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_id": string,"business_id": string,"id"?: string,"location_id": string,"quantity": number,"sale_item_id": string,"unit_cost": number
                  }
                  Update: {
                    "batch_id"?: string,"business_id"?: string,"id"?: string,"location_id"?: string,"quantity"?: number,"sale_item_id"?: string,"unit_cost"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_item_allocations_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "product_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_item_allocations_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_item_allocations_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_item_allocations_sale_item_id_fkey"
      columns: ["sale_item_id"]
isOneToOne: false
      referencedRelation: "sale_items"
      referencedColumns: ["id"]
    }
                  ]
                },"sale_items": {
                  Row: {
                    "business_id": string,"cess": number,"cess_rate": number,"cgst": number,"cost_total": number,"gross": number,"gst_rate": number,"hsn_code": string | null,"id": string,"igst": number,"invoice_discount_share": number,"line_discount": number,"line_no": number,"line_total": number,"price_includes_tax": boolean,"product_id": string,"product_name": string,"quantity": number,"rescue_event_id": string | null,"sale_id": string,"sgst": number,"sku": string,"taxable_value": number,"unit": string,"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"cess"?: number,"cess_rate"?: number,"cgst"?: number,"cost_total"?: number,"gross": number,"gst_rate": number,"hsn_code"?: string | null,"id"?: string,"igst"?: number,"invoice_discount_share"?: number,"line_discount"?: number,"line_no": number,"line_total": number,"price_includes_tax": boolean,"product_id": string,"product_name": string,"quantity": number,"rescue_event_id"?: string | null,"sale_id": string,"sgst"?: number,"sku": string,"taxable_value": number,"unit": string,"unit_price": number
                  }
                  Update: {
                    "business_id"?: string,"cess"?: number,"cess_rate"?: number,"cgst"?: number,"cost_total"?: number,"gross"?: number,"gst_rate"?: number,"hsn_code"?: string | null,"id"?: string,"igst"?: number,"invoice_discount_share"?: number,"line_discount"?: number,"line_no"?: number,"line_total"?: number,"price_includes_tax"?: boolean,"product_id"?: string,"product_name"?: string,"quantity"?: number,"rescue_event_id"?: string | null,"sale_id"?: string,"sgst"?: number,"sku"?: string,"taxable_value"?: number,"unit"?: string,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_items_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_items_rescue_fk"
      columns: ["rescue_event_id"]
isOneToOne: false
      referencedRelation: "rescue_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_items_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    }
                  ]
                },"sales": {
                  Row: {
                    "amount_due": number,"amount_paid": number,"business_id": string,"business_snapshot": NonNullable<Json>,"cess_total": number,"cgst_total": number,"cost_total": number,"created_by": string | null,"customer_gstin": string | null,"customer_id": string | null,"customer_name": string | null,"customer_phone": string | null,"discount_total": number,"document_type": string,"fy_label": string,"grand_total": number,"gross_amount": number,"id": string,"idempotency_key": string,"igst_total": number,"invoice_date": string,"invoice_number": string,"items_count": number,"notes": string | null,"place_of_supply": string,"posted_at": string,"round_off": number,"sgst_total": number,"status": Database["public"]['Enums']["sale_status"],"store_id": string,"supply_type": string,"tax_total": number,"taxable_total": number,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_due"?: number,"amount_paid"?: number,"business_id": string,"business_snapshot": NonNullable<Json>,"cess_total"?: number,"cgst_total"?: number,"cost_total"?: number,"created_by"?: string | null,"customer_gstin"?: string | null,"customer_id"?: string | null,"customer_name"?: string | null,"customer_phone"?: string | null,"discount_total"?: number,"document_type": string,"fy_label": string,"grand_total": number,"gross_amount": number,"id"?: string,"idempotency_key": string,"igst_total"?: number,"invoice_date": string,"invoice_number": string,"items_count": number,"notes"?: string | null,"place_of_supply": string,"posted_at"?: string,"round_off"?: number,"sgst_total"?: number,"status"?: Database["public"]['Enums']["sale_status"],"store_id": string,"supply_type": string,"tax_total"?: number,"taxable_total": number,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "amount_due"?: number,"amount_paid"?: number,"business_id"?: string,"business_snapshot"?: NonNullable<Json>,"cess_total"?: number,"cgst_total"?: number,"cost_total"?: number,"created_by"?: string | null,"customer_gstin"?: string | null,"customer_id"?: string | null,"customer_name"?: string | null,"customer_phone"?: string | null,"discount_total"?: number,"document_type"?: string,"fy_label"?: string,"grand_total"?: number,"gross_amount"?: number,"id"?: string,"idempotency_key"?: string,"igst_total"?: number,"invoice_date"?: string,"invoice_number"?: string,"items_count"?: number,"notes"?: string | null,"place_of_supply"?: string,"posted_at"?: string,"round_off"?: number,"sgst_total"?: number,"status"?: Database["public"]['Enums']["sale_status"],"store_id"?: string,"supply_type"?: string,"tax_total"?: number,"taxable_total"?: number,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_adjustments": {
                  Row: {
                    "batch_id": string,"business_date": string,"business_id": string,"created_at": string,"created_by": string | null,"id": string,"location_id": string,"note": string | null,"product_id": string,"quantity_change": number,"reason": string
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_id": string,"business_date": string,"business_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"location_id": string,"note"?: string | null,"product_id": string,"quantity_change": number,"reason": string
                  }
                  Update: {
                    "batch_id"?: string,"business_date"?: string,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"location_id"?: string,"note"?: string | null,"product_id"?: string,"quantity_change"?: number,"reason"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_adjustments_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "product_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_adjustments_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_adjustments_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_adjustments_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_balances": {
                  Row: {
                    "batch_id": string,"business_id": string,"location_id": string,"product_id": string,"quantity": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_id": string,"business_id": string,"location_id": string,"product_id": string,"quantity": number,"updated_at"?: string
                  }
                  Update: {
                    "batch_id"?: string,"business_id"?: string,"location_id"?: string,"product_id"?: string,"quantity"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_balances_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "product_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_balances_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_balances_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_balances_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_movements": {
                  Row: {
                    "batch_id": string,"business_date": string,"business_id": string,"created_by": string | null,"id": string,"location_id": string,"movement_type": Database["public"]['Enums']["movement_type"],"note": string | null,"occurred_at": string,"product_id": string,"quantity": number,"ref_id": string | null,"ref_type": string | null,"unit_cost": number
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_id": string,"business_date": string,"business_id": string,"created_by"?: string | null,"id"?: string,"location_id": string,"movement_type": Database["public"]['Enums']["movement_type"],"note"?: string | null,"occurred_at"?: string,"product_id": string,"quantity": number,"ref_id"?: string | null,"ref_type"?: string | null,"unit_cost": number
                  }
                  Update: {
                    "batch_id"?: string,"business_date"?: string,"business_id"?: string,"created_by"?: string | null,"id"?: string,"location_id"?: string,"movement_type"?: Database["public"]['Enums']["movement_type"],"note"?: string | null,"occurred_at"?: string,"product_id"?: string,"quantity"?: number,"ref_id"?: string | null,"ref_type"?: string | null,"unit_cost"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "product_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"stores": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"is_default": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"is_default"?: boolean,"name": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"is_default"?: boolean,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stores_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"supplier_ledger_entries": {
                  Row: {
                    "business_date": string,"business_id": string,"created_at": string,"credit": number,"debit": number,"entry_type": string,"id": string,"note": string | null,"payment_id": string | null,"purchase_id": string | null,"purchase_return_id": string | null,"supplier_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_date": string,"business_id": string,"created_at"?: string,"credit"?: number,"debit"?: number,"entry_type": string,"id"?: string,"note"?: string | null,"payment_id"?: string | null,"purchase_id"?: string | null,"purchase_return_id"?: string | null,"supplier_id": string
                  }
                  Update: {
                    "business_date"?: string,"business_id"?: string,"created_at"?: string,"credit"?: number,"debit"?: number,"entry_type"?: string,"id"?: string,"note"?: string | null,"payment_id"?: string | null,"purchase_id"?: string | null,"purchase_return_id"?: string | null,"supplier_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "supplier_ledger_entries_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "supplier_ledger_entries_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "supplier_ledger_entries_purchase_id_fkey"
      columns: ["purchase_id"]
isOneToOne: false
      referencedRelation: "purchases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "supplier_ledger_entries_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "supplier_ledger_return_fk"
      columns: ["purchase_return_id"]
isOneToOne: false
      referencedRelation: "purchase_returns"
      referencedColumns: ["id"]
    }
                  ]
                },"suppliers": {
                  Row: {
                    "accepts_returns": boolean,"address": string | null,"business_id": string,"contact_person": string | null,"created_at": string,"email": string | null,"gstin": string | null,"id": string,"is_active": boolean,"lead_time_days": number,"name": string,"notes": string | null,"phone": string | null,"state_code": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepts_returns"?: boolean,"address"?: string | null,"business_id": string,"contact_person"?: string | null,"created_at"?: string,"email"?: string | null,"gstin"?: string | null,"id"?: string,"is_active"?: boolean,"lead_time_days"?: number,"name": string,"notes"?: string | null,"phone"?: string | null,"state_code"?: string | null
                  }
                  Update: {
                    "accepts_returns"?: boolean,"address"?: string | null,"business_id"?: string,"contact_person"?: string | null,"created_at"?: string,"email"?: string | null,"gstin"?: string | null,"id"?: string,"is_active"?: boolean,"lead_time_days"?: number,"name"?: string,"notes"?: string | null,"phone"?: string | null,"state_code"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "suppliers_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "customer_balances": {
                  Row: {
                    "balance": number | null,"business_id": string | null,"customer_id": string | null,"last_activity": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "customer_ledger_entries_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "customer_ledger_entries_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    }
                  ]
                },"product_stock": {
                  Row: {
                    "backroom_quantity": number | null,"business_id": string | null,"product_id": string | null,"quantity": number | null,"shelf_quantity": number | null,"stock_value": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "stock_balances_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_balances_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"supplier_balances": {
                  Row: {
                    "balance": number | null,"business_id": string | null,"last_activity": string | null,"supplier_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "supplier_ledger_entries_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "supplier_ledger_entries_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "_approve_discount":
{ Args: { "p_event": string,"p_user": string }; Returns: undefined
                           },
"_audit":
{ Args: { "p_action": string,"p_business": string,"p_details": Json,"p_entity": string,"p_id": string,"p_user": string }; Returns: undefined
                           },
"_business_date":
{ Args: { "p_business": string }; Returns: string
                           },
"_close_rescue":
{ Args: { "p_event": string,"p_user": string }; Returns: undefined
                           },
"_confirm_rescue":
{ Args: { "p_at": string,"p_date": string,"p_details": Json,"p_event": string,"p_quantity": number,"p_user": string }; Returns: Json
                           },
"_create_business_core":
{ Args: { "p_is_demo": boolean,"p_payload": Json,"p_user": string }; Returns: string
                           },
"_default_location":
{ Args: { "p_business": string,"p_kind": Database["public"]['Enums']["location_kind"] }; Returns: string
                           },
"_demo_catalog":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"_demo_finish":
{ Args: { "p_anchor": string,"p_business": string,"p_user": string }; Returns: undefined
                           },
"_demo_lot_code":
{ Args: { "p": Json,"p_recv": string }; Returns: string
                           },
"_demo_period":
{ Args: { "p": Json }; Returns: number
                           },
"_demo_qty":
{ Args: { "p": Json,"p_anchor": string,"t": number }; Returns: number
                           },
"_demo_rand":
{ Args: { "p_seed": string }; Returns: number
                           },
"_demo_sales_days":
{ Args: { "p_anchor": string,"p_business": string,"p_from": number,"p_to": number,"p_user": string }; Returns: undefined
                           },
"_demo_script":
{ Args: { "p_anchor": string,"p_business": string,"p_cust": (string)[],"p_user": string,"t": number }; Returns: undefined
                           },
"_demo_setup":
{ Args: { "p_anchor": string,"p_business": string,"p_user": string }; Returns: undefined
                           },
"_err":
{ Args: { "p_code": string,"p_message": string }; Returns: undefined
                           },
"_fy_label":
{ Args: { "p_business": string,"p_date": string }; Returns: string
                           },
"_move_stock":
{ Args: { "p_at"?: string,"p_batch": string,"p_business": string,"p_date": string,"p_location": string,"p_note": string,"p_product": string,"p_qty": number,"p_ref_id": string,"p_ref_type": string,"p_type": Database["public"]['Enums']["movement_type"],"p_unit_cost": number,"p_user": string }; Returns: undefined
                           },
"_post_purchase":
{ Args: { "p_at": string,"p_business": string,"p_date": string,"p_key": string,"p_payload": Json,"p_user": string }; Returns: Json
                           },
"_post_sale":
{ Args: { "p_at": string,"p_business": string,"p_date": string,"p_internal"?: boolean,"p_key": string,"p_payload": Json,"p_user": string }; Returns: Json
                           },
"_record_customer_payment":
{ Args: { "p_amount": number,"p_at": string,"p_business": string,"p_customer": string,"p_date": string,"p_key": string,"p_method": string,"p_reference": string,"p_user": string }; Returns: Json
                           },
"_record_supplier_payment":
{ Args: { "p_amount": number,"p_at": string,"p_business": string,"p_date": string,"p_key": string,"p_method": string,"p_reference": string,"p_supplier": string,"p_user": string }; Returns: Json
                           },
"_request_rescue":
{ Args: { "p_at": string,"p_batch": string,"p_business": string,"p_date": string,"p_details": Json,"p_quantity": number,"p_type": Database["public"]['Enums']["rescue_type"],"p_user": string }; Returns: string
                           },
"_require_stock_role":
{ Args: { "p_business": string }; Returns: undefined
                           },
"_role_of":
{ Args: { "p_business": string,"p_user": string }; Returns: Database["public"]['Enums']["member_role"]
                           },
"_take_from_batch":
{ Args: { "p_at": string,"p_batch": string,"p_business": string,"p_date": string,"p_note": string,"p_qty": number,"p_ref_id": string,"p_ref_type": string,"p_type": Database["public"]['Enums']["movement_type"],"p_user": string }; Returns: undefined
                           },
"add_member":
{ Args: { "p_business": string,"p_email": string,"p_role": Database["public"]['Enums']["member_role"] }; Returns: string
                           },
"add_stock":
{ Args: { "p_batch_code": string,"p_business": string,"p_expiry": string,"p_location": string,"p_note": string,"p_product": string,"p_quantity": number,"p_reason": string,"p_unit_cost": number }; Returns: Json
                           },
"adjust_stock":
{ Args: { "p_batch": string,"p_business": string,"p_change": number,"p_location": string,"p_note": string,"p_reason": string }; Returns: Json
                           },
"approve_rescue_discount":
{ Args: { "p_event": string }; Returns: undefined
                           },
"calc_tax_line":
{ Args: { "p_cess_rate": number,"p_discount": number,"p_gross": number,"p_gst_rate": number,"p_includes_tax": boolean,"p_inter": boolean,"p_tax_applicable": boolean }; Returns: {
              "cess": number,"cgst": number,"igst": number,"line_total": number,"sgst": number,"taxable": number
            }[]
                           },
"check_stock_integrity":
{ Args: { "p_business": string }; Returns: {
              "balance": number,"batch_id": string,"ledger": number,"location_id": string
            }[]
                           },
"close_rescue":
{ Args: { "p_event": string }; Returns: undefined
                           },
"confirm_rescue":
{ Args: { "p_details": Json,"p_event": string,"p_quantity": number }; Returns: Json
                           },
"continue_demo_seed":
{ Args: { "p_business": string }; Returns: Json
                           },
"create_business":
{ Args: { "p_payload": Json }; Returns: string
                           },
"create_demo_business":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"delete_demo_business":
{ Args: { "p_business": string }; Returns: undefined
                           },
"has_role":
{ Args: { "p_business": string,"p_roles"?: (Database["public"]['Enums']["member_role"])[] }; Returns: boolean
                           },
"list_members":
{ Args: { "p_business": string }; Returns: {
              "created_at": string,"email": string,"full_name": string,"membership_id": string,"role": Database["public"]['Enums']["member_role"],"user_id": string
            }[]
                           },
"post_purchase":
{ Args: { "p_business": string,"p_idempotency_key": string,"p_payload": Json }; Returns: Json
                           },
"post_sale":
{ Args: { "p_business": string,"p_idempotency_key": string,"p_payload": Json }; Returns: Json
                           },
"product_daily_sales":
{ Args: { "p_business": string,"p_from": string,"p_to": string }; Returns: {
              "day": string,"product_id": string,"quantity": number
            }[]
                           },
"record_customer_payment":
{ Args: { "p_amount": number,"p_business": string,"p_customer": string,"p_idempotency_key": string,"p_method": string,"p_reference": string }; Returns: Json
                           },
"record_supplier_payment":
{ Args: { "p_amount": number,"p_business": string,"p_idempotency_key": string,"p_method": string,"p_reference": string,"p_supplier": string }; Returns: Json
                           },
"report_category_sales":
{ Args: { "p_business": string,"p_from": string,"p_to": string }; Returns: {
              "category": string,"cost": number,"quantity": number,"revenue": number
            }[]
                           },
"report_collections":
{ Args: { "p_business": string,"p_from": string,"p_to": string }; Returns: {
              "amount": number,"direction": string,"kind": string,"method": Database["public"]['Enums']["payment_method"],"payments": number
            }[]
                           },
"report_product_sales":
{ Args: { "p_business": string,"p_from": string,"p_to": string }; Returns: {
              "cost": number,"gross_profit": number,"invoices": number,"product_id": string,"product_name": string,"quantity": number,"revenue": number,"total_with_tax": number,"unit": string
            }[]
                           },
"report_purchase_tax":
{ Args: { "p_business": string,"p_from": string,"p_to": string }; Returns: {
              "gst_rate": number,"tax": number,"taxable": number,"total": number
            }[]
                           },
"report_rescue":
{ Args: { "p_business": string,"p_from": string,"p_to": string }; Returns: {
              "events": number,"recovered": number,"rescue_type": string,"units": number
            }[]
                           },
"report_sales_daily":
{ Args: { "p_business": string,"p_from": string,"p_to": string }; Returns: {
              "collected_at_sale": number,"cost": number,"credit": number,"day": string,"discount": number,"gross": number,"invoices": number,"tax": number,"taxable": number,"total": number,"voided": number
            }[]
                           },
"report_stock_reconciliation":
{ Args: { "p_business": string,"p_from": string,"p_to": string }; Returns: {
              "adjustments": number,"closing": number,"closing_value": number,"opening": number,"opening_value": number,"product_id": string,"product_name": string,"purchase_returns": number,"purchased": number,"sales_returns": number,"sku": string,"sold": number,"unit": string,"write_offs": number
            }[]
                           },
"report_tax_summary":
{ Args: { "p_business": string,"p_from": string,"p_to": string }; Returns: {
              "cess": number,"cgst": number,"gst_rate": number,"igst": number,"invoices": number,"sgst": number,"supply_type": string,"taxable": number,"total": number
            }[]
                           },
"request_rescue":
{ Args: { "p_batch": string,"p_business": string,"p_details": Json,"p_quantity": number,"p_type": Database["public"]['Enums']["rescue_type"] }; Returns: string
                           },
"transfer_product_stock":
{ Args: { "p_business": string,"p_from": string,"p_product": string,"p_quantity": number,"p_to": string }; Returns: Json
                           },
"update_member":
{ Args: { "p_membership": string,"p_remove"?: boolean,"p_role": Database["public"]['Enums']["member_role"] }; Returns: undefined
                           },
"void_sale":
{ Args: { "p_reason": string,"p_sale": string }; Returns: Json
                           }
          }
          Enums: {
            "business_type": "kirana"|"grocery"|"pharmacy"|"general"|"other","location_kind": "shelf"|"backroom","member_role": "owner"|"manager"|"cashier"|"inventory","movement_type": "opening"|"purchase"|"sale"|"sale_return"|"void_reversal"|"purchase_return"|"adjustment"|"write_off"|"transfer_in"|"transfer_out"|"rescue_out","payment_method": "cash"|"upi"|"card"|"bank","po_status": "draft"|"ordered"|"received"|"cancelled","rescue_status": "requested"|"listed"|"approved"|"confirmed"|"cancelled","rescue_type": "supplier_return"|"surplus_sale"|"discount"|"donation","sale_status": "posted"|"voided"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "business_type": ["kirana", "grocery", "pharmacy", "general", "other"],"location_kind": ["shelf", "backroom"],"member_role": ["owner", "manager", "cashier", "inventory"],"movement_type": ["opening", "purchase", "sale", "sale_return", "void_reversal", "purchase_return", "adjustment", "write_off", "transfer_in", "transfer_out", "rescue_out"],"payment_method": ["cash", "upi", "card", "bank"],"po_status": ["draft", "ordered", "received", "cancelled"],"rescue_status": ["requested", "listed", "approved", "confirmed", "cancelled"],"rescue_type": ["supplier_return", "surplus_sale", "discount", "donation"],"sale_status": ["posted", "voided"]
          }
        }
} as const
