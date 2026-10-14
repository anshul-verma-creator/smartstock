import type { Shape, Unit } from './types';

/** Demo catalogue. Final batches describe what is on hand at the anchor date; recv/exp are day offsets. */
export interface CatalogItem {
  sku: string;
  name: string;
  brand?: string;
  cat: string;
  unit: Unit;
  cost: number;
  price: number;
  gst: number;
  min: number;
  sup: number;
  tb: boolean;
  te: boolean;
  life?: number;
  mean: number;
  loc: string;
  prefix?: string;
  hsn?: string;
  barcode?: string;
  desc?: string;
  visual: { shape: Shape; color: string; accent: string; label: string; image?: string };
  final: { code?: string; qty: number; recv: number; exp?: number; at: 'shelf' | 'back' }[];
  extra?: { code?: string; qty: number; recv: number; exp?: number; at: 'shelf' | 'back' }[];
}

export const SUPPLIERS = [
  { name: 'Gokul Dairy Distributors', contact: 'Mahesh Yadav', phone: '98290 11101', email: 'orders@gokuldairy.example', address: 'Sodala, Jaipur', lead: 1 },
  { name: 'Shree Ganesh Traders', contact: 'Rakesh Agarwal', phone: '98290 11102', email: 'sales@shreeganesh.example', address: 'Johari Bazaar, Jaipur', lead: 2 },
  { name: 'Bharat Bakers Supply', contact: 'Imran Khan', phone: '98290 11103', address: 'Ramganj, Jaipur', lead: 1 },
  { name: 'MedPlus Pharma Distributors', contact: 'Dr. Anita Jain', phone: '98290 11104', email: 'orders@medplus.example', address: 'MI Road, Jaipur', lead: 3 },
  { name: 'Jaipur Wholesale Mart', contact: 'Sunil Khandelwal', phone: '98290 11105', address: 'Kishanpole Bazaar, Jaipur', lead: 3 },
];

export const CUSTOMERS = [
  { name: 'Ramesh Verma', phone: '94140 00101', address: 'Malviya Nagar', creditDays: 15 },
  { name: 'Sunita Sharma', phone: '94140 00102', address: 'Vaishali Nagar', creditDays: 15 },
  { name: 'Mohd. Iqbal', phone: '94140 00103', address: 'Ghat Gate', creditDays: 15 },
  { name: 'Priya Agarwal', phone: '94140 00104', address: 'C-Scheme', creditDays: 15 },
  { name: 'Kavita Joshi', phone: '94140 00105', address: 'Mansarovar', creditDays: 15 },
  { name: 'Arjun Meena', phone: '94140 00106', address: 'Jagatpura', creditDays: 15 },
  { name: 'Deepak Saini', phone: '94140 00107', address: 'Sanganer', creditDays: 10 },
  { name: 'Neha Gupta', phone: '94140 00108', address: 'Raja Park', creditDays: 10 },
  { name: 'Gupta General Store', phone: '94140 00109', address: 'Tonk Road (retailer)', creditDays: 30, isBusiness: true },
];

export const LOCATIONS = [
  { code: 'BACK', kind: 'backroom' as const, block: 'Backroom' },
  { code: 'A11', kind: 'shelf' as const, block: 'Block A', rack: 'Rack 1', shelf: 'Shelf 1' },
  { code: 'A12', kind: 'shelf' as const, block: 'Block A', rack: 'Rack 1', shelf: 'Shelf 2' },
  { code: 'A21', kind: 'shelf' as const, block: 'Block A', rack: 'Rack 2', shelf: 'Shelf 1' },
  { code: 'B11', kind: 'shelf' as const, block: 'Block B', rack: 'Rack 1', shelf: 'Shelf 1' },
  { code: 'B32', kind: 'shelf' as const, block: 'Block B', rack: 'Rack 3', shelf: 'Shelf 2' },
  { code: 'C11', kind: 'shelf' as const, block: 'Block C', rack: 'Rack 1', shelf: 'Shelf 1' },
  { code: 'C12', kind: 'shelf' as const, block: 'Block C', rack: 'Rack 1', shelf: 'Shelf 2' },
];

