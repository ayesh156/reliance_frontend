// ==========================================
// RELIANCE - Clothing Business Mock Data
// ==========================================

export type Size = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | '28' | '30' | '32' | '34' | '36' | '38' | 'FREE';

export type FabricType = 'Cotton' | 'Denim' | 'Linen' | 'Polyester' | 'Silk' | 'Wool' | 'Chiffon' | 'Satin' | 'Leather' | 'Nylon' | 'Blend' | 'Other';

export const ALL_SIZES: Size[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '28', '30', '32', '34', '36', '38', 'FREE'];
export const CLOTHING_SIZES: Size[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const WAIST_SIZES: Size[] = ['28', '30', '32', '34', '36', '38'];
export const FABRIC_TYPES: FabricType[] = ['Cotton', 'Denim', 'Linen', 'Polyester', 'Silk', 'Wool', 'Chiffon', 'Satin', 'Leather', 'Nylon', 'Blend', 'Other'];

export const COMMON_COLORS = [
  'Black', 'White', 'Navy', 'Red', 'Blue', 'Grey', 'Brown', 'Cream', 'Olive',
  'Maroon', 'Pink', 'Beige', 'Charcoal', 'Forest Green', 'Burgundy', 'Tan',
  'Sage', 'Ivory', 'Lavender', 'Rust', 'Yellow', 'Orange', 'Teal', 'Coral',
];

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image?: string;
  productCount: number;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  brand: string;
  sizes: Size[];
  colors: string[];
  fabricType: FabricType;
  description?: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  lowStockThreshold: number;
  status: 'in-stock' | 'low-stock' | 'out-of-stock';
  image?: string;
  createdAt: string;
  variants?: { id: number; size: string; color: string; sku: string; stock: number }[];
}

export type SupplyCategory = 'Fabrics & Raw Materials' | 'Ready-Made Garments' | 'Leather Goods & Footwear' | 'Denim & Casual Wear' | 'Traditional Wear' | 'Sportswear & Activewear' | 'Accessories & Bags' | 'Formal Wear' | 'Kids Clothing' | 'Other';

export const SUPPLY_CATEGORIES: SupplyCategory[] = [
  'Fabrics & Raw Materials', 'Ready-Made Garments', 'Leather Goods & Footwear',
  'Denim & Casual Wear', 'Traditional Wear', 'Sportswear & Activewear',
  'Accessories & Bags', 'Formal Wear', 'Kids Clothing', 'Other',
];

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  supplyType: SupplyCategory;
  rating: number;
  totalOrders: number;
  outstandingBalance: number;
  status: 'active' | 'inactive';
  image?: string;
  notes?: string;
  website?: string;
  bankName?: string;
  bankAccount?: string;
  paymentTerms?: string;
  leadTimeDays?: number;
  joinedDate: string;
  lastOrderDate?: string;
  payments?: SupplierPayment[];
  reminders?: SupplierReminder[];
  reminderCount?: number;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'cash' | 'card' | 'bank-transfer' | 'cheque';
  reference?: string;
  notes?: string;
}

export interface SupplierReminder {
  id: string;
  supplierId: string;
  type: 'payment' | 'overdue';
  channel: 'whatsapp';
  sentAt: string;
  message: string;
  supplierPhone: string;
  supplierName: string;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  sku: string;
  barcode?: string;
  variantId?: number;
  size: Size;
  color: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'cash' | 'card' | 'bank-transfer' | 'cheque';
  notes?: string;
}

export interface InvoiceReminder {
  id: string;
  invoiceId: string;
  type: 'payment' | 'overdue';
  channel: 'whatsapp';
  sentAt: string;
  message: string;
  customerPhone: string;
  customerName: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  dueDate: string;
  paymentMethod: 'cash' | 'card' | 'bank-transfer' | 'credit';
  paymentReceiptUrl?: string;
  status: 'paid' | 'partial' | 'pending' | 'cancelled' | 'pending-receipt';
  payments: InvoicePayment[];
  notes?: string;
  createdAt: string;
  reminders?: InvoiceReminder[];
  reminderCount?: number;
}

export interface DailySales {
  date: string;
  revenue: number;
  orders: number;
  profit: number;
}

// ==========================================
// CUSTOMER TYPES
// ==========================================
export type CustomerType = 'Regular' | 'VIP' | 'Wholesale' | 'Walk-in' | 'Corporate' | 'Online' | 'Referral' | 'Other';

export const CUSTOMER_TYPES: CustomerType[] = [
  'Regular', 'VIP', 'Wholesale', 'Walk-in', 'Corporate', 'Online', 'Referral', 'Other',
];

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  customerType: CustomerType;
  totalPurchases: number;
  totalSpent: number;
  outstandingBalance: number;
  loyaltyPoints: number;
  status: 'active' | 'inactive';
  image?: string;
  notes?: string;
  nic?: string;
  joinedDate: string;
  lastPurchaseDate?: string;
  payments?: CustomerPayment[];
  reminders?: CustomerReminder[];
  reminderCount?: number;
}

export interface CustomerPayment {
  id: string;
  customerId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'cash' | 'card' | 'bank-transfer' | 'cheque';
  reference?: string;
  notes?: string;
}

export interface CustomerReminder {
  id: string;
  customerId: string;
  type: 'payment' | 'overdue';
  channel: 'whatsapp';
  sentAt: string;
  message: string;
  customerPhone: string;
  customerName: string;
}

