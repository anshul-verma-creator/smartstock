-- SmartStock AI — demonstration store
-- Demo data lives in its own business (businesses.is_demo = true), never mixed with real records, and can be
-- deleted at any time. History is replayed through the SAME posting functions used by the app
-- (_post_purchase, _post_sale, _record_customer_payment, rescue functions), so stock, ledgers, payments
-- and reports reconcile by construction. Seeding runs in short steps to stay under API statement timeouts.

create table public.demo_state (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  anchor date not null,
  next_step int not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.demo_state enable row level security;
create policy demo_state_select on public.demo_state for select to authenticated using (public.has_role(business_id));

-- Deterministic pseudo-random number in [0,1) from a text seed.
create or replace function public._demo_rand(p_seed text) returns numeric
language sql immutable as $$
  select ((hashtextextended(p_seed, 7) % 1000003 + 1000003) % 1000003)::numeric / 1000003;
$$;

create or replace function public._demo_catalog() returns jsonb
language sql immutable as $$
select $json$[
 {"sku":"AMUL-TZ1L","name":"Amul Taaza Milk 1L","brand":"Amul","cat":"Dairy","unit":"pcs","cost":42,"price":56,"gst":0,"min":30,"sup":1,"tb":true,"te":true,"life":30,"mean":13,"loc":"B32","prefix":"BPL","hsn":"0401","barcode":"8901262150125",
  "visual":{"shape":"carton","color":"#2F7BD8","accent":"#FFFFFF","label":"Taaza"},
  "final":[{"code":"BPL2610A","qty":48,"recv":-18,"exp":12,"at":"shelf"},{"code":"BPL2610B","qty":120,"recv":-1,"exp":29,"at":"back"},{"code":"BPL2610C","qty":80,"recv":0,"exp":45,"at":"back"}]},
 {"sku":"AMUL-BTR100","name":"Amul Butter 100g","brand":"Amul","cat":"Dairy","unit":"pcs","cost":52,"price":60,"gst":5,"min":10,"sup":1,"tb":true,"te":true,"life":60,"mean":3,"loc":"B11","prefix":"ABT","hsn":"0405","barcode":"8901262010016",
  "visual":{"shape":"box","color":"#F2C230","accent":"#C8102E","label":"Butter"},
  "final":[{"code":"ABT2608","qty":4,"recv":-54,"exp":6,"at":"shelf"},{"code":"ABT2609","qty":22,"recv":-26,"exp":34,"at":"back"}]},
 {"sku":"MD-DAHI400","name":"Mother Dairy Dahi 400g","brand":"Mother Dairy","cat":"Dairy","unit":"pcs","cost":30,"price":40,"gst":0,"min":8,"sup":1,"tb":true,"te":true,"life":12,"mean":4,"loc":"B11","prefix":"DH","hsn":"0403","barcode":"8906002520041",
  "visual":{"shape":"tub","color":"#F7F4EE","accent":"#1F5FAD","label":"Dahi"},
  "final":[{"code":"DH261004","qty":9,"recv":-10,"exp":2,"at":"shelf"},{"code":"DH261011","qty":14,"recv":-3,"exp":9,"at":"back"}],
  "extra":[{"code":"DH260930","qty":12,"recv":-12,"exp":0,"at":"back"}]},
 {"sku":"PNR-200","name":"Fresh Paneer 200g","brand":"Gokul","cat":"Dairy","unit":"pcs","cost":70,"price":90,"gst":0,"min":6,"sup":1,"tb":true,"te":true,"life":7,"mean":2,"loc":"B11","prefix":"PN","hsn":"0406","barcode":"8906002520102",
  "visual":{"shape":"packet","color":"#FBFAF6","accent":"#3C8D2F","label":"Paneer"},
  "final":[{"code":"PN261009","qty":7,"recv":-5,"exp":2,"at":"shelf"}]},
 {"sku":"EPI-YOG90","name":"Epigamia Greek Yogurt 90g","brand":"Epigamia","cat":"Dairy","unit":"pcs","cost":35,"price":50,"gst":5,"min":6,"sup":1,"tb":true,"te":true,"life":20,"mean":1.2,"loc":"B11","prefix":"YG","hsn":"0403","barcode":"8906088820019",
  "visual":{"shape":"tub","color":"#F3EEF8","accent":"#7B4FA0","label":"Greek"},
  "final":[{"code":"YG261018","qty":16,"recv":-16,"exp":4,"at":"shelf"}]},
 {"sku":"BRIT-BRD400","name":"Britannia Bread 400g","brand":"Britannia","cat":"Bakery","unit":"pcs","cost":30,"price":40,"gst":0,"min":10,"sup":3,"tb":true,"te":true,"life":5,"mean":6,"loc":"A21","prefix":"BR","hsn":"1905","barcode":"8901063017542",
  "visual":{"shape":"packet","color":"#F6A33B","accent":"#B5121B","label":"Bread"},
  "final":[{"code":"BR261012","qty":40,"recv":-2,"exp":3,"at":"shelf"}],
  "extra":[{"code":"BR261006","qty":20,"recv":-8,"exp":-3,"at":"back"}]},
 {"sku":"BRIT-GD100","name":"Britannia Good Day 100g","brand":"Britannia","cat":"Snacks","unit":"pcs","cost":22,"price":30,"gst":5,"min":15,"sup":2,"tb":false,"te":true,"life":120,"mean":8,"loc":"A12","hsn":"1905","barcode":"8901063092891",
  "visual":{"shape":"packet","color":"#E39B2D","accent":"#7A3E12","label":"Good Day"},
  "final":[{"qty":4,"recv":-30,"at":"shelf"},{"qty":30,"recv":-3,"at":"back"}]},
 {"sku":"PARLE-G250","name":"Parle-G Biscuits 250g","brand":"Parle","cat":"Snacks","unit":"pcs","cost":20,"price":25,"gst":5,"min":20,"sup":2,"tb":false,"te":true,"life":150,"mean":9,"loc":"A12","hsn":"1905","barcode":"8901719101038",
  "visual":{"shape":"packet","color":"#F4D03F","accent":"#C0392B","label":"Parle-G"},
  "final":[{"qty":8,"recv":-10,"at":"shelf"}]},
 {"sku":"COKE-750","name":"Coca-Cola 750ml","brand":"Coca-Cola","cat":"Beverages","unit":"bottle","cost":32,"price":40,"gst":40,"min":20,"sup":2,"tb":false,"te":true,"life":180,"mean":4,"loc":"A21","hsn":"2202","barcode":"8901764012273",
  "visual":{"shape":"bottle","color":"#D7262E","accent":"#FFFFFF","label":"Cola"},
  "final":[{"qty":12,"recv":-20,"at":"shelf"}]},
 {"sku":"SPRITE-600","name":"Sprite 600ml","brand":"Sprite","cat":"Beverages","unit":"bottle","cost":30,"price":38,"gst":40,"min":6,"sup":2,"tb":false,"te":true,"life":120,"mean":0.6,"loc":"A21","hsn":"2202","barcode":"8901764032295",
  "visual":{"shape":"bottle","color":"#2E9E58","accent":"#F7E94A","label":"Lime"},
  "final":[{"qty":40,"recv":-100,"exp":20,"at":"back"}],
  "extra":[{"qty":24,"recv":-110,"exp":-1,"at":"back"}]},
 {"sku":"TATA-TEA250","name":"Tata Tea Gold 250g","brand":"Tata","cat":"Beverages","unit":"pcs","cost":120,"price":150,"gst":5,"min":6,"sup":2,"tb":false,"te":false,"mean":2,"loc":"A21","hsn":"0902","barcode":"8901725121624",
  "visual":{"shape":"box","color":"#B3202A","accent":"#D9A93B","label":"Tea Gold"},
  "final":[{"qty":18,"recv":-6,"at":"shelf"}]},
 {"sku":"NES-CLS50","name":"Nescafé Classic 50g","brand":"Nestlé","cat":"Beverages","unit":"pcs","cost":140,"price":175,"gst":5,"min":4,"sup":2,"tb":false,"te":true,"life":365,"mean":1,"loc":"A21","hsn":"2101","barcode":"8901058000290",
  "visual":{"shape":"jar","color":"#4A2C1D","accent":"#C9302C","label":"Classic"},
  "final":[{"qty":9,"recv":-15,"at":"shelf"}]},
 {"sku":"TATA-SALT1","name":"Tata Salt 1kg","brand":"Tata","cat":"Staples","unit":"pcs","cost":22,"price":28,"gst":0,"min":15,"sup":2,"tb":false,"te":false,"mean":5,"loc":"A11","hsn":"2501","barcode":"8904043901015",
  "visual":{"shape":"packet","color":"#F3F6FA","accent":"#1F4FA3","label":"Salt"},
  "final":[{"qty":6,"recv":-2,"at":"shelf"}]},
 {"sku":"AASH-ATTA5","name":"Aashirvaad Atta 5kg","brand":"Aashirvaad","cat":"Staples","unit":"pcs","cost":210,"price":265,"gst":5,"min":8,"sup":2,"tb":false,"te":true,"life":120,"mean":2.2,"loc":"A11","hsn":"1101","barcode":"8901725133856",
  "visual":{"shape":"bag","color":"#E9B44C","accent":"#7A3F12","label":"Atta"},
  "final":[{"qty":5,"recv":-20,"at":"shelf"},{"qty":14,"recv":-8,"at":"back"}]},
 {"sku":"FORT-OIL1","name":"Fortune Sunflower Oil 1L","brand":"Fortune","cat":"Staples","unit":"pcs","cost":128,"price":155,"gst":5,"min":8,"sup":2,"tb":false,"te":true,"life":270,"mean":3,"loc":"A11","hsn":"1512","barcode":"8906007280017",
  "visual":{"shape":"bottle","color":"#F5C518","accent":"#2C7A3B","label":"Oil"},
  "final":[{"qty":26,"recv":-4,"at":"back"}]},
 {"sku":"IG-BAS1","name":"India Gate Basmati Rice 1kg","brand":"India Gate","cat":"Staples","unit":"pcs","cost":112,"price":140,"gst":5,"min":5,"sup":2,"tb":false,"te":false,"mean":1.5,"loc":"A11","hsn":"1006","barcode":"8904109400018",
  "visual":{"shape":"bag","color":"#2D6A3E","accent":"#E8C468","label":"Basmati"},
  "final":[{"qty":15,"recv":-12,"at":"shelf"}]},
 {"sku":"TOOR-DAL","name":"Toor Dal (loose)","brand":null,"cat":"Staples","unit":"kg","cost":118,"price":150,"gst":0,"min":10,"sup":5,"tb":false,"te":false,"mean":3,"loc":"A11","hsn":"0713","barcode":null,
  "visual":{"shape":"bag","color":"#E3B23C","accent":"#8A5A1F","label":"Toor"},
  "final":[{"qty":32.5,"recv":-6,"at":"back"}]},
 {"sku":"SUGAR-L","name":"Sugar (loose)","brand":null,"cat":"Staples","unit":"kg","cost":40,"price":46,"gst":5,"min":15,"sup":5,"tb":false,"te":false,"mean":6,"loc":"A11","hsn":"1701","barcode":null,
  "visual":{"shape":"bag","color":"#F7F7F5","accent":"#9AA3AE","label":"Sugar"},
  "final":[{"qty":48,"recv":-3,"at":"back"}]},
 {"sku":"MAGGI-70","name":"Maggi 2-Minute Noodles 70g","brand":"Nestlé","cat":"Snacks","unit":"pcs","cost":12,"price":14,"gst":5,"min":20,"sup":2,"tb":false,"te":true,"life":270,"mean":10,"loc":"A12","hsn":"1902","barcode":"8901058851434",
  "visual":{"shape":"packet","color":"#F6D02F","accent":"#D62828","label":"Noodles"},
  "final":[{"qty":6,"recv":-20,"at":"shelf"},{"qty":60,"recv":-2,"at":"back"}]},
 {"sku":"HALD-BHU200","name":"Haldiram's Bhujia 200g","brand":"Haldiram's","cat":"Snacks","unit":"pcs","cost":46,"price":58,"gst":5,"min":8,"sup":5,"tb":false,"te":true,"life":180,"mean":2,"loc":"A12","hsn":"2106","barcode":"8904004400267",
  "visual":{"shape":"packet","color":"#C8102E","accent":"#F2C230","label":"Bhujia"},
  "final":[{"qty":17,"recv":-7,"at":"shelf"}]},
 {"sku":"LAYS-52","name":"Lay's Classic Salted 52g","brand":"Lay's","cat":"Snacks","unit":"pcs","cost":15,"price":20,"gst":5,"min":15,"sup":2,"tb":false,"te":true,"life":120,"mean":5,"loc":"A12","hsn":"2005","barcode":"8901491101837",
  "visual":{"shape":"packet","color":"#F7D23E","accent":"#D62F2F","label":"Classic"},
  "final":[{"qty":36,"recv":-5,"at":"shelf"}]},
 {"sku":"SURF-1KG","name":"Surf Excel Easy Wash 1kg","brand":"Surf Excel","cat":"Household","unit":"pcs","cost":115,"price":140,"gst":18,"min":5,"sup":5,"tb":false,"te":false,"mean":1.4,"loc":"C11","hsn":"3402","barcode":"8901030704611",
  "visual":{"shape":"box","color":"#1E5BB8","accent":"#F2C230","label":"Surf"},
  "final":[{"qty":2,"recv":-25,"at":"shelf"},{"qty":10,"recv":-5,"at":"back"}]},
 {"sku":"VIM-BAR200","name":"Vim Bar 200g","brand":"Vim","cat":"Household","unit":"pcs","cost":18,"price":22,"gst":18,"min":10,"sup":5,"tb":false,"te":false,"mean":2.5,"loc":"C11","hsn":"3401","barcode":"8901030515965",
  "visual":{"shape":"bar","color":"#3DAA4B","accent":"#F4E04D","label":"Vim"},
  "final":[{"qty":24,"recv":-9,"at":"shelf"}]},
 {"sku":"HARPIC-500","name":"Harpic Toilet Cleaner 500ml","brand":"Harpic","cat":"Household","unit":"bottle","cost":85,"price":105,"gst":18,"min":4,"sup":5,"tb":false,"te":false,"mean":0.9,"loc":"C11","hsn":"3402","barcode":"8901396393504",
  "visual":{"shape":"bottle","color":"#2A5DB0","accent":"#E63946","label":"Cleaner"},
  "final":[]},
 {"sku":"COLG-200","name":"Colgate Strong Teeth 200g","brand":"Colgate","cat":"Personal care","unit":"pcs","cost":95,"price":120,"gst":5,"min":6,"sup":5,"tb":false,"te":true,"life":720,"mean":1.3,"loc":"C11","hsn":"3306","barcode":"8901314010322",
  "visual":{"shape":"tube","color":"#D52B1E","accent":"#FFFFFF","label":"Strong"},
  "final":[{"qty":14,"recv":-14,"at":"shelf"}]},
 {"sku":"DETT-SOAP4","name":"Dettol Soap 75g (Pack of 4)","brand":"Dettol","cat":"Personal care","unit":"pack","cost":140,"price":175,"gst":5,"min":4,"sup":5,"tb":false,"te":false,"mean":0.8,"loc":"C11","hsn":"3401","barcode":"8901396314400",
  "visual":{"shape":"box","color":"#2E8B57","accent":"#F5F5F5","label":"Soap"},
  "final":[{"qty":10,"recv":-20,"at":"shelf"}]},
 {"sku":"PCM-650","name":"Paracetamol 650mg (Strip of 15)","brand":"Generic","cat":"Pharmacy","unit":"strip","cost":22,"price":32,"gst":5,"min":10,"sup":4,"tb":true,"te":true,"life":720,"mean":2,"loc":"C12","prefix":"PCM","hsn":"3004","barcode":"8904159400012",
  "visual":{"shape":"strip","color":"#EEF3F8","accent":"#2B6CB0","label":"650"},
  "final":[{"code":"PCM24K11","qty":26,"recv":-40,"exp":400,"at":"shelf"}]},
 {"sku":"ORS-21G","name":"ORS Sachet 21g","brand":"Electral","cat":"Pharmacy","unit":"pcs","cost":18,"price":22,"gst":5,"min":10,"sup":4,"tb":true,"te":true,"life":540,"mean":1.2,"loc":"C12","prefix":"ORS","hsn":"3004","barcode":"8901088102018",
  "visual":{"shape":"packet","color":"#F28C28","accent":"#1F5FAD","label":"ORS"},
  "final":[{"code":"ORS23J07","qty":6,"recv":-540,"exp":-3,"at":"shelf"},{"code":"ORS25H02","qty":30,"recv":-20,"exp":300,"at":"back"}]},
 {"sku":"VICKS-25","name":"Vicks VapoRub 25ml","brand":"Vicks","cat":"Pharmacy","unit":"pcs","cost":92,"price":115,"gst":5,"min":4,"sup":4,"tb":true,"te":true,"life":900,"mean":0.6,"loc":"C12","prefix":"VK","hsn":"3004","barcode":"4987176011218",
  "visual":{"shape":"jar","color":"#1C4E9C","accent":"#7FC8F8","label":"Vapo"},
  "final":[{"code":"VK25F19","qty":11,"recv":-60,"at":"shelf"}]}
]$json$::jsonb;
$$;

-- Units demanded of a product on day offset t (t = 0 is the anchor date; today is ~60% complete).
create or replace function public._demo_qty(p jsonb, t int, p_anchor date) returns numeric
language plpgsql immutable as $$
declare
  d date := p_anchor + t;
  dow numeric := (array[0.92, 0.9, 0.95, 0.97, 1.05, 1.18, 1.25])[extract(isodow from d)::int];
  trend numeric := 0.9 + 0.2 * (t + 45) / 45.0;
  noise numeric := 0.55 + 0.9 * _demo_rand(p ->> 'sku' || ':' || t);
  q numeric := (p ->> 'mean')::numeric * dow * trend * noise * case when t = 0 then 0.6 else 1 end;
begin
  if p ->> 'unit' in ('kg', 'g', 'l', 'ml') then return round(q * 2) / 2; end if;
  return floor(q + _demo_rand(p ->> 'sku' || ':r:' || t));
end $$;

create or replace function public._demo_period(p jsonb) returns int
language sql immutable as $$
  select case when p ->> 'life' is null then 10 else greatest(2, least(10, (p ->> 'life')::int - 3)) end;
$$;

create or replace function public._demo_lot_code(p jsonb, p_recv date) returns text
language sql immutable as $$
  select coalesce(p ->> 'prefix', left(regexp_replace(p ->> 'sku', '[^A-Z0-9]', '', 'g'), 8)) || '-' || to_char(p_recv, 'YYMMDD');
$$;

-- Step 0: catalogue, people, locations and every purchase (historical lots sized to exactly cover demand,
-- then the final on-hand batches and the extra lots used by scripted stock-rescue events).
create or replace function public._demo_setup(p_business uuid, p_user uuid, p_anchor date) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_store uuid; v_cat jsonb := _demo_catalog(); p jsonb; f jsonb; v_prod uuid; v_k int; v_t int; v_end int; v_qty numeric;
  v_sup uuid[]; v_loc_shelf uuid; v_back uuid; g record; v_lines jsonb; v_total numeric; v_i int := 0; v_res jsonb;
  v_recv date; v_exp date;
begin
  select id into v_store from stores where business_id = p_business and is_default;
  v_back := _default_location(p_business, 'backroom');
  insert into locations (business_id, store_id, kind, block, rack, shelf) values
    (p_business, v_store, 'shelf', 'Block A', 'Rack 2', 'Shelf 1'),
    (p_business, v_store, 'shelf', 'Block B', 'Rack 3', 'Shelf 2'),
    (p_business, v_store, 'shelf', 'Block C', 'Rack 1', 'Shelf 1'),
    (p_business, v_store, 'shelf', 'Block C', 'Rack 1', 'Shelf 2');

  with s as (
    insert into suppliers (business_id, name, contact_person, phone, email, state_code, address, lead_time_days, notes)
    values
      (p_business, 'Gokul Dairy Distributors', 'Mahesh Yadav', '9829011101', 'orders@gokuldairy.example', '08', 'Sodala, Jaipur', 1, 'Demo supplier'),
      (p_business, 'Shree Ganesh Traders', 'Rakesh Agarwal', '9829011102', 'sales@shreeganesh.example', '08', 'Johari Bazaar, Jaipur', 2, 'Demo supplier'),
      (p_business, 'Bharat Bakers Supply', 'Imran Khan', '9829011103', null, '08', 'Ramganj, Jaipur', 1, 'Demo supplier'),
      (p_business, 'MedPlus Pharma Distributors', 'Dr. Anita Jain', '9829011104', 'orders@medplus.example', '08', 'MI Road, Jaipur', 3, 'Demo supplier'),
      (p_business, 'Jaipur Wholesale Mart', 'Sunil Khandelwal', '9829011105', null, '08', 'Kishanpole Bazaar, Jaipur', 3, 'Demo supplier')
    returning id, name
  ) select array_agg(id order by name = 'Gokul Dairy Distributors' desc, name = 'Shree Ganesh Traders' desc,
                     name = 'Bharat Bakers Supply' desc, name = 'MedPlus Pharma Distributors' desc) into v_sup from s;

  insert into customers (business_id, name, phone, address, state_code, credit_days, notes) values
    (p_business, 'Ramesh Verma', '9414000101', 'Malviya Nagar', '08', 15, 'Demo customer'),
    (p_business, 'Sunita Sharma', '9414000102', 'Vaishali Nagar', '08', 15, 'Demo customer'),
    (p_business, 'Mohd. Iqbal', '9414000103', 'Ghat Gate', '08', 15, 'Demo customer'),
    (p_business, 'Priya Agarwal', '9414000104', 'C-Scheme', '08', 15, 'Demo customer'),
    (p_business, 'Kavita Joshi', '9414000105', 'Mansarovar', '08', 15, 'Demo customer'),
    (p_business, 'Arjun Meena', '9414000106', 'Jagatpura', '08', 15, 'Demo customer'),
    (p_business, 'Deepak Saini', '9414000107', 'Sanganer', '08', 10, 'Demo customer — overdue'),
    (p_business, 'Neha Gupta', '9414000108', 'Raja Park', '08', 10, 'Demo customer — overdue'),
    (p_business, 'Gupta General Store', '9414000109', 'Tonk Road (retailer)', '08', 30, 'Demo B2B buyer for surplus stock');

  for p in select value from jsonb_array_elements(v_cat) loop
    select id into v_loc_shelf from locations where business_id = p_business
      and block = 'Block ' || substr(p ->> 'loc', 1, 1) and rack = 'Rack ' || substr(p ->> 'loc', 2, 1) and shelf = 'Shelf ' || substr(p ->> 'loc', 3, 1);
    insert into products (business_id, name, sku, barcode, category_id, brand, unit, purchase_price, selling_price, mrp,
      price_includes_tax, gst_rate, hsn_code, min_stock, supplier_id, default_location_id, track_batches, track_expiry,
      shelf_life_days, visual)
    values (p_business, p ->> 'name', p ->> 'sku', p ->> 'barcode',
      (select id from product_categories where business_id = p_business and name = p ->> 'cat'),
      p ->> 'brand', p ->> 'unit', (p ->> 'cost')::numeric, (p ->> 'price')::numeric, (p ->> 'price')::numeric,
      true, (p ->> 'gst')::numeric, p ->> 'hsn', (p ->> 'min')::numeric, v_sup[(p ->> 'sup')::int], v_loc_shelf,
      (p ->> 'tb')::boolean, (p ->> 'te')::boolean, nullif(p ->> 'life', '')::int, p -> 'visual')
    returning id into v_prod;
  end loop;

  create temp table if not exists _demo_lots (sup int, recv date, line jsonb) on commit drop;
  truncate _demo_lots;

  for p in select value from jsonb_array_elements(v_cat) loop
    select id, default_location_id into v_prod, v_loc_shelf from products where business_id = p_business and sku = p ->> 'sku';
    v_k := _demo_period(p);
    v_t := -45;
    while v_t <= 0 loop
      v_end := least(v_t + v_k - 1, 0);
      select coalesce(sum(_demo_qty(p, x, p_anchor)), 0) into v_qty from generate_series(v_t, v_end) x;
      if v_qty > 0 then
        v_recv := p_anchor + v_t;
        insert into _demo_lots values ((p ->> 'sup')::int, v_recv, jsonb_build_object(
          'product_id', v_prod, 'quantity', v_qty, 'unit_cost', (p ->> 'cost')::numeric,
          'batch_code', _demo_lot_code(p, v_recv), 'location_id', v_loc_shelf,
          'expiry_date', case when (p ->> 'te')::boolean then v_recv + coalesce((p ->> 'life')::int, 365) end));
      end if;
      v_t := v_t + v_k;
    end loop;
    for f in select value from jsonb_array_elements(coalesce(p -> 'final', '[]'::jsonb) || coalesce(p -> 'extra', '[]'::jsonb)) loop
      v_i := v_i + 1;
      v_recv := p_anchor + (f ->> 'recv')::int;
      v_exp := case when (p ->> 'te')::boolean then
                 coalesce(p_anchor + nullif(f ->> 'exp', '')::int, v_recv + coalesce((p ->> 'life')::int, 365)) end;
      insert into _demo_lots values ((p ->> 'sup')::int, v_recv, jsonb_build_object(
        'product_id', v_prod, 'quantity', (f ->> 'qty')::numeric, 'unit_cost', (p ->> 'cost')::numeric,
        'batch_code', coalesce(f ->> 'code', left(regexp_replace(p ->> 'sku', '[^A-Z0-9]', '', 'g'), 8) || 'F' || v_i),
        'location_id', case when f ->> 'at' = 'back' then v_back else v_loc_shelf end,
        'expiry_date', v_exp));
    end loop;
  end loop;

  for g in select sup, recv, jsonb_agg(line) as lines from _demo_lots group by sup, recv order by recv, sup loop
    v_res := _post_purchase(p_business, p_user, gen_random_uuid(), jsonb_build_object(
      'supplier_id', v_sup[g.sup], 'bill_number', 'B' || g.sup || '-' || to_char(g.recv, 'YYMMDD'), 'bill_date', g.recv,
      'lines', g.lines), g.recv, (g.recv + time '07:30') at time zone 'Asia/Kolkata');
    v_total := (v_res ->> 'grand_total')::numeric;
    -- Older bills are settled in full; recent ones are half-paid or open, leaving realistic supplier dues.
    if g.recv < p_anchor - 20 then
      perform _record_supplier_payment(p_business, p_user, v_sup[g.sup], v_total,
        case when g.sup in (1, 3) then 'cash' else 'bank' end, 'Bill B' || g.sup || '-' || to_char(g.recv, 'YYMMDD'),
        null, g.recv, (g.recv + time '18:00') at time zone 'Asia/Kolkata');
    elsif _demo_rand('pay:' || g.sup || g.recv) < 0.5 then
      perform _record_supplier_payment(p_business, p_user, v_sup[g.sup], round(v_total / 2, 2), 'upi',
        'Part payment B' || g.sup || '-' || to_char(g.recv, 'YYMMDD'), null, g.recv, (g.recv + time '18:00') at time zone 'Asia/Kolkata');
    end if;
  end loop;
end $$;
