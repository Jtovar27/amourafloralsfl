-- Amoura Florals — Admin Tables Migration
-- Run in Supabase SQL Editor AFTER the base schema.sql
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT DO NOTHING

-- ── Products ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        UNIQUE NOT NULL,
  description TEXT,
  price       INTEGER     NOT NULL CHECK (price > 0),  -- cents
  category    TEXT        NOT NULL CHECK (category IN ('bouquets','floral-boxes','balloons','gifts')),
  image_url   TEXT,
  featured    BOOLEAN     NOT NULL DEFAULT false,
  active      BOOLEAN     NOT NULL DEFAULT true,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── FAQs ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS faqs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question    TEXT        NOT NULL,
  answer      TEXT        NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Testimonials ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS testimonials (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name  TEXT        NOT NULL,
  author_label TEXT,
  content      TEXT        NOT NULL,
  rating       INTEGER     NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  active       BOOLEAN     NOT NULL DEFAULT true,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Site content key-value store ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_content (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL DEFAULT '',
  label      TEXT        NOT NULL,
  section    TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── User profiles (role management) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  full_name  TEXT,
  role       TEXT        NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Orders: add internal_notes column ────────────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- ── Auto-update triggers ──────────────────────────────────────────────────────
-- update_updated_at() already defined in schema.sql — safe to re-run:
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS site_content_updated_at ON site_content;
CREATE TRIGGER site_content_updated_at
  BEFORE UPDATE ON site_content FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Auto-create profile on new user ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'viewer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_active     ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sort       ON products(sort_order);
CREATE INDEX IF NOT EXISTS idx_faqs_active         ON faqs(active);
CREATE INDEX IF NOT EXISTS idx_faqs_sort           ON faqs(sort_order);
CREATE INDEX IF NOT EXISTS idx_testimonials_active ON testimonials(active);
CREATE INDEX IF NOT EXISTS idx_testimonials_sort   ON testimonials(sort_order);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials  ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Public READ for website (service role key bypasses all RLS — these cover anon key)
DROP POLICY IF EXISTS "public_read_products"     ON products;
DROP POLICY IF EXISTS "public_read_faqs"         ON faqs;
DROP POLICY IF EXISTS "public_read_testimonials" ON testimonials;
DROP POLICY IF EXISTS "public_read_site_content" ON site_content;
DROP POLICY IF EXISTS "users_read_own_profile"   ON user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;

CREATE POLICY "public_read_products"
  ON products FOR SELECT USING (active = true);

CREATE POLICY "public_read_faqs"
  ON faqs FOR SELECT USING (active = true);

CREATE POLICY "public_read_testimonials"
  ON testimonials FOR SELECT USING (active = true);

CREATE POLICY "public_read_site_content"
  ON site_content FOR SELECT USING (true);

CREATE POLICY "users_read_own_profile"
  ON user_profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own_profile"
  ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- ── Seed: Site Content ────────────────────────────────────────────────────────
INSERT INTO site_content (key, value, label, section) VALUES
  ('announcement_active',  'true',                                                             'Announcement Bar Visible',  'announcement'),
  ('announcement_text_en', 'Now Taking Orders for Mother''s Day — May 10',                    'Announcement Text (English)','announcement'),
  ('announcement_text_es', 'Tomando Órdenes para el Día de las Madres — 10 de Mayo',          'Announcement Text (Spanish)','announcement'),
  ('hero_title_line1',     'Where Every',                                                     'Hero Title Line 1',          'hero'),
  ('hero_title_line2',     'Petal Tells',                                                     'Hero Title Line 2 (italic)', 'hero'),
  ('hero_title_line3',     'Your Story',                                                      'Hero Title Line 3',          'hero'),
  ('hero_subtitle',        'Handcrafted arrangements for weddings, events & everyday moments of beauty', 'Hero Subtitle', 'hero'),
  ('footer_tagline',       'Handcrafted floral arrangements in Orlando, Florida, made with love.','Footer Tagline',           'footer'),
  ('footer_hours',         'Mon - Fri: 8:30am - 6:30pm | Sat: Available by pre-order only. | Sun: 9:00am - 5:00pm | Orlando, Florida','Business Hours','footer'),
  ('contact_email',        'amourafloralsco@gmail.com',                                       'Contact Email',              'contact'),
  ('whatsapp_number',      '13212959217',                                                     'WhatsApp Number',            'contact'),
  ('instagram_url',        'https://www.instagram.com/amourafloralsfl',                       'Instagram URL',              'social'),
  ('tiktok_url',           'https://www.tiktok.com/@amourafloralsfl',                         'TikTok URL',                 'social'),
  ('facebook_url',         'https://www.facebook.com/amourafloralsfl',                        'Facebook URL',               'social')
ON CONFLICT (key) DO NOTHING;

-- ── Seed: FAQs ────────────────────────────────────────────────────────────────
INSERT INTO faqs (question, answer, sort_order) VALUES
  ('Do you offer same-day or next-day delivery?','We do our best to accommodate same-day and next-day orders in the Orlando, Florida area, depending on availability. For guaranteed delivery, we recommend placing your order at least 48 hours in advance. Reach out to us on Instagram or via email for urgent requests and we''ll do everything we can to make it happen.',1),
  ('How do I place a custom order?','For custom arrangements, the best way to reach us is through a DM on Instagram @amourafloralsfl or by sending us an email with your inspiration photos, color preferences, budget, and occasion date. We love collaborating and will work closely with you to bring your vision to life.',2),
  ('What areas do you serve?','We are based in Orlando, Florida and primarily serve the Orlando and Central Florida area. For weddings and large events outside of these areas, please get in touch directly — we may be able to accommodate travel depending on the scope of the event.',3),
  ('Do you do wedding florals and events?','Absolutely — weddings are one of our specialties and a true passion. We offer full floral packages including bridal bouquets, bridesmaid bouquets, boutonnieres, ceremony arches, reception centerpieces, and more. We encourage you to reach out at least 3–6 months before your event date to secure your booking.',4),
  ('What is your cancellation or refund policy?','Because our arrangements are made fresh and to order, we are unable to offer refunds once an order has been prepared. Cancellations must be made at least 48 hours before the scheduled delivery or pickup time. For wedding/event bookings, deposits are non-refundable but may be applied to a rescheduled date within 6 months.',5),
  ('Can I pick up my order instead of having it delivered?','Yes! Local pickup is available and actually a great option to ensure your blooms arrive in perfect condition. Pickup location and window will be coordinated directly after your order is confirmed. We''ll have everything beautifully wrapped and ready for you.',6),
  ('How far in advance should I order for a special occasion?','For everyday arrangements and gifts, 48 hours'' notice is ideal. For birthdays, anniversaries, or small events, we recommend at least 3–5 days. For weddings and large events, please book 3–6 months in advance to ensure availability and enough time to plan all the details together.',7),
  ('Do you offer vase or vessel options for arrangements?','Yes! We offer arrangements in a variety of vessels — vases, compotes, low bowls, and wraps depending on the occasion. When placing a custom order, just let us know your preference and we''ll find the perfect vessel to complement the florals.',8)
ON CONFLICT DO NOTHING;

-- ── Seed: Testimonials ────────────────────────────────────────────────────────
INSERT INTO testimonials (author_name, author_label, content, rating, sort_order) VALUES
  ('Valentina R.','Bride',         'The bridal bouquet Amoura created for my wedding day was absolutely breathtaking. Every single guest asked who did my florals. I could not have imagined a more perfect arrangement.',5,1),
  ('Maria G.',   'Orlando, FL',   'I ordered a birthday arrangement for my mom and she literally cried. The colors, the freshness, the packaging — everything was perfect. Amoura is my go-to for every occasion now.',5,2),
  ('Diana M.',   'Event Planner', 'Our event centerpieces were beyond what we could have hoped for. Amoura understood our vision immediately and elevated it. Professional, talented, and truly passionate about their craft.',5,3)
ON CONFLICT DO NOTHING;

-- ── Seed: Products ────────────────────────────────────────────────────────────
INSERT INTO products (name, slug, description, price, category, image_url, featured, sort_order) VALUES
  ('Blushing Bride Bridal Bouquet','blushing-bride-bridal-bouquet','A stunning bridal bouquet crafted with premium blooms for your most special day.',24500,'bouquets','assets/images/bridal-bouquet.jpg',true,1),
  ('Garden Romance Bouquet','garden-romance-bouquet','A lush, romantic arrangement inspired by an English garden in full bloom.',8500,'bouquets','https://images.unsplash.com/photo-1561181286-d3f8d8aa7d73?auto=format&fit=crop&w=600&q=85',false,2),
  ('Sage & Bloom Floral Box','sage-bloom-floral-box','An elegant floral box blending sage greens and soft blooms for a sophisticated look.',15500,'floral-boxes','https://images.unsplash.com/photo-1523693916253-7a76c6a3e0e2?auto=format&fit=crop&w=600&q=85',false,3),
  ('Peach Petal Dreams','peach-petal-dreams','Soft peach tones and delicate petals come together in this dreamy arrangement.',7500,'bouquets','https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&w=600&q=85',false,4),
  ('Rose Garden Luxury Box','rose-garden-luxury-box','A luxurious floral box overflowing with garden roses and premium accents.',18500,'floral-boxes','https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=600&q=85',true,5),
  ('Celebration Balloon Bouquet','celebration-balloon-bouquet','A festive balloon bouquet perfect for birthdays, graduations, and celebrations.',5500,'balloons','https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=600&q=85',false,6),
  ('Floral & Balloon Bundle','floral-balloon-bundle','The best of both worlds — fresh florals paired with statement balloons.',9500,'balloons','https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=600&q=85',false,7),
  ('Sun-Kissed Wrapped Blooms','sun-kissed-wrapped-blooms','A warm, sunny wrapped arrangement perfect as a thoughtful gift.',6500,'gifts','https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?auto=format&fit=crop&w=600&q=85',false,8),
  ('Lush Greenery Floral Box','lush-greenery-floral-box','Rich greenery paired with fresh florals for a natural, organic aesthetic.',12000,'floral-boxes','https://images.unsplash.com/photo-1468327768560-75b778cbb551?auto=format&fit=crop&w=600&q=85',false,9),
  ('Wildflower Love Bundle','wildflower-love-bundle','A free-spirited wildflower bundle that captures the beauty of nature.',9500,'gifts','https://images.unsplash.com/photo-1453906971074-ce568cccbc63?auto=format&fit=crop&w=600&q=85',false,10)
ON CONFLICT (slug) DO NOTHING;