export const CATALOG: CatalogItem[] = [
  { sku: 'AMUL-TZ1L', name: 'Amul Taaza Milk 1L', brand: 'Amul', cat: 'Dairy', unit: 'pcs', cost: 42, price: 56, gst: 0, min: 30, sup: 1, tb: true, te: true, life: 30, mean: 13, loc: 'B32', prefix: 'BPL', hsn: '0401', barcode: '8901262150125',
    desc: 'Homogenised toned milk in a 1-litre carton. Fast mover — keep the shelf stocked from the backroom.',
    visual: { shape: 'carton', color: '#2F7BD8', accent: '#FFFFFF', label: 'Taaza', image: '/assets/products/amul-taaza-1l.webp' },
    final: [{ code: 'BPL2610A', qty: 48, recv: -18, exp: 12, at: 'shelf' }, { code: 'BPL2610B', qty: 120, recv: -1, exp: 29, at: 'back' }, { code: 'BPL2610C', qty: 80, recv: 0, exp: 45, at: 'back' }] },
  { sku: 'AMUL-BTR100', name: 'Amul Butter 100g', brand: 'Amul', cat: 'Dairy', unit: 'pcs', cost: 52, price: 60, gst: 5, min: 10, sup: 1, tb: true, te: true, life: 60, mean: 3, loc: 'B11', prefix: 'ABT', hsn: '0405', barcode: '8901262010016',
    visual: { shape: 'box', color: '#F2C230', accent: '#C8102E', label: 'Butter' },
    final: [{ code: 'ABT2608', qty: 4, recv: -54, exp: 6, at: 'shelf' }, { code: 'ABT2609', qty: 22, recv: -26, exp: 34, at: 'back' }] },
  { sku: 'MD-DAHI400', name: 'Mother Dairy Dahi 400g', brand: 'Mother Dairy', cat: 'Dairy', unit: 'pcs', cost: 30, price: 40, gst: 0, min: 8, sup: 1, tb: true, te: true, life: 12, mean: 4, loc: 'B11', prefix: 'DH', hsn: '0403', barcode: '8906002520041',
    visual: { shape: 'tub', color: '#F7F4EE', accent: '#1F5FAD', label: 'Dahi' },
    final: [{ code: 'DH261004', qty: 9, recv: -10, exp: 2, at: 'shelf' }, { code: 'DH261011', qty: 14, recv: -3, exp: 9, at: 'back' }],
    extra: [{ code: 'DH260930', qty: 12, recv: -12, exp: 0, at: 'back' }] },
  { sku: 'PNR-200', name: 'Fresh Paneer 200g', brand: 'Gokul', cat: 'Dairy', unit: 'pcs', cost: 70, price: 90, gst: 0, min: 6, sup: 1, tb: true, te: true, life: 7, mean: 2, loc: 'B11', prefix: 'PN', hsn: '0406', barcode: '8906002520102',
    visual: { shape: 'packet', color: '#FBFAF6', accent: '#3C8D2F', label: 'Paneer' },
    final: [{ code: 'PN261009', qty: 7, recv: -5, exp: 2, at: 'shelf' }] },
  { sku: 'EPI-YOG90', name: 'Epigamia Greek Yogurt 90g', brand: 'Epigamia', cat: 'Dairy', unit: 'pcs', cost: 35, price: 50, gst: 5, min: 6, sup: 1, tb: true, te: true, life: 20, mean: 1.2, loc: 'B11', prefix: 'YG', hsn: '0403', barcode: '8906088820019',
    visual: { shape: 'tub', color: '#F3EEF8', accent: '#7B4FA0', label: 'Greek' },
    final: [{ code: 'YG261018', qty: 16, recv: -16, exp: 4, at: 'shelf' }] },
  { sku: 'BRIT-BRD400', name: 'Britannia Milk Bread 400g', brand: 'Britannia', cat: 'Bakery', unit: 'pcs', cost: 30, price: 40, gst: 0, min: 10, sup: 3, tb: true, te: true, life: 5, mean: 6, loc: 'A21', prefix: 'BR', hsn: '1905', barcode: '8901063017542',
    visual: { shape: 'packet', color: '#2EA1D9', accent: '#D7262E', label: 'Bread', image: '/assets/products/britannia-bread.webp' },
    final: [{ code: 'BR261012', qty: 40, recv: -2, exp: 3, at: 'shelf' }],
    extra: [{ code: 'BR261006', qty: 20, recv: -8, exp: -3, at: 'back' }] },
  { sku: 'BRIT-GD100', name: 'Britannia Good Day 100g', brand: 'Britannia', cat: 'Snacks', unit: 'pcs', cost: 22, price: 30, gst: 5, min: 15, sup: 2, tb: false, te: true, life: 120, mean: 8, loc: 'A12', hsn: '1905', barcode: '8901063092891',
    visual: { shape: 'packet', color: '#E39B2D', accent: '#7A3E12', label: 'Good Day' },
    final: [{ qty: 4, recv: -30, at: 'shelf' }, { qty: 30, recv: -3, at: 'back' }] },
  { sku: 'PARLE-G250', name: 'Parle-G Biscuits 250g', brand: 'Parle', cat: 'Snacks', unit: 'pcs', cost: 20, price: 25, gst: 5, min: 20, sup: 2, tb: false, te: true, life: 150, mean: 9, loc: 'A12', hsn: '1905', barcode: '8901719101038',
    visual: { shape: 'packet', color: '#F4D03F', accent: '#C0392B', label: 'Parle-G', image: '/assets/products/parle-g.webp' },
    final: [{ qty: 8, recv: -10, at: 'shelf' }] },
  { sku: 'COKE-750', name: 'Coca-Cola 750ml', brand: 'Coca-Cola', cat: 'Beverages', unit: 'bottle', cost: 24, price: 40, gst: 40, min: 20, sup: 2, tb: false, te: true, life: 180, mean: 4, loc: 'A21', hsn: '2202', barcode: '8901764012273',
    visual: { shape: 'bottle', color: '#D7262E', accent: '#FFFFFF', label: 'Cola' },
    final: [{ qty: 12, recv: -20, at: 'shelf' }] },
  { sku: 'SPRITE-600', name: 'Sprite 600ml', brand: 'Sprite', cat: 'Beverages', unit: 'bottle', cost: 22, price: 38, gst: 40, min: 6, sup: 2, tb: false, te: true, life: 120, mean: 0.6, loc: 'A21', hsn: '2202', barcode: '8901764032295',
    visual: { shape: 'bottle', color: '#2E9E58', accent: '#F7E94A', label: 'Lime' },
    final: [{ qty: 40, recv: -100, exp: 20, at: 'back' }],
    extra: [{ qty: 24, recv: -110, exp: -1, at: 'back' }] },
  { sku: 'TATA-TEA250', name: 'Tata Tea Gold 250g', brand: 'Tata', cat: 'Beverages', unit: 'pcs', cost: 120, price: 150, gst: 5, min: 6, sup: 2, tb: false, te: false, mean: 2, loc: 'A21', hsn: '0902', barcode: '8901725121624',
    visual: { shape: 'box', color: '#B3202A', accent: '#D9A93B', label: 'Tea Gold' },
    final: [{ qty: 18, recv: -6, at: 'shelf' }] },
  { sku: 'NES-CLS50', name: 'Nescafé Classic 50g', brand: 'Nestlé', cat: 'Beverages', unit: 'pcs', cost: 140, price: 175, gst: 5, min: 4, sup: 2, tb: false, te: true, life: 365, mean: 1, loc: 'A21', hsn: '2101', barcode: '8901058000290',
    visual: { shape: 'jar', color: '#4A2C1D', accent: '#C9302C', label: 'Classic' },
    final: [{ qty: 9, recv: -15, at: 'shelf' }] },
  { sku: 'TATA-SALT1', name: 'Tata Salt 1kg', brand: 'Tata', cat: 'Staples', unit: 'pcs', cost: 22, price: 28, gst: 0, min: 15, sup: 2, tb: false, te: false, mean: 5, loc: 'A11', hsn: '2501', barcode: '8904043901015',
    visual: { shape: 'packet', color: '#F3F6FA', accent: '#1F4FA3', label: 'Salt' },
    final: [{ qty: 6, recv: -2, at: 'shelf' }] },
  { sku: 'AASH-ATTA5', name: 'Aashirvaad Atta 5kg', brand: 'Aashirvaad', cat: 'Staples', unit: 'pcs', cost: 210, price: 265, gst: 5, min: 8, sup: 2, tb: false, te: true, life: 120, mean: 2.2, loc: 'A11', hsn: '1101', barcode: '8901725133856',
    visual: { shape: 'bag', color: '#E9B44C', accent: '#7A3F12', label: 'Atta' },
    final: [{ qty: 5, recv: -20, at: 'shelf' }, { qty: 14, recv: -8, at: 'back' }] },
  { sku: 'FORT-OIL1', name: 'Fortune Sunflower Oil 1L', brand: 'Fortune', cat: 'Staples', unit: 'pcs', cost: 128, price: 155, gst: 5, min: 8, sup: 2, tb: false, te: true, life: 270, mean: 3, loc: 'A11', hsn: '1512', barcode: '8906007280017',
    visual: { shape: 'bottle', color: '#F5C518', accent: '#2C7A3B', label: 'Oil' },
    final: [{ qty: 26, recv: -4, at: 'back' }] },
  { sku: 'IG-BAS1', name: 'India Gate Basmati Rice 1kg', brand: 'India Gate', cat: 'Staples', unit: 'pcs', cost: 112, price: 140, gst: 5, min: 5, sup: 2, tb: false, te: false, mean: 1.5, loc: 'A11', hsn: '1006', barcode: '8904109400018',
    visual: { shape: 'bag', color: '#2D6A3E', accent: '#E8C468', label: 'Basmati' },
    final: [{ qty: 15, recv: -12, at: 'shelf' }] },
  { sku: 'TOOR-DAL', name: 'Toor Dal (loose)', cat: 'Staples', unit: 'kg', cost: 118, price: 150, gst: 0, min: 10, sup: 5, tb: false, te: false, mean: 3, loc: 'A11', hsn: '0713',
    visual: { shape: 'bag', color: '#E3B23C', accent: '#8A5A1F', label: 'Toor' },
    final: [{ qty: 32.5, recv: -6, at: 'back' }] },
  { sku: 'SUGAR-L', name: 'Sugar (loose)', cat: 'Staples', unit: 'kg', cost: 40, price: 46, gst: 5, min: 15, sup: 5, tb: false, te: false, mean: 6, loc: 'A11', hsn: '1701',
    visual: { shape: 'bag', color: '#F7F7F5', accent: '#9AA3AE', label: 'Sugar' },
    final: [{ qty: 48, recv: -3, at: 'back' }] },
  { sku: 'MAGGI-70', name: 'Maggi 2-Minute Noodles 70g', brand: 'Nestlé', cat: 'Snacks', unit: 'pcs', cost: 12, price: 14, gst: 5, min: 20, sup: 2, tb: false, te: true, life: 270, mean: 10, loc: 'A12', hsn: '1902', barcode: '8901058851434',
    visual: { shape: 'packet', color: '#F6D02F', accent: '#D62828', label: 'Noodles', image: '/assets/products/maggi-noodles.webp' },
    final: [{ qty: 6, recv: -20, at: 'shelf' }, { qty: 60, recv: -2, at: 'back' }] },
  { sku: 'HALD-BHU200', name: "Haldiram's Bhujia 200g", brand: "Haldiram's", cat: 'Snacks', unit: 'pcs', cost: 46, price: 58, gst: 5, min: 8, sup: 5, tb: false, te: true, life: 180, mean: 2, loc: 'A12', hsn: '2106', barcode: '8904004400267',
    visual: { shape: 'packet', color: '#C8102E', accent: '#F2C230', label: 'Bhujia' },
    final: [{ qty: 17, recv: -7, at: 'shelf' }] },
  { sku: 'LAYS-52', name: "Lay's Classic Salted 52g", brand: "Lay's", cat: 'Snacks', unit: 'pcs', cost: 15, price: 20, gst: 5, min: 15, sup: 2, tb: false, te: true, life: 120, mean: 5, loc: 'A12', hsn: '2005', barcode: '8901491101837',
    visual: { shape: 'packet', color: '#F7D23E', accent: '#D62F2F', label: 'Classic' },
    final: [{ qty: 36, recv: -5, at: 'shelf' }] },
  { sku: 'SURF-1KG', name: 'Surf Excel Easy Wash 1kg', brand: 'Surf Excel', cat: 'Household', unit: 'pcs', cost: 115, price: 140, gst: 18, min: 5, sup: 5, tb: false, te: false, mean: 1.4, loc: 'C11', hsn: '3402', barcode: '8901030704611',
    visual: { shape: 'box', color: '#1E5BB8', accent: '#F2C230', label: 'Surf' },
    final: [{ qty: 2, recv: -25, at: 'shelf' }, { qty: 10, recv: -5, at: 'back' }] },
  { sku: 'VIM-BAR200', name: 'Vim Bar 200g', brand: 'Vim', cat: 'Household', unit: 'pcs', cost: 18, price: 22, gst: 18, min: 10, sup: 5, tb: false, te: false, mean: 2.5, loc: 'C11', hsn: '3401', barcode: '8901030515965',
    visual: { shape: 'bar', color: '#3DAA4B', accent: '#F4E04D', label: 'Vim' },
    final: [{ qty: 24, recv: -9, at: 'shelf' }] },
  { sku: 'HARPIC-500', name: 'Harpic Toilet Cleaner 500ml', brand: 'Harpic', cat: 'Household', unit: 'bottle', cost: 85, price: 105, gst: 18, min: 4, sup: 5, tb: false, te: false, mean: 0.9, loc: 'C11', hsn: '3402', barcode: '8901396393504',
    visual: { shape: 'bottle', color: '#2A5DB0', accent: '#E63946', label: 'Cleaner' },
    final: [] },
  { sku: 'COLG-200', name: 'Colgate Strong Teeth 200g', brand: 'Colgate', cat: 'Personal care', unit: 'pcs', cost: 95, price: 120, gst: 5, min: 6, sup: 5, tb: false, te: true, life: 720, mean: 1.3, loc: 'C11', hsn: '3306', barcode: '8901314010322',
    visual: { shape: 'tube', color: '#D52B1E', accent: '#FFFFFF', label: 'Strong' },
    final: [{ qty: 14, recv: -14, at: 'shelf' }] },
  { sku: 'DETT-SOAP4', name: 'Dettol Soap 75g (Pack of 4)', brand: 'Dettol', cat: 'Personal care', unit: 'pack', cost: 140, price: 175, gst: 5, min: 4, sup: 5, tb: false, te: false, mean: 0.8, loc: 'C11', hsn: '3401', barcode: '8901396314400',
    visual: { shape: 'box', color: '#2E8B57', accent: '#F5F5F5', label: 'Soap' },
    final: [{ qty: 10, recv: -20, at: 'shelf' }] },
  { sku: 'PCM-650', name: 'Paracetamol 650mg (Strip of 15)', brand: 'Generic', cat: 'Pharmacy', unit: 'strip', cost: 22, price: 32, gst: 5, min: 10, sup: 4, tb: true, te: true, life: 720, mean: 2, loc: 'C12', prefix: 'PCM', hsn: '3004', barcode: '8904159400012',
    visual: { shape: 'strip', color: '#EEF3F8', accent: '#2B6CB0', label: '650' },
    final: [{ code: 'PCM24K11', qty: 26, recv: -40, exp: 400, at: 'shelf' }] },
  { sku: 'ORS-21G', name: 'ORS Sachet 21g', brand: 'Electral', cat: 'Pharmacy', unit: 'pcs', cost: 18, price: 22, gst: 5, min: 10, sup: 4, tb: true, te: true, life: 540, mean: 1.2, loc: 'C12', prefix: 'ORS', hsn: '3004', barcode: '8901088102018',
    visual: { shape: 'packet', color: '#F28C28', accent: '#1F5FAD', label: 'ORS' },
    final: [{ code: 'ORS23J07', qty: 6, recv: -540, exp: -3, at: 'shelf' }, { code: 'ORS25H02', qty: 30, recv: -20, exp: 300, at: 'back' }] },
  { sku: 'VICKS-25', name: 'Vicks VapoRub 25ml', brand: 'Vicks', cat: 'Pharmacy', unit: 'pcs', cost: 92, price: 115, gst: 5, min: 4, sup: 4, tb: true, te: true, life: 900, mean: 0.6, loc: 'C12', prefix: 'VK', hsn: '3004', barcode: '4987176011218',
    visual: { shape: 'jar', color: '#1C4E9C', accent: '#7FC8F8', label: 'Vapo' },
    final: [{ code: 'VK25F19', qty: 11, recv: -60, at: 'shelf' }] },
];
