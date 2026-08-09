export type UserRole = "user" | "admin";

export type OrderStatus =
  | "pending_confirmation"
  | "awaiting_payment"
  | "paid"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Product {
  id: string;
  category_id: string | null;
  brand: string;
  model: string;
  storage: string | null;
  ram: string | null;
  color: string;
  price: number;
  stock: number;
  origin: string | null;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  raw_import_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  status: OrderStatus;
  total_amount: number;
  shipping_address: string;
  contact_phone: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  color: string | null;
  product_title: string | null;
  created_at: string;
}

export interface ProductImport {
  id: string;
  raw_text: string;
  parsed_count: number;
  imported_by: string | null;
  created_at: string;
}

export interface ParsedProduct {
  brand: string;
  model: string;
  storage: string | null;
  ram: string | null;
  color: string;
  price: number;
  origin: string | null;
  raw_line: string;
}

export interface CartItem {
  productId: string;
  brand: string;
  model: string;
  storage: string | null;
  ram: string | null;
  color: string;
  origin: string | null;
  price: number;
  quantity: number;
  image_url: string | null;
}
