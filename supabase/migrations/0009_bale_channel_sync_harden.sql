-- Harden Bale channel auto-sync for unattended operation

ALTER TABLE bale_channel_sync_state
  ADD COLUMN IF NOT EXISTS sync_lock TEXT,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS pending_since TIMESTAMPTZ;

-- جلوگیری از درج تکراری همان پیام کانال
CREATE UNIQUE INDEX IF NOT EXISTS bale_channel_message_buffer_chat_msg_uidx
  ON bale_channel_message_buffer (chat_id, message_id)
  WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bale_channel_sync_state_pending_idx
  ON bale_channel_sync_state (pending_since)
  WHERE pending_since IS NOT NULL;
