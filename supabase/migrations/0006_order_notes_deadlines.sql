-- Order note history + payment timing windows

CREATE TABLE IF NOT EXISTS order_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  template_key TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sent_to_customer BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_notes_order_created
  ON order_notes(order_id, created_at DESC);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_deadline_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_confirm_deadline_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.payment_deadline_at IS 'مهلت ۱۰ دقیقه‌ای مشتری برای واریز و ارسال رسید';
COMMENT ON COLUMN orders.admin_confirm_deadline_at IS 'مهلت ۱۵ دقیقه‌ای ادمین برای ثبت شماره پیگیری و تأیید پرداخت';

ALTER TABLE order_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_notes_select_own_or_admin" ON order_notes;
CREATE POLICY "order_notes_select_own_or_admin" ON order_notes
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_notes.order_id AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "order_notes_admin_insert" ON order_notes;
CREATE POLICY "order_notes_admin_insert" ON order_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