// ==========================================
// CATEGORIES
// ==========================================
export const mockCategories: Category[] = [
  { id: 'cat-1', name: "Men's Wear", slug: 'mens-wear', description: 'Complete men\'s clothing collection', image: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?w=500&q=80', productCount: 45, status: 'active', createdAt: '2025-11-10' },
  { id: 'cat-2', name: "Women's Wear", slug: 'womens-wear', description: 'Trendy women\'s fashion collection', image: 'https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=500&q=80', productCount: 62, status: 'active', createdAt: '2025-11-12' },
  { id: 'cat-3', name: "Kids' Wear", slug: 'kids-wear', description: 'Children\'s clothing for all ages', image: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=500&q=80', productCount: 28, status: 'active', createdAt: '2025-11-15' },
  { id: 'cat-4', name: 'Footwear', slug: 'footwear', description: 'Shoes, sandals, and boots', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=80', productCount: 34, status: 'active', createdAt: '2025-12-01' },
  { id: 'cat-5', name: 'Accessories', slug: 'accessories', description: 'Belts, bags, watches, and more', image: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=500&q=80', productCount: 19, status: 'active', createdAt: '2025-12-05' },
  { id: 'cat-6', name: 'Sportswear', slug: 'sportswear', description: 'Active & athletic wear', image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500&q=80', productCount: 22, status: 'active', createdAt: '2025-12-10' },
  { id: 'cat-7', name: 'Formal Wear', slug: 'formal-wear', description: 'Suits, blazers, and formal attire', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&q=80', productCount: 15, status: 'active', createdAt: '2026-01-05' },
  { id: 'cat-8', name: 'Denim', slug: 'denim', description: 'Jeans, jackets, and denim wear', image: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=500&q=80', productCount: 18, status: 'active', createdAt: '2026-01-10' },
  { id: 'cat-9', name: 'Traditional', slug: 'traditional', description: 'Sarees, sarongs, and cultural wear', image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500&q=80', productCount: 12, status: 'active', createdAt: '2026-01-20' },

  { id: 'cat-12', name: 'Swimwear', slug: 'swimwear', description: 'Beachwear & swim collection', image: 'https://images.unsplash.com/photo-1570976447640-ac859083963f?w=500&q=80', productCount: 8, status: 'active', createdAt: '2026-02-08' },
  { id: 'cat-13', name: 'Outerwear', slug: 'outerwear', description: 'Jackets, coats & windbreakers', image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500&q=80', productCount: 16, status: 'active', createdAt: '2026-02-10' },
  { id: 'cat-14', name: 'Ethnic Wear', slug: 'ethnic-wear', description: 'Kurtas, sherwanis & ethnic collection', image: 'https://fashionbug.lk/cdn/shop/files/0316700020C8_533x.webp?v=1771239468', productCount: 10, status: 'active', createdAt: '2026-02-12' },
  { id: 'cat-15', name: 'Maternity', slug: 'maternity', description: 'Comfortable maternity clothing', image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500&q=80', productCount: 6, status: 'inactive', createdAt: '2026-02-14' },
  { id: 'cat-16', name: 'Plus Size', slug: 'plus-size', description: 'Inclusive plus-size fashion range', image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=500&q=80', productCount: 24, status: 'active', createdAt: '2026-02-16' },
  { id: 'cat-17', name: 'Workwear', slug: 'workwear', description: 'Professional office & work attire', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&q=80', productCount: 18, status: 'active', createdAt: '2026-02-18' },
];

// ==========================================
// PRODUCTS
// ==========================================
export const mockProducts: Product[] = [
  { id: 'p-1', sku: 'RL-MT-001', barcode: '8901234567001', name: 'Classic Crew Neck T-Shirt', category: "Men's Wear", brand: 'Reliance', sizes: ['S', 'M', 'L', 'XL'], colors: ['Black', 'White', 'Navy'], fabricType: 'Cotton', costPrice: 850, sellingPrice: 1490, stock: 145, lowStockThreshold: 20, status: 'in-stock', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&q=80', createdAt: '2026-01-15' },
  { id: 'p-2', sku: 'RL-MT-002', barcode: '8901234567002', name: 'Slim Fit Polo Shirt', category: "Men's Wear", brand: 'Reliance', sizes: ['M', 'L', 'XL', 'XXL'], colors: ['Black', 'Charcoal', 'Forest Green'], fabricType: 'Cotton', costPrice: 1200, sellingPrice: 2290, stock: 78, lowStockThreshold: 15, status: 'in-stock', image: 'https://bogartcosmo.no/cdn/shop/files/d9f11355-0cd7-4168-9a3e-6303d5c8d9e9.jpg?crop=center&height=1200&v=1768575245&width=1200', createdAt: '2026-01-18' },
  { id: 'p-3', sku: 'RL-WD-001', barcode: '8901234567003', name: 'Floral Maxi Dress', category: "Women's Wear", brand: 'Reliance', sizes: ['XS', 'S', 'M', 'L'], colors: ['Blush Pink', 'Ivory', 'Dusty Blue'], fabricType: 'Chiffon', costPrice: 2400, sellingPrice: 4490, stock: 32, lowStockThreshold: 10, status: 'in-stock', image: 'https://assets.laboutiqueofficielle.com/w_450,q_auto,f_auto/media/products/2025/01/28/only_451294_15342691_NAVY-BLAZER-616TROPIC_20250219T160155_01.jpg', createdAt: '2026-01-20' },
  { id: 'p-4', sku: 'RL-MJ-001', barcode: '8901234567004', name: 'Slim Fit Stretch Jeans', category: 'Denim', brand: 'Reliance', sizes: ['28', '30', '32', '34', '36'], colors: ['Dark Blue', 'Black', 'Light Wash'], fabricType: 'Denim', costPrice: 1800, sellingPrice: 3490, stock: 95, lowStockThreshold: 20, status: 'in-stock', image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTviiBOrSIXuLCEO6zPbnGu7d-2Bjakz5W6Uw&s', createdAt: '2026-01-22' },
  { id: 'p-5', sku: 'RL-WT-001', barcode: '8901234567005', name: 'Cotton Casual Blouse', category: "Women's Wear", brand: 'Reliance', sizes: ['S', 'M', 'L'], colors: ['White', 'Cream', 'Sage'], fabricType: 'Cotton', costPrice: 1100, sellingPrice: 1990, stock: 8, lowStockThreshold: 10, status: 'low-stock', image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTLqxfNkWrpnEAXMYY8NyqMRfMltxWsJgRpWA&s', createdAt: '2026-02-01' },
  { id: 'p-6', sku: 'RL-KB-001', barcode: '8901234567006', name: "Kids' Graphic Tee", category: "Kids' Wear", brand: 'Reliance', sizes: ['XS', 'S', 'M'], colors: ['Red', 'Blue', 'Yellow'], fabricType: 'Cotton', costPrice: 550, sellingPrice: 990, stock: 200, lowStockThreshold: 30, status: 'in-stock', image: 'https://itsugar.com/cdn/shop/files/SPK_Tee_Mens_front.jpg?v=1733264612&width=1500', createdAt: '2026-02-03' },
  { id: 'p-7', sku: 'RL-AC-001', barcode: '8901234567007', name: 'Leather Crossbody Bag', category: 'Accessories', brand: 'Reliance', sizes: ['FREE'], colors: ['Black', 'Tan', 'Burgundy'], fabricType: 'Leather', costPrice: 3200, sellingPrice: 5990, stock: 15, lowStockThreshold: 5, status: 'in-stock', image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500&q=80', createdAt: '2026-02-05' },
  { id: 'p-8', sku: 'RL-FW-001', barcode: '8901234567008', name: "Men's Leather Oxford Shoes", category: 'Footwear', brand: 'Reliance', sizes: ['38', 'FREE'], colors: ['Black', 'Brown'], fabricType: 'Leather', costPrice: 4500, sellingPrice: 7990, stock: 22, lowStockThreshold: 5, status: 'in-stock', image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTroU_VBAhZMr8Ebkw96ZXF9Ne-4FSXqQ1lsA&s', createdAt: '2026-02-07' },
  { id: 'p-9', sku: 'RL-SP-001', barcode: '8901234567009', name: 'Dry-Fit Running Tank', category: 'Sportswear', brand: 'Reliance', sizes: ['S', 'M', 'L', 'XL'], colors: ['Black', 'Neon Green', 'Grey'], fabricType: 'Polyester', costPrice: 950, sellingPrice: 1790, stock: 60, lowStockThreshold: 15, status: 'in-stock', image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=500&q=80', createdAt: '2026-02-10' },
  { id: 'p-10', sku: 'RL-FM-001', barcode: '8901234567010', name: 'Two-Piece Formal Suit', category: 'Formal Wear', brand: 'Reliance', sizes: ['M', 'L', 'XL'], colors: ['Black', 'Navy', 'Charcoal'], fabricType: 'Polyester', costPrice: 8500, sellingPrice: 14990, stock: 0, lowStockThreshold: 3, status: 'out-of-stock', image: 'https://www.sainly.com/cdn/shop/products/sainly-men-s-two-piece-suit-men-suits-men-two-piece-suit-men-party-suit-formal-fashion-suit-elegant-men-suit-suit-for-men-slim-fit-suit-men-prom-suit-30178638921787_grande.png?v=1663242132', createdAt: '2026-02-12' },
  { id: 'p-11', sku: 'RL-WS-001', barcode: '8901234567011', name: "Women's High-Rise Skinny Jeans", category: 'Denim', brand: 'Reliance', sizes: ['28', '30', '32'], colors: ['Black', 'Dark Blue'], fabricType: 'Denim', costPrice: 1650, sellingPrice: 3290, stock: 42, lowStockThreshold: 10, status: 'in-stock', image: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=500&q=80', createdAt: '2026-02-14' },
  { id: 'p-12', sku: 'RL-TR-001', barcode: '8901234567012', name: 'Silk Saree — Wedding Collection', category: 'Traditional', brand: 'Reliance', sizes: ['FREE'], colors: ['Red & Gold', 'Royal Blue', 'Emerald'], fabricType: 'Silk', costPrice: 12000, sellingPrice: 19990, stock: 5, lowStockThreshold: 3, status: 'in-stock', image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500&q=80', createdAt: '2026-02-16' },
  { id: 'p-13', sku: 'RL-MT-003', barcode: '8901234567013', name: 'Henley Long Sleeve Shirt', category: "Men's Wear", brand: 'Reliance', sizes: ['S', 'M', 'L', 'XL'], colors: ['Olive', 'Maroon', 'White'], fabricType: 'Cotton', costPrice: 1050, sellingPrice: 1890, stock: 55, lowStockThreshold: 12, status: 'in-stock', image: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=500&q=80', createdAt: '2026-02-18' },
  { id: 'p-14', sku: 'RL-WD-002', barcode: '8901234567014', name: 'Wrap Around Midi Skirt', category: "Women's Wear", brand: 'Reliance', sizes: ['S', 'M', 'L'], colors: ['Black', 'Olive', 'Rust'], fabricType: 'Linen', costPrice: 1400, sellingPrice: 2690, stock: 3, lowStockThreshold: 8, status: 'low-stock', image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=500&q=80', createdAt: '2026-02-20' },
  { id: 'p-15', sku: 'RL-AC-002', barcode: '8901234567015', name: "Men's Automatic Watch", category: 'Accessories', brand: 'Reliance', sizes: ['FREE'], colors: ['Silver/Black', 'Gold/Brown'], fabricType: 'Other', costPrice: 6800, sellingPrice: 11990, stock: 10, lowStockThreshold: 3, status: 'in-stock', image: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=500&q=80', createdAt: '2026-02-22' },
  { id: 'p-16', sku: 'RL-KD-002', barcode: '8901234567016', name: "Girls' Party Frock", category: "Kids' Wear", brand: 'Reliance', sizes: ['XS', 'S', 'M'], colors: ['Pink', 'Lavender', 'White'], fabricType: 'Satin', costPrice: 1500, sellingPrice: 2990, stock: 25, lowStockThreshold: 8, status: 'in-stock', image: 'https://s.alicdn.com/@sc04/kf/H31bf32ea89d04a6a99a204426617b4d5A/2025-Wholesale-New-Frock-Design-Boutique-Frocks-One-Piece-Girls-Party-Dress-Birthday-Wedding.jpg', createdAt: '2026-02-24' },
];

// ==========================================
// SUPPLIERS
// ==========================================
export const mockSuppliers: Supplier[] = [
  { id: 's-1', name: 'Colombo Textiles Ltd', contactPerson: 'Ruwan Perera', phone: '011-2345678', email: 'ruwan@colombotextiles.lk', address: 'No. 45, Galle Road, Colombo 03', city: 'Colombo', supplyType: 'Fabrics & Raw Materials', rating: 4.8, totalOrders: 124, outstandingBalance: 85000, status: 'active', image: 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=500&q=80', notes: 'Premium cotton and linen supplier. Consistent quality.', website: 'www.colombotextiles.lk', bankName: 'Commercial Bank', bankAccount: '1234567890', paymentTerms: 'Net 30', leadTimeDays: 7, joinedDate: '2024-06-15', lastOrderDate: '2026-02-28', reminderCount: 2, payments: [
    { id: 'sp-1', supplierId: 's-1', amount: 50000, paymentDate: '2026-02-10', paymentMethod: 'bank-transfer', reference: 'TXN-44521', notes: 'Part payment for Feb order' },
    { id: 'sp-2', supplierId: 's-1', amount: 25000, paymentDate: '2026-01-28', paymentMethod: 'cheque', reference: 'CHQ-8890', notes: 'January clearance' },
  ], reminders: [
    { id: 'sr-1', supplierId: 's-1', type: 'payment', channel: 'whatsapp', sentAt: '2026-02-25T10:30:00', message: 'Dear Ruwan, this is a payment reminder for outstanding balance of Rs. 85,000 from Colombo Textiles Ltd. Please arrange payment at your earliest convenience. - Reliance', supplierPhone: '011-2345678', supplierName: 'Colombo Textiles Ltd' },
    { id: 'sr-2', supplierId: 's-1', type: 'overdue', channel: 'whatsapp', sentAt: '2026-03-01T09:15:00', message: 'Dear Ruwan, your payment of Rs. 85,000 is now overdue. Please settle at your earliest. - Reliance', supplierPhone: '011-2345678', supplierName: 'Colombo Textiles Ltd' },
  ] },
  { id: 's-2', name: 'Fashion Hub Imports', contactPerson: 'Amara Silva', phone: '011-9876543', email: 'amara@fashionhub.lk', address: 'No. 12, Union Place, Colombo 02', city: 'Colombo', supplyType: 'Ready-Made Garments', rating: 4.5, totalOrders: 89, outstandingBalance: 120000, status: 'active', image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&q=80', notes: 'Import agent for branded clothing lines from India & China.', paymentTerms: 'Net 45', leadTimeDays: 14, joinedDate: '2024-08-20', lastOrderDate: '2026-03-01', reminderCount: 1, payments: [
    { id: 'sp-3', supplierId: 's-2', amount: 80000, paymentDate: '2026-02-20', paymentMethod: 'bank-transfer', reference: 'TXN-44612' },
  ], reminders: [
    { id: 'sr-3', supplierId: 's-2', type: 'payment', channel: 'whatsapp', sentAt: '2026-02-28T14:00:00', message: 'Dear Amara, a gentle reminder that Rs. 120,000 is outstanding for Fashion Hub Imports. Kindly arrange payment. - Reliance', supplierPhone: '011-9876543', supplierName: 'Fashion Hub Imports' },
  ] },
  { id: 's-3', name: 'Lanka Leather Works', contactPerson: 'Kasun Fernando', phone: '031-2234567', email: 'kasun@lankaleather.lk', address: 'No. 78, Kandy Road, Kadawatha', city: 'Kadawatha', supplyType: 'Leather Goods & Footwear', rating: 4.2, totalOrders: 56, outstandingBalance: 0, status: 'active', notes: 'Specializes in genuine leather bags and belts.', bankName: 'Sampath Bank', bankAccount: '0987654321', paymentTerms: 'Net 15', leadTimeDays: 10, joinedDate: '2025-01-10', lastOrderDate: '2026-02-15' },
  { id: 's-4', name: 'Denim World PLC', contactPerson: 'Nimal Jayawardena', phone: '011-5567890', email: 'nimal@denimworld.lk', address: 'No. 200, Baseline Road, Colombo 09', city: 'Colombo', supplyType: 'Denim & Casual Wear', rating: 4.6, totalOrders: 78, outstandingBalance: 45000, status: 'active', image: 'https://images.unsplash.com/photo-1565084888279-aca607ecce0c?w=500&q=80', notes: 'Best denim supplier in the country. Great variety.', website: 'www.denimworld.lk', paymentTerms: 'Net 30', leadTimeDays: 5, joinedDate: '2024-11-22', lastOrderDate: '2026-02-25' },
  { id: 's-5', name: 'Elegant Sarees', contactPerson: 'Kumari Rathnayake', phone: '081-2345678', email: 'kumari@elegantSarees.lk', address: 'No. 15, Peradeniya Road, Kandy', city: 'Kandy', supplyType: 'Traditional Wear', rating: 4.9, totalOrders: 34, outstandingBalance: 200000, status: 'active', image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500&q=80', notes: 'Premium silk saree supplier from Kandy. Wedding collections.', paymentTerms: 'Net 60', leadTimeDays: 21, joinedDate: '2025-03-05', lastOrderDate: '2026-02-20', reminderCount: 3, payments: [
    { id: 'sp-4', supplierId: 's-5', amount: 100000, paymentDate: '2026-01-15', paymentMethod: 'bank-transfer', reference: 'TXN-44100', notes: 'Advance for wedding season order' },
    { id: 'sp-5', supplierId: 's-5', amount: 50000, paymentDate: '2026-02-05', paymentMethod: 'cheque', reference: 'CHQ-9910' },
  ], reminders: [
    { id: 'sr-4', supplierId: 's-5', type: 'payment', channel: 'whatsapp', sentAt: '2026-01-20T11:00:00', message: 'Dear Kumari, reminder: Rs. 200,000 outstanding for Elegant Sarees. - Reliance', supplierPhone: '081-2345678', supplierName: 'Elegant Sarees' },
    { id: 'sr-5', supplierId: 's-5', type: 'payment', channel: 'whatsapp', sentAt: '2026-02-10T09:30:00', message: 'Dear Kumari, Rs. 200,000 still pending. Please settle. - Reliance', supplierPhone: '081-2345678', supplierName: 'Elegant Sarees' },
    { id: 'sr-6', supplierId: 's-5', type: 'overdue', channel: 'whatsapp', sentAt: '2026-02-28T16:00:00', message: 'Dear Kumari, OVERDUE: Rs. 200,000 for Elegant Sarees is past due. Urgent payment required. - Reliance', supplierPhone: '081-2345678', supplierName: 'Elegant Sarees' },
  ] },
  { id: 's-6', name: 'ActiveWear Solutions', contactPerson: 'Dinesh Gamage', phone: '011-7788990', email: 'dinesh@activewear.lk', address: 'No. 88, Duplication Road, Colombo 04', city: 'Colombo', supplyType: 'Sportswear & Activewear', rating: 3.8, totalOrders: 22, outstandingBalance: 0, status: 'inactive', image: 'https://ual-media-res.cloudinary.com/image/fetch/c_fill,f_auto,g_auto/https://www.arts.ac.uk/__data/assets/image/0036/548829/Athleisure-1.jpg', notes: 'Temporarily paused supply. Will resume Q2 2026.', paymentTerms: 'Net 30', leadTimeDays: 12, joinedDate: '2025-06-18', lastOrderDate: '2025-12-10' },
  { id: 's-7', name: 'Perera & Sons Tailoring', contactPerson: 'Mahinda Perera', phone: '011-4455667', email: 'mahinda@pererasuits.lk', address: 'No. 22, Flower Road, Colombo 07', city: 'Colombo', supplyType: 'Formal Wear', rating: 4.7, totalOrders: 45, outstandingBalance: 32000, status: 'active', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&q=80', notes: 'Custom tailored suits and blazers. Best quality formal wear.', website: 'www.pererasuits.lk', bankName: 'HNB', bankAccount: '5566778899', paymentTerms: 'Net 30', leadTimeDays: 14, joinedDate: '2025-02-14', lastOrderDate: '2026-03-02' },
  { id: 's-8', name: 'Little Stars Kids Wear', contactPerson: 'Sanduni Wickramasinghe', phone: '077-8899001', email: 'sanduni@littlestars.lk', address: 'No. 55, High Level Road, Nugegoda', city: 'Nugegoda', supplyType: 'Kids Clothing', rating: 4.4, totalOrders: 38, outstandingBalance: 15000, status: 'active', image: 'https://mir-s3-cdn-cf.behance.net/project_modules/max_632_webp/cb919e124321033.61017d216b12f.jpg', notes: 'Colourful kids clothing. Good seasonal collections.', paymentTerms: 'Net 15', leadTimeDays: 7, joinedDate: '2025-04-01', lastOrderDate: '2026-02-27' },
  { id: 's-9', name: 'Trendy Accessories Hub', contactPerson: 'Chathura Bandara', phone: '076-1234567', email: 'chathura@trendyacc.lk', address: 'No. 33, Main Street, Panadura', city: 'Panadura', supplyType: 'Accessories & Bags', rating: 4.1, totalOrders: 29, outstandingBalance: 0, status: 'active', image: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=500&q=80', notes: 'Watches, belts, bags and fashion accessories.', paymentTerms: 'COD', leadTimeDays: 3, joinedDate: '2025-07-20', lastOrderDate: '2026-02-18' },
  { id: 's-10', name: 'Galle Silk House', contactPerson: 'Nimali Ranasinghe', phone: '091-2233445', email: 'nimali@gallesilk.lk', address: 'No. 8, Church Street, Galle Fort', city: 'Galle', supplyType: 'Traditional Wear', rating: 4.3, totalOrders: 18, outstandingBalance: 75000, status: 'active', image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTfrulGGe3-SmRehSUvOvUR5n1V20nJgxtkqw&s', notes: 'Handloom fabrics and traditional garments from Galle.', paymentTerms: 'Net 45', leadTimeDays: 18, joinedDate: '2025-09-12', lastOrderDate: '2026-01-30' },
  { id: 's-11', name: 'Metro Garments Export', contactPerson: 'Lasantha Wijesinghe', phone: '011-6677889', email: 'lasantha@metrogarments.lk', address: 'No. 150, Negombo Road, Wattala', city: 'Wattala', supplyType: 'Ready-Made Garments', rating: 3.5, totalOrders: 12, outstandingBalance: 0, status: 'inactive', image: 'https://images.squarespace-cdn.com/content/v1/5006ce9924ac21f35d8ef7ab/1474280164107-NXZLW7IOXZ30KTAQ7DFQ/ke17ZwdGBToddI8pDm48kEFLC85QDq405h6YJfo_yWAUqsxRUqqbr1mOJYKfIPR7LoDQ9mXPOjoJoqy81S2I8N_N4V1vUb5AoIIIbLZhVYy7Mythp_T-mtop-vrsUOmeInPi9iDjx9w8K4ZfjXt2dgB80TgcOVM0VabsFOX5rOaTR544TV0DsdTf2iRJiVA6P7cJNZlDXbgJNE9ef52e8w/apparel-sewing-floor', notes: 'Export rejects at discounted prices. Quality varies.', paymentTerms: 'COD', leadTimeDays: 2, joinedDate: '2025-11-05', lastOrderDate: '2026-01-08' },
  { id: 's-12', name: 'Royal Textiles International', contactPerson: 'Priyanka De Silva', phone: '011-3344556', email: 'priyanka@royaltextiles.lk', address: 'No. 99, Bauddhaloka Mawatha, Colombo 04', city: 'Colombo', supplyType: 'Fabrics & Raw Materials', rating: 4.6, totalOrders: 67, outstandingBalance: 55000, status: 'active', image: 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=500&q=80', notes: 'International fabric imports. Wool, silk, premium cotton.', website: 'www.royaltextiles.lk', bankName: 'BOC', bankAccount: '1122334455', paymentTerms: 'Net 30', leadTimeDays: 10, joinedDate: '2024-09-01', lastOrderDate: '2026-03-01' },
];

// ==========================================
// INVOICES
// ==========================================
export const mockInvoices: Invoice[] = [
  {
    id: 'inv-1', invoiceNumber: 'INV-2026-001', customerName: 'Kamal Gunawardena', customerPhone: '077-1234567', customerEmail: 'kamal@gmail.com',
    items: [
      { productId: 'p-1', productName: 'Classic Crew Neck T-Shirt', sku: 'RL-MT-001', barcode: '8901234567001', size: 'L', color: 'Black', quantity: 3, unitPrice: 1490, discount: 0, total: 4470 },
      { productId: 'p-4', productName: 'Slim Fit Stretch Jeans', sku: 'RL-MJ-001', barcode: '8901234567004', size: '32', color: 'Dark Blue', quantity: 1, unitPrice: 3490, discount: 200, total: 3290 },
    ],
    subtotal: 7760, discount: 200, tax: 0, total: 7560, paidAmount: 7560, dueDate: '2026-03-25', paymentMethod: 'cash', status: 'paid',
    payments: [{ id: 'pay-1', invoiceId: 'inv-1', amount: 7560, paymentDate: '2026-02-25T10:30:00', paymentMethod: 'cash' }],
    createdAt: '2026-02-25T10:30:00',
  },
  {
    id: 'inv-2', invoiceNumber: 'INV-2026-002', customerName: 'Sachini Madhushani', customerPhone: '076-9876543', customerEmail: 'sachini@yahoo.com',
    items: [
      { productId: 'p-3', productName: 'Floral Maxi Dress', sku: 'RL-WD-001', barcode: '8901234567003', size: 'M', color: 'Blush Pink', quantity: 1, unitPrice: 4490, discount: 0, total: 4490 },
      { productId: 'p-7', productName: 'Leather Crossbody Bag', sku: 'RL-AC-001', barcode: '8901234567007', size: 'FREE', color: 'Tan', quantity: 1, unitPrice: 5990, discount: 500, total: 5490 },
    ],
    subtotal: 10480, discount: 500, tax: 0, total: 9980, paidAmount: 5000, dueDate: '2026-03-15', paymentMethod: 'card', status: 'partial',
    payments: [
      { id: 'pay-2a', invoiceId: 'inv-2', amount: 3000, paymentDate: '2026-02-26T14:15:00', paymentMethod: 'card' },
      { id: 'pay-2b', invoiceId: 'inv-2', amount: 2000, paymentDate: '2026-02-28T09:00:00', paymentMethod: 'cash' },
    ],
    createdAt: '2026-02-26T14:15:00',
  },
  {
    id: 'inv-3', invoiceNumber: 'INV-2026-003', customerName: 'Ashan Bandara', customerPhone: '071-5556789',
    items: [
      { productId: 'p-10', productName: 'Two-Piece Formal Suit', sku: 'RL-FM-001', barcode: '8901234567010', size: 'L', color: 'Navy', quantity: 1, unitPrice: 14990, discount: 1000, total: 13990 },
      { productId: 'p-8', productName: "Men's Leather Oxford Shoes", sku: 'RL-FW-001', barcode: '8901234567008', size: 'FREE', color: 'Black', quantity: 1, unitPrice: 7990, discount: 0, total: 7990 },
      { productId: 'p-15', productName: "Men's Automatic Watch", sku: 'RL-AC-002', barcode: '8901234567015', size: 'FREE', color: 'Silver/Black', quantity: 1, unitPrice: 11990, discount: 0, total: 11990 },
    ],
    subtotal: 34970, discount: 1000, tax: 0, total: 33970, paidAmount: 33970, dueDate: '2026-03-27', paymentMethod: 'bank-transfer', status: 'paid',
    payments: [{ id: 'pay-3', invoiceId: 'inv-3', amount: 33970, paymentDate: '2026-02-27T09:00:00', paymentMethod: 'bank-transfer' }],
    createdAt: '2026-02-27T09:00:00',
  },
  {
    id: 'inv-4', invoiceNumber: 'INV-2026-004', customerName: 'Dulani Weerasinghe', customerPhone: '078-3334444', customerEmail: 'dulani.w@gmail.com',
    items: [
      { productId: 'p-12', productName: 'Silk Saree — Wedding Collection', sku: 'RL-TR-001', barcode: '8901234567012', size: 'FREE', color: 'Red & Gold', quantity: 1, unitPrice: 19990, discount: 0, total: 19990 },
    ],
    subtotal: 19990, discount: 0, tax: 0, total: 19990, paidAmount: 0, dueDate: '2026-03-10', paymentMethod: 'credit', status: 'pending',
    payments: [],
    notes: 'Wedding order — promised pick-up in 2 weeks', createdAt: '2026-02-28T11:45:00',
  },
  {
    id: 'inv-5', invoiceNumber: 'INV-2026-005', customerName: 'Lakshan Jayasuriya', customerPhone: '070-1112222',
    items: [
      { productId: 'p-9', productName: 'Dry-Fit Running Tank', sku: 'RL-SP-001', barcode: '8901234567009', size: 'M', color: 'Black', quantity: 2, unitPrice: 1790, discount: 0, total: 3580 },
      { productId: 'p-2', productName: 'Slim Fit Polo Shirt', sku: 'RL-MT-002', barcode: '8901234567002', size: 'L', color: 'Charcoal', quantity: 1, unitPrice: 2290, discount: 0, total: 2290 },
    ],
    subtotal: 5870, discount: 0, tax: 0, total: 5870, paidAmount: 5870, dueDate: '2026-03-31', paymentMethod: 'cash', status: 'paid',
    payments: [{ id: 'pay-5', invoiceId: 'inv-5', amount: 5870, paymentDate: '2026-03-01T08:20:00', paymentMethod: 'cash' }],
    createdAt: '2026-03-01T08:20:00',
  },
  {
    id: 'inv-6', invoiceNumber: 'INV-2026-006', customerName: 'Tharushi Herath', customerPhone: '072-7778888', customerEmail: 'tharushi.h@outlook.com',
    items: [
      { productId: 'p-5', productName: 'Cotton Casual Blouse', sku: 'RL-WT-001', barcode: '8901234567005', size: 'M', color: 'Sage', quantity: 2, unitPrice: 1990, discount: 200, total: 3780 },
      { productId: 'p-14', productName: 'Wrap Around Midi Skirt', sku: 'RL-WD-002', barcode: '8901234567014', size: 'M', color: 'Black', quantity: 1, unitPrice: 2690, discount: 0, total: 2690 },
      { productId: 'p-11', productName: "Women's High-Rise Skinny Jeans", sku: 'RL-WS-001', barcode: '8901234567011', size: '30', color: 'Black', quantity: 1, unitPrice: 3290, discount: 290, total: 3000 },
    ],
    subtotal: 9970, discount: 490, tax: 0, total: 9470, paidAmount: 9470, dueDate: '2026-03-31', paymentMethod: 'card', status: 'paid',
    payments: [{ id: 'pay-6', invoiceId: 'inv-6', amount: 9470, paymentDate: '2026-03-01T12:00:00', paymentMethod: 'card' }],
    createdAt: '2026-03-01T12:00:00',
  },
  {
    id: 'inv-7', invoiceNumber: 'INV-2026-007', customerName: 'Walk-in Customer', customerPhone: '-',
    items: [
      { productId: 'p-6', productName: "Kids' Graphic Tee", sku: 'RL-KB-001', barcode: '8901234567006', size: 'S', color: 'Blue', quantity: 4, unitPrice: 990, discount: 0, total: 3960 },
      { productId: 'p-16', productName: "Girls' Party Frock", sku: 'RL-KD-002', barcode: '8901234567016', size: 'S', color: 'Pink', quantity: 1, unitPrice: 2990, discount: 0, total: 2990 },
    ],
    subtotal: 6950, discount: 0, tax: 0, total: 6950, paidAmount: 6950, dueDate: '2026-03-31', paymentMethod: 'cash', status: 'paid',
    payments: [{ id: 'pay-7', invoiceId: 'inv-7', amount: 6950, paymentDate: '2026-03-01T15:30:00', paymentMethod: 'cash' }],
    createdAt: '2026-03-01T15:30:00',
  },
  {
    id: 'inv-8', invoiceNumber: 'INV-2026-008', customerName: 'Mahesh Rathnayake', customerPhone: '075-4445555',
    items: [
      { productId: 'p-13', productName: 'Henley Long Sleeve Shirt', sku: 'RL-MT-003', barcode: '8901234567013', size: 'XL', color: 'Olive', quantity: 2, unitPrice: 1890, discount: 0, total: 3780 },
    ],
    subtotal: 3780, discount: 0, tax: 0, total: 3780, paidAmount: 2000, dueDate: '2026-03-15', paymentMethod: 'cash', status: 'partial',
    payments: [{ id: 'pay-8', invoiceId: 'inv-8', amount: 2000, paymentDate: '2026-03-01T16:45:00', paymentMethod: 'cash' }],
    notes: 'Remaining Rs. 1,780 to be paid next week', createdAt: '2026-03-01T16:45:00',
  },
  {
    id: 'inv-9', invoiceNumber: 'INV-2026-009', customerName: 'Nadeeka Perera', customerPhone: '077-8889999', customerEmail: 'nadeeka.p@gmail.com',
    items: [
      { productId: 'p-3', productName: 'Floral Maxi Dress', sku: 'RL-WD-001', barcode: '8901234567003', size: 'S', color: 'Ivory', quantity: 1, unitPrice: 4490, discount: 0, total: 4490 },
      { productId: 'p-14', productName: 'Wrap Around Midi Skirt', sku: 'RL-WD-002', barcode: '8901234567014', size: 'S', color: 'Rust', quantity: 1, unitPrice: 2690, discount: 300, total: 2390 },
      { productId: 'p-7', productName: 'Leather Crossbody Bag', sku: 'RL-AC-001', barcode: '8901234567007', size: 'FREE', color: 'Burgundy', quantity: 1, unitPrice: 5990, discount: 0, total: 5990 },
    ],
    subtotal: 13170, discount: 300, tax: 0, total: 12870, paidAmount: 12870, dueDate: '2026-03-28', paymentMethod: 'card', status: 'paid',
    payments: [{ id: 'pay-9', invoiceId: 'inv-9', amount: 12870, paymentDate: '2026-02-28T14:30:00', paymentMethod: 'card' }],
    createdAt: '2026-02-28T14:30:00',
  },
  {
    id: 'inv-10', invoiceNumber: 'INV-2026-010', customerName: 'Roshan De Silva', customerPhone: '071-6667777',
    items: [
      { productId: 'p-4', productName: 'Slim Fit Stretch Jeans', sku: 'RL-MJ-001', barcode: '8901234567004', size: '34', color: 'Black', quantity: 2, unitPrice: 3490, discount: 0, total: 6980 },
      { productId: 'p-1', productName: 'Classic Crew Neck T-Shirt', sku: 'RL-MT-001', barcode: '8901234567001', size: 'XL', color: 'White', quantity: 3, unitPrice: 1490, discount: 0, total: 4470 },
      { productId: 'p-13', productName: 'Henley Long Sleeve Shirt', sku: 'RL-MT-003', barcode: '8901234567013', size: 'L', color: 'White', quantity: 1, unitPrice: 1890, discount: 0, total: 1890 },
    ],
    subtotal: 13340, discount: 0, tax: 0, total: 13340, paidAmount: 5000, dueDate: '2026-03-08', paymentMethod: 'cash', status: 'partial',
    payments: [{ id: 'pay-10', invoiceId: 'inv-10', amount: 5000, paymentDate: '2026-02-26T11:00:00', paymentMethod: 'cash' }],
    notes: 'Regular customer — 3 jeans + t-shirts bulk purchase', createdAt: '2026-02-26T11:00:00',
  },
  {
    id: 'inv-11', invoiceNumber: 'INV-2026-011', customerName: 'Chamari Fernando', customerPhone: '076-2223333',
    items: [
      { productId: 'p-12', productName: 'Silk Saree — Wedding Collection', sku: 'RL-TR-001', barcode: '8901234567012', size: 'FREE', color: 'Royal Blue', quantity: 2, unitPrice: 19990, discount: 2000, total: 37980 },
      { productId: 'p-5', productName: 'Cotton Casual Blouse', sku: 'RL-WT-001', barcode: '8901234567005', size: 'L', color: 'White', quantity: 1, unitPrice: 1990, discount: 0, total: 1990 },
    ],
    subtotal: 41970, discount: 2000, tax: 0, total: 39970, paidAmount: 0, dueDate: '2026-02-25', paymentMethod: 'credit', status: 'pending',
    payments: [],
    notes: 'OVERDUE — 2 sarees for family wedding. Customer promised payment after wedding.', createdAt: '2026-02-20T16:00:00',
  },
  {
    id: 'inv-12', invoiceNumber: 'INV-2026-012', customerName: 'Walk-in Customer', customerPhone: '-',
    items: [
      { productId: 'p-9', productName: 'Dry-Fit Running Tank', sku: 'RL-SP-001', barcode: '8901234567009', size: 'L', color: 'Neon Green', quantity: 1, unitPrice: 1790, discount: 0, total: 1790 },
    ],
    subtotal: 1790, discount: 0, tax: 0, total: 1790, paidAmount: 1790, dueDate: '2026-03-31', paymentMethod: 'cash', status: 'paid',
    payments: [{ id: 'pay-12', invoiceId: 'inv-12', amount: 1790, paymentDate: '2026-03-01T09:15:00', paymentMethod: 'cash' }],
    createdAt: '2026-03-01T09:15:00',
  },
];

// ==========================================
// CUSTOMERS
// ==========================================
export const mockCustomers: Customer[] = [
  { id: 'c-1', name: 'Kamal Gunawardena', phone: '077-1234567', email: 'kamal@gmail.com', address: 'No. 23, Temple Road, Dehiwala', city: 'Dehiwala', customerType: 'Regular', totalPurchases: 8, totalSpent: 45000, outstandingBalance: 0, loyaltyPoints: 450, status: 'active', joinedDate: '2025-06-10', lastPurchaseDate: '2026-02-25', notes: 'Prefers formal wear and dark colours.' },
  { id: 'c-2', name: 'Sachini Madhushani', phone: '076-9876543', email: 'sachini@yahoo.com', address: 'No. 45, Galle Road, Mount Lavinia', city: 'Mount Lavinia', customerType: 'VIP', totalPurchases: 15, totalSpent: 125000, outstandingBalance: 4980, loyaltyPoints: 1250, status: 'active', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&q=80', joinedDate: '2024-11-20', lastPurchaseDate: '2026-02-26', reminderCount: 1, notes: 'VIP customer — always buys premium items.', payments: [
    { id: 'cp-1', customerId: 'c-2', amount: 5000, paymentDate: '2026-02-26', paymentMethod: 'card', reference: 'TXN-88001' },
  ], reminders: [
    { id: 'cr-1', customerId: 'c-2', type: 'payment', channel: 'whatsapp', sentAt: '2026-03-01T10:00:00', message: 'Dear Sachini, a friendly reminder that Rs. 4,980 is outstanding on your account. Please settle at your convenience. — Reliance', customerPhone: '076-9876543', customerName: 'Sachini Madhushani' },
  ] },
  { id: 'c-3', name: 'Ashan Bandara', phone: '071-5556789', email: 'ashan.b@gmail.com', address: 'No. 12, Kandy Road, Kaduwela', city: 'Kaduwela', customerType: 'Regular', totalPurchases: 4, totalSpent: 62000, outstandingBalance: 0, loyaltyPoints: 620, status: 'active', joinedDate: '2025-08-05', lastPurchaseDate: '2026-02-27' },
  { id: 'c-4', name: 'Dulani Weerasinghe', phone: '078-3334444', email: 'dulani.w@gmail.com', address: 'No. 67, High Level Road, Nugegoda', city: 'Nugegoda', customerType: 'Regular', totalPurchases: 3, totalSpent: 28000, outstandingBalance: 19990, loyaltyPoints: 280, status: 'active', joinedDate: '2025-12-01', lastPurchaseDate: '2026-02-28', reminderCount: 2, notes: 'Wedding order — promised payment after event.', payments: [], reminders: [
    { id: 'cr-2', customerId: 'c-4', type: 'payment', channel: 'whatsapp', sentAt: '2026-03-03T09:00:00', message: 'Dear Dulani, reminder: Rs. 19,990 outstanding for your wedding saree. Please settle. — Reliance', customerPhone: '078-3334444', customerName: 'Dulani Weerasinghe' },
    { id: 'cr-3', customerId: 'c-4', type: 'overdue', channel: 'whatsapp', sentAt: '2026-03-10T14:30:00', message: 'Dear Dulani, OVERDUE: Rs. 19,990 is past due. Please settle urgently. — Reliance', customerPhone: '078-3334444', customerName: 'Dulani Weerasinghe' },
  ] },
  { id: 'c-5', name: 'Lakshan Jayasuriya', phone: '070-1112222', email: 'lakshan.j@outlook.com', address: 'No. 90, Bauddhaloka Mawatha, Colombo 07', city: 'Colombo', customerType: 'Regular', totalPurchases: 5, totalSpent: 32000, outstandingBalance: 0, loyaltyPoints: 320, status: 'active', joinedDate: '2025-09-14', lastPurchaseDate: '2026-03-01' },
  { id: 'c-6', name: 'Tharushi Herath', phone: '072-7778888', email: 'tharushi.h@outlook.com', address: 'No. 15, Park Road, Colombo 05', city: 'Colombo', customerType: 'VIP', totalPurchases: 12, totalSpent: 98000, outstandingBalance: 0, loyaltyPoints: 980, status: 'active', image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=500&q=80', joinedDate: '2025-03-22', lastPurchaseDate: '2026-03-01', notes: 'Fashion-forward customer. Buys seasonal collections.' },
  { id: 'c-7', name: 'Mahesh Rathnayake', phone: '075-4445555', email: 'mahesh.r@gmail.com', address: 'No. 34, Station Road, Panadura', city: 'Panadura', customerType: 'Regular', totalPurchases: 3, totalSpent: 12500, outstandingBalance: 1780, loyaltyPoints: 125, status: 'active', joinedDate: '2025-11-08', lastPurchaseDate: '2026-03-01', notes: 'Remaining Rs. 1,780 to be paid next week.' },
  { id: 'c-8', name: 'Nadeeka Perera', phone: '077-8889999', email: 'nadeeka.p@gmail.com', address: 'No. 56, Main Street, Moratuwa', city: 'Moratuwa', customerType: 'Regular', totalPurchases: 6, totalSpent: 55000, outstandingBalance: 0, loyaltyPoints: 550, status: 'active', joinedDate: '2025-07-15', lastPurchaseDate: '2026-02-28' },
  { id: 'c-9', name: 'Roshan De Silva', phone: '071-6667777', email: 'roshan.ds@gmail.com', address: 'No. 78, Galle Face Terrace, Colombo 03', city: 'Colombo', customerType: 'Wholesale', totalPurchases: 10, totalSpent: 185000, outstandingBalance: 8340, loyaltyPoints: 1850, status: 'active', nic: '199012345678', joinedDate: '2025-01-20', lastPurchaseDate: '2026-02-26', notes: 'Bulk buyer — 3+ items per visit. Regular customer.' },
  { id: 'c-10', name: 'Chamari Fernando', phone: '076-2223333', email: 'chamari.f@gmail.com', address: 'No. 22, Lake Drive, Kandy', city: 'Kandy', customerType: 'Regular', totalPurchases: 2, totalSpent: 41960, outstandingBalance: 39970, loyaltyPoints: 420, status: 'active', joinedDate: '2025-10-05', lastPurchaseDate: '2026-02-20', reminderCount: 3, notes: 'OVERDUE — 2 sarees for family wedding. Promised payment after wedding.', reminders: [
    { id: 'cr-4', customerId: 'c-10', type: 'payment', channel: 'whatsapp', sentAt: '2026-02-25T11:00:00', message: 'Dear Chamari, reminder: Rs. 39,970 outstanding. Please settle. — Reliance', customerPhone: '076-2223333', customerName: 'Chamari Fernando' },
    { id: 'cr-5', customerId: 'c-10', type: 'payment', channel: 'whatsapp', sentAt: '2026-03-01T09:30:00', message: 'Dear Chamari, Rs. 39,970 still pending. Please arrange payment. — Reliance', customerPhone: '076-2223333', customerName: 'Chamari Fernando' },
    { id: 'cr-6', customerId: 'c-10', type: 'overdue', channel: 'whatsapp', sentAt: '2026-03-08T16:00:00', message: 'Dear Chamari, OVERDUE: Rs. 39,970 is past due. Urgent payment required. — Reliance', customerPhone: '076-2223333', customerName: 'Chamari Fernando' },
  ] },
  { id: 'c-11', name: 'Pradeep Wickramasinghe', phone: '077-5551234', email: 'pradeep.w@company.lk', address: 'No. 100, Baseline Road, Colombo 09', city: 'Colombo', customerType: 'Corporate', totalPurchases: 20, totalSpent: 350000, outstandingBalance: 25000, loyaltyPoints: 3500, status: 'active', nic: '198812345678', joinedDate: '2024-06-15', lastPurchaseDate: '2026-03-01', notes: 'Corporate client — buys uniforms and formal wear in bulk.' },
  { id: 'c-12', name: 'Dilhani Jayawardena', phone: '072-9998877', email: 'dilhani.j@gmail.com', address: 'No. 8, Beach Road, Galle', city: 'Galle', customerType: 'Online', totalPurchases: 2, totalSpent: 8500, outstandingBalance: 0, loyaltyPoints: 85, status: 'inactive', joinedDate: '2025-12-20', lastPurchaseDate: '2026-01-10', notes: 'Online-only customer. Not purchased recently.' },
];

// ==========================================
// DAILY SALES DATA (30 days)
// ==========================================
export const mockDailySales: DailySales[] = Array.from({ length: 30 }, (_, i) => {
  const d = new Date('2026-02-01');
  d.setDate(d.getDate() + i);
  const base = 15000 + Math.random() * 35000;
  return {
    date: d.toISOString().split('T')[0],
    revenue: Math.round(base),
    orders: Math.floor(5 + Math.random() * 15),
    profit: Math.round(base * (0.25 + Math.random() * 0.15)),
  };
});

// ==========================================
// TOP SELLING
// ==========================================
export const topSellingProducts = [
  { name: 'Classic Crew Neck T-Shirt', unitsSold: 342, revenue: 509580 },
  { name: 'Slim Fit Stretch Jeans', unitsSold: 218, revenue: 760820 },
  { name: 'Floral Maxi Dress', unitsSold: 156, revenue: 700440 },
  { name: 'Leather Crossbody Bag', unitsSold: 89, revenue: 533110 },
  { name: "Kids' Graphic Tee", unitsSold: 280, revenue: 277200 },
];

export const categoryRevenue = [
  { name: "Men's Wear", revenue: 1250000, percentage: 28 },
  { name: "Women's Wear", revenue: 1100000, percentage: 24 },
  { name: 'Denim', revenue: 680000, percentage: 15 },
  { name: 'Footwear', revenue: 520000, percentage: 11 },
  { name: 'Accessories', revenue: 450000, percentage: 10 },
  { name: "Kids' Wear", revenue: 320000, percentage: 7 },
  { name: 'Others', revenue: 230000, percentage: 5 },
];
