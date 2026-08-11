-- Buffer + debounce state for Bale channel → site product sync

CREATE TABLE IF NOT EXISTS bale_channel_message_buffer (
  id BIGSERIAL PRIMARY KEY,
  chat_id TEXT NOT NULL,
  message_id BIGINT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bale_channel_message_buffer_chat_created_idx
  ON bale_channel_message_buffer (chat_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bale_channel_sync_state (
  chat_id TEXT PRIMARY KEY,
  debounce_until TIMESTAMPTZ NOT NULL,
  last_synced_at TIMESTAMPTZ,
  last_stats JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE bale_channel_message_buffer IS 'پیام‌های کانال بله در انتظار همگام‌سازی محصولات';
COMMENT ON TABLE bale_channel_sync_state IS 'زمان‌بندی debounce همگام‌سازی خودکار کانال بله';

ALTER TABLE bale_channel_message_buffer ENABLE ROW LEVEL SECURITY;
ALTER TABLE bale_channel_sync_state ENABLE ROW LEVEL SECURITY;
-- بدون policy عمومی؛ فقط service role (همگام‌سازی سرور) دسترسی دارد
