INSERT INTO categories (name, slug)
VALUES ('اندروید بدون رجیستری', 'android-noreg')
ON CONFLICT (slug) DO NOTHING;
