-- Refahestoon initial schema
-- Enums, tables, RLS, triggers, seed

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'pending_confirmation',
    'awaiting_payment',
    'paid',
    'preparing',
    'shipped',
    'delivered',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  storage TEXT,
  ram TEXT,
  color TEXT NOT NULL,
  price BIGINT NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  origin TEXT,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  raw_import_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT products_unique_variant UNIQUE NULLS NOT DISTINCT (brand, model, storage, ram, color, origin)
);

CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status order_status NOT NULL DEFAULT 'pending_confirmation',
  total_amount BIGINT NOT NULL CHECK (total_amount >= 0),
  shipping_address TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- Order items
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price BIGINT NOT NULL CHECK (unit_price >= 0),
  color TEXT,
  product_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- Product imports log
CREATE TABLE IF NOT EXISTS product_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_text TEXT NOT NULL,
  parsed_count INTEGER NOT NULL DEFAULT 0,
  imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- OTP codes (Edge Functions with service role)
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_phone_created ON otp_codes(phone, created_at DESC);

-- Helpers
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  phone_value TEXT;
BEGIN
  phone_value := COALESCE(
    NEW.raw_user_meta_data->>'phone',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (id, phone, full_name, role)
  VALUES (
    NEW.id,
    phone_value,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed categories
INSERT INTO categories (name, slug)
VALUES
  ('موبایل', 'mobile'),
  ('آیفون بدون رجیستری', 'iphone-noreg')
ON CONFLICT (slug) DO NOTHING;

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
CREATE POLICY "profiles_select_own_or_admin" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON profiles;
CREATE POLICY "profiles_update_own_or_admin" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (
    (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()))
    OR public.is_admin()
  );

-- Categories
DROP POLICY IF EXISTS "categories_public_read" ON categories;
CREATE POLICY "categories_public_read" ON categories
  FOR SELECT TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "categories_admin_write" ON categories;
CREATE POLICY "categories_admin_write" ON categories
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Products
DROP POLICY IF EXISTS "products_public_read_active" ON products;
CREATE POLICY "products_public_read_active" ON products
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "products_admin_write" ON products;
CREATE POLICY "products_admin_write" ON products
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Orders
DROP POLICY IF EXISTS "orders_select_own_or_admin" ON orders;
CREATE POLICY "orders_select_own_or_admin" ON orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "orders_insert_own" ON orders;
CREATE POLICY "orders_insert_own" ON orders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "orders_admin_update" ON orders;
CREATE POLICY "orders_admin_update" ON orders
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Order items
DROP POLICY IF EXISTS "order_items_select_own_or_admin" ON order_items;
CREATE POLICY "order_items_select_own_or_admin" ON order_items
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "order_items_insert_own" ON order_items;
CREATE POLICY "order_items_insert_own" ON order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "order_items_admin_all" ON order_items;
CREATE POLICY "order_items_admin_all" ON order_items
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Product imports (admin only)
DROP POLICY IF EXISTS "imports_admin_all" ON product_imports;
CREATE POLICY "imports_admin_all" ON product_imports
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- OTP: no client access (service role bypasses RLS)
DROP POLICY IF EXISTS "otp_no_client_access" ON otp_codes;
CREATE POLICY "otp_no_client_access" ON otp_codes
  FOR ALL TO authenticated
  USING (FALSE)
  WITH CHECK (FALSE);
