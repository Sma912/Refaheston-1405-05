-- Add non-registry iPhone category (safe to re-run)
INSERT INTO categories (name, slug)
VALUES ('آیفون بدون رجیستری', 'iphone-noreg')
ON CONFLICT (slug) DO NOTHING;
