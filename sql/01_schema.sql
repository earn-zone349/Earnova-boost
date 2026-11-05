-- =====================================================================
--  BOOST SITE  —  database setup (run ONCE in the NEW Supabase project)
--  Supabase -> SQL Editor -> paste this whole file -> Run.
--  Safe to run again (it re-creates functions/policies, keeps your data).
--
--  Money is in BDT (taka).  Everything that touches money happens in
--  server functions below — the website can never set a price or a balance.
-- =====================================================================


-- ───────────────────────── 1. TABLES ─────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  full_name   text        NOT NULL DEFAULT '',
  phone       text        NOT NULL DEFAULT '',
  balance     numeric(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  is_admin    boolean     NOT NULL DEFAULT false,
  banned      boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.services (
  id             int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  platform       text NOT NULL CHECK (platform IN ('facebook','youtube','tiktok','instagram')),
  name           text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  description    text NOT NULL DEFAULT '' CHECK (char_length(description) <= 400),
  price_per_1000 numeric(12,2) NOT NULL CHECK (price_per_1000 >= 0),
  min_qty        int  NOT NULL CHECK (min_qty > 0),
  max_qty        int  NOT NULL CHECK (max_qty >= min_qty),
  active         boolean NOT NULL DEFAULT true,
  sort_order     int  NOT NULL DEFAULT 100,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES public.profiles(id),
  service_id    int  NOT NULL REFERENCES public.services(id),
  service_name  text NOT NULL,                       -- copy at order time (history stays correct)
  platform      text NOT NULL,
  link          text NOT NULL,
  quantity      int  NOT NULL CHECK (quantity > 0),
  price         numeric(12,2) NOT NULL CHECK (price >= 0),
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','processing','completed','partial','cancelled')),
  start_count   int,
  delivered     int  NOT NULL DEFAULT 0 CHECK (delivered >= 0),
  refunded      numeric(12,2) NOT NULL DEFAULT 0,
  admin_note    text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (delivered <= quantity)
);
CREATE INDEX IF NOT EXISTS orders_user_idx   ON public.orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.deposits (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES public.profiles(id),
  method      text NOT NULL,
  amount      numeric(12,2) NOT NULL CHECK (amount > 0),
  trx_id      text NOT NULL,
  sender      text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note  text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
-- the same transaction id can never be credited twice
CREATE UNIQUE INDEX IF NOT EXISTS deposits_trx_uniq
  ON public.deposits (method, trx_id) WHERE status IN ('pending','approved');
CREATE INDEX IF NOT EXISTS deposits_user_idx   ON public.deposits (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS deposits_status_idx ON public.deposits (status, created_at DESC);

-- every taka that moves is written here (cannot be edited from the website)
CREATE TABLE IF NOT EXISTS public.wallet_txns (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES public.profiles(id),
  kind          text NOT NULL CHECK (kind IN ('deposit','order','refund','adjust')),
  amount        numeric(12,2) NOT NULL,             -- + adds money, - takes money
  balance_after numeric(14,2) NOT NULL,
  ref_id        bigint,
  note          text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS txns_user_idx ON public.wallet_txns (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);


-- ───────────────────────── 2. HELPERS ─────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE((SELECT p.is_admin AND NOT p.banned FROM public.profiles p WHERE p.id = auth.uid()), false)
$$;

-- new login  ->  profile row (balance always starts at 0, never admin)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    left(btrim(COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')), 80),
    left(regexp_replace(COALESCE(NEW.raw_user_meta_data ->> 'phone', ''), '[^0-9+]', '', 'g'), 20)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ───────────────────────── 3. USER FUNCTIONS ─────────────────────────

-- place an order: price is calculated HERE, balance is taken HERE
CREATE OR REPLACE FUNCTION public.create_order(p_service int, p_link text, p_qty int)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_p     public.profiles%ROWTYPE;
  v_s     public.services%ROWTYPE;
  v_link  text := btrim(COALESCE(p_link, ''));
  v_price numeric(12,2);
  v_bal   numeric(14,2);
  v_id    bigint;
  v_re    text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'LOGIN_REQUIRED'; END IF;

  SELECT * INTO v_p FROM public.profiles WHERE id = v_uid FOR UPDATE;   -- locks the wallet row
  IF NOT FOUND OR v_p.banned THEN RAISE EXCEPTION 'ACCOUNT_BLOCKED'; END IF;

  SELECT * INTO v_s FROM public.services WHERE id = p_service AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'SERVICE_UNAVAILABLE'; END IF;

  IF p_qty IS NULL OR p_qty < v_s.min_qty OR p_qty > v_s.max_qty THEN
    RAISE EXCEPTION 'BAD_QUANTITY';
  END IF;

  -- link: https only, no spaces, and it must belong to the chosen platform
  IF char_length(v_link) < 12 OR char_length(v_link) > 300 OR v_link ~ '\s' THEN
    RAISE EXCEPTION 'BAD_LINK';
  END IF;
  v_re := CASE v_s.platform
    WHEN 'facebook'  THEN '^https://([a-z0-9-]+\.)*(facebook\.com|fb\.com|fb\.watch|fb\.me)(/|\?|$)'
    WHEN 'youtube'   THEN '^https://([a-z0-9-]+\.)*(youtube\.com|youtu\.be)(/|\?|$)'
    WHEN 'tiktok'    THEN '^https://([a-z0-9-]+\.)*tiktok\.com(/|\?|$)'
    WHEN 'instagram' THEN '^https://([a-z0-9-]+\.)*(instagram\.com|instagr\.am)(/|\?|$)'
  END;
  IF lower(v_link) !~ v_re THEN RAISE EXCEPTION 'BAD_LINK'; END IF;

  -- slow down bots
  IF (SELECT count(*) FROM public.orders WHERE user_id = v_uid AND created_at > now() - interval '1 minute') >= 5 THEN
    RAISE EXCEPTION 'TOO_FAST';
  END IF;
  -- one running order per service + link
  IF EXISTS (SELECT 1 FROM public.orders
              WHERE user_id = v_uid AND service_id = v_s.id AND lower(link) = lower(v_link)
                AND status IN ('pending','processing')) THEN
    RAISE EXCEPTION 'DUPLICATE_ORDER';
  END IF;

  v_price := round(v_s.price_per_1000 * p_qty / 1000.0, 2);
  IF v_price <= 0 THEN RAISE EXCEPTION 'BAD_PRICE'; END IF;
  IF v_p.balance < v_price THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;

  UPDATE public.profiles SET balance = balance - v_price WHERE id = v_uid RETURNING balance INTO v_bal;

  INSERT INTO public.orders (user_id, service_id, service_name, platform, link, quantity, price)
  VALUES (v_uid, v_s.id, v_s.name, v_s.platform, v_link, p_qty, v_price)
  RETURNING id INTO v_id;

  INSERT INTO public.wallet_txns (user_id, kind, amount, balance_after, ref_id, note)
  VALUES (v_uid, 'order', -v_price, v_bal, v_id, v_s.name || ' x ' || p_qty);

  RETURN v_id;
END $$;


-- tell us you sent money (admin checks it and approves)
CREATE OR REPLACE FUNCTION public.submit_deposit(p_method text, p_amount numeric, p_trx text, p_sender text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_p    public.profiles%ROWTYPE;
  v_trx  text := upper(btrim(COALESCE(p_trx, '')));
  v_snd  text := regexp_replace(COALESCE(p_sender, ''), '[^0-9+]', '', 'g');
  v_min  numeric := 50;
  v_id   bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'LOGIN_REQUIRED'; END IF;
  SELECT * INTO v_p FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND OR v_p.banned THEN RAISE EXCEPTION 'ACCOUNT_BLOCKED'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.settings s, jsonb_array_elements(COALESCE(s.value, '[]'::jsonb)) m
     WHERE s.key = 'deposit_methods' AND m ->> 'id' = p_method
       AND COALESCE((m ->> 'active')::boolean, true)
  ) THEN RAISE EXCEPTION 'BAD_METHOD'; END IF;

  BEGIN
    SELECT COALESCE((value #>> '{}')::numeric, 50) INTO v_min FROM public.settings WHERE key = 'min_deposit';
  EXCEPTION WHEN others THEN v_min := 50; END;
  v_min := COALESCE(v_min, 50);

  IF p_amount IS NULL OR p_amount < v_min OR p_amount > 100000 THEN RAISE EXCEPTION 'BAD_AMOUNT'; END IF;
  IF v_trx !~ '^[A-Z0-9]{6,20}$' THEN RAISE EXCEPTION 'BAD_TRX'; END IF;
  IF char_length(v_snd) < 10 OR char_length(v_snd) > 15 THEN RAISE EXCEPTION 'BAD_SENDER'; END IF;

  IF (SELECT count(*) FROM public.deposits WHERE user_id = v_uid AND status = 'pending') >= 5 THEN
    RAISE EXCEPTION 'TOO_MANY_PENDING';
  END IF;

  BEGIN
    INSERT INTO public.deposits (user_id, method, amount, trx_id, sender)
    VALUES (v_uid, p_method, round(p_amount, 2), v_trx, v_snd) RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'TRX_ALREADY_USED';
  END;
  RETURN v_id;
END $$;


CREATE OR REPLACE FUNCTION public.update_my_profile(p_name text, p_phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'LOGIN_REQUIRED'; END IF;
  UPDATE public.profiles
     SET full_name = left(btrim(COALESCE(p_name, '')), 80),
         phone     = left(regexp_replace(COALESCE(p_phone, ''), '[^0-9+]', '', 'g'), 20)
   WHERE id = auth.uid();
END $$;


-- numbers for the front page (anyone can read these; they contain no personal data)
CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'orders_total',     (SELECT count(*) FROM public.orders),
    'orders_active',    (SELECT count(*) FROM public.orders WHERE status IN ('pending','processing')),
    'orders_completed', (SELECT count(*) FROM public.orders WHERE status IN ('completed','partial')),
    'units_delivered',  (SELECT COALESCE(sum(delivered), 0) FROM public.orders)
  )
$$;


-- ───────────────────────── 4. ADMIN FUNCTIONS ─────────────────────────

CREATE OR REPLACE FUNCTION public.admin_review_deposit(p_id bigint, p_approve boolean, p_note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE d public.deposits%ROWTYPE; v_bal numeric(14,2);
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO d FROM public.deposits WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF d.status <> 'pending' THEN RAISE EXCEPTION 'ALREADY_REVIEWED'; END IF;

  IF p_approve THEN
    PERFORM 1 FROM public.profiles WHERE id = d.user_id FOR UPDATE;
    UPDATE public.profiles SET balance = balance + d.amount WHERE id = d.user_id RETURNING balance INTO v_bal;
    INSERT INTO public.wallet_txns (user_id, kind, amount, balance_after, ref_id, note)
    VALUES (d.user_id, 'deposit', d.amount, v_bal, d.id, upper(d.method) || ' ' || d.trx_id);
    UPDATE public.deposits SET status = 'approved', reviewed_at = now(), admin_note = left(COALESCE(p_note,''), 200) WHERE id = d.id;
  ELSE
    UPDATE public.deposits SET status = 'rejected', reviewed_at = now(), admin_note = left(COALESCE(p_note,''), 200) WHERE id = d.id;
  END IF;
END $$;


-- move an order forward; cancelling / partial gives money back automatically
CREATE OR REPLACE FUNCTION public.admin_update_order(
  p_id bigint, p_status text, p_delivered int DEFAULT NULL, p_start int DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE o public.orders%ROWTYPE; v_del int; v_refund numeric(12,2) := 0; v_bal numeric(14,2);
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_status NOT IN ('pending','processing','completed','partial','cancelled') THEN RAISE EXCEPTION 'BAD_STATUS'; END IF;

  SELECT * INTO o FROM public.orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF o.status IN ('completed','partial','cancelled') THEN RAISE EXCEPTION 'ORDER_FINAL'; END IF;

  v_del := COALESCE(p_delivered, o.delivered);
  IF v_del < 0 OR v_del > o.quantity THEN RAISE EXCEPTION 'BAD_DELIVERED'; END IF;

  IF p_status = 'completed' THEN
    v_del := o.quantity;
  ELSIF p_status = 'cancelled' THEN
    v_del := 0;
    v_refund := o.price;
  ELSIF p_status = 'partial' THEN
    IF v_del >= o.quantity THEN RAISE EXCEPTION 'BAD_DELIVERED'; END IF;
    v_refund := round(o.price * (o.quantity - v_del) / o.quantity::numeric, 2);
  END IF;

  IF v_refund > 0 THEN
    PERFORM 1 FROM public.profiles WHERE id = o.user_id FOR UPDATE;
    UPDATE public.profiles SET balance = balance + v_refund WHERE id = o.user_id RETURNING balance INTO v_bal;
    INSERT INTO public.wallet_txns (user_id, kind, amount, balance_after, ref_id, note)
    VALUES (o.user_id, 'refund', v_refund, v_bal, o.id, 'Order #' || o.id || ' ' || p_status);
  END IF;

  UPDATE public.orders
     SET status      = p_status,
         delivered   = v_del,
         start_count = COALESCE(p_start, start_count),
         refunded    = v_refund,
         admin_note  = left(COALESCE(p_note, admin_note), 300),
         updated_at  = now()
   WHERE id = o.id;
END $$;


CREATE OR REPLACE FUNCTION public.admin_adjust_balance(p_user uuid, p_amount numeric, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_bal numeric(14,2);
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_amount IS NULL OR p_amount = 0 OR abs(p_amount) > 1000000 THEN RAISE EXCEPTION 'BAD_AMOUNT'; END IF;
  IF btrim(COALESCE(p_note, '')) = '' THEN RAISE EXCEPTION 'NOTE_REQUIRED'; END IF;
  PERFORM 1 FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  BEGIN
    UPDATE public.profiles SET balance = balance + round(p_amount, 2) WHERE id = p_user RETURNING balance INTO v_bal;
  EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END;
  INSERT INTO public.wallet_txns (user_id, kind, amount, balance_after, note)
  VALUES (p_user, 'adjust', round(p_amount, 2), v_bal, left(p_note, 200));
END $$;


CREATE OR REPLACE FUNCTION public.admin_set_banned(p_user uuid, p_banned boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_user = auth.uid() THEN RAISE EXCEPTION 'CANNOT_BAN_SELF'; END IF;
  UPDATE public.profiles SET banned = p_banned WHERE id = p_user;
END $$;


CREATE OR REPLACE FUNCTION public.admin_dashboard()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN jsonb_build_object(
    'users',            (SELECT count(*) FROM public.profiles),
    'pending_deposits', (SELECT count(*) FROM public.deposits WHERE status = 'pending'),
    'pending_orders',   (SELECT count(*) FROM public.orders   WHERE status = 'pending'),
    'running_orders',   (SELECT count(*) FROM public.orders   WHERE status = 'processing'),
    'deposited_total',  (SELECT COALESCE(sum(amount), 0) FROM public.deposits WHERE status = 'approved'),
    'sales_total',      (SELECT COALESCE(sum(price - refunded), 0) FROM public.orders WHERE status <> 'cancelled'),
    'wallets_total',    (SELECT COALESCE(sum(balance), 0) FROM public.profiles)
  );
END $$;


-- ───────────────────────── 5. SECURITY (who can do what) ─────────────────────────

ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_txns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings    ENABLE ROW LEVEL SECURITY;

-- start from zero rights, then give back only what is needed
REVOKE ALL ON public.profiles, public.services, public.orders, public.deposits,
              public.wallet_txns, public.settings FROM anon, authenticated;

GRANT SELECT ON public.services, public.settings TO anon, authenticated;
GRANT SELECT ON public.profiles, public.orders, public.deposits, public.wallet_txns TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.services, public.settings TO authenticated;   -- admin only (policies below)

DROP POLICY IF EXISTS profiles_read   ON public.profiles;
DROP POLICY IF EXISTS orders_read     ON public.orders;
DROP POLICY IF EXISTS deposits_read   ON public.deposits;
DROP POLICY IF EXISTS txns_read       ON public.wallet_txns;
DROP POLICY IF EXISTS services_read   ON public.services;
DROP POLICY IF EXISTS services_admin  ON public.services;
DROP POLICY IF EXISTS settings_read   ON public.settings;
DROP POLICY IF EXISTS settings_admin  ON public.settings;

CREATE POLICY profiles_read  ON public.profiles    FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY orders_read    ON public.orders      FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY deposits_read  ON public.deposits    FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY txns_read      ON public.wallet_txns FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY services_read  ON public.services FOR SELECT TO anon, authenticated USING (active OR public.is_admin());
CREATE POLICY services_admin ON public.services FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY settings_read  ON public.settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY settings_admin ON public.settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- functions: nobody by default, then only the right people
REVOKE ALL ON FUNCTION public.create_order(int, text, int)                          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_deposit(text, numeric, text, text)             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_my_profile(text, text)                         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_review_deposit(bigint, boolean, text)           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_order(bigint, text, int, int, text)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_adjust_balance(uuid, numeric, text)             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_banned(uuid, boolean)                       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_dashboard()                                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin()                                            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_stats()                                    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user()                                     FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_order(int, text, int)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_deposit(text, numeric, text, text)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_deposit(bigint, boolean, text)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_order(bigint, text, int, int, text)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, numeric, text)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_banned(uuid, boolean)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard()                                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin()                                         TO anon, authenticated;   -- anon needs it for the public services policy (returns false for guests)
GRANT EXECUTE ON FUNCTION public.get_public_stats()                                 TO anon, authenticated;


-- ───────────────────────── 6. STARTING DATA (change later from the admin page) ─────────────────────────

INSERT INTO public.settings (key, value) VALUES
  ('site_name',       to_jsonb('BoostBD'::text)),
  ('notice',          to_jsonb('স্বাগতম! সার্ভিস দেখতে রেজিস্টার লাগবে না, অর্ডার করতে লাগবে।'::text)),
  ('min_deposit',     to_jsonb(50)),
  ('support_link',    to_jsonb(''::text)),
  ('deposit_methods', '[
      {"id":"bkash","name":"bKash","number":"01XXXXXXXXX","note":"Send Money (Personal)","active":true},
      {"id":"nagad","name":"Nagad","number":"01XXXXXXXXX","note":"Send Money (Personal)","active":true}
   ]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- sample prices in taka per 1000 (edit / add / hide from the admin page)
INSERT INTO public.services (platform, name, description, price_per_1000, min_qty, max_qty, sort_order)
SELECT * FROM (VALUES
  ('facebook' , 'Facebook Page Likes',          'পেজ লাইক। প্রোফাইল নয়, শুধু পেজের লিংক দিন।',        180::numeric, 100, 10000, 10),
  ('facebook' , 'Facebook Followers',           'পেজ বা প্রোফাইল ফলোয়ার।',                             180, 100, 10000, 20),
  ('youtube'  , 'YouTube Views',                'ভিডিও ভিউ। ভিডিও পাবলিক থাকতে হবে।',                  300, 500, 100000, 10),
  ('youtube'  , 'YouTube Subscribers',          'চ্যানেল সাবস্ক্রাইবার।',                               1200, 50, 5000, 20),
  ('tiktok'   , 'TikTok Followers',             'প্রোফাইল ফলোয়ার।',                                    240, 100, 10000, 10),
  ('tiktok'   , 'TikTok Views',                 'ভিডিও ভিউ।',                                           18, 1000, 500000, 20),
  ('tiktok'   , 'TikTok Likes',                 'ভিডিও লাইক।',                                          60, 100, 20000, 30),
  ('instagram', 'Instagram Followers',          'প্রোফাইল ফলোয়ার। প্রোফাইল পাবলিক থাকতে হবে।',        240, 100, 10000, 10),
  ('instagram', 'Instagram Likes',              'পোস্ট লাইক।',                                          60, 100, 20000, 20),
  ('instagram', 'Instagram Views',              'রিল/ভিডিও ভিউ।',                                       18, 1000, 500000, 30)
) AS v(platform, name, description, price_per_1000, min_qty, max_qty, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.services);


-- ───────────────────────── 7. AFTER YOU REGISTER ON THE SITE ─────────────────────────
-- Make yourself the admin (run this ONE time, with your own email):
--
--   update public.profiles set is_admin = true where email = 'YOUR_EMAIL_HERE';
--
-- Check:   select email, is_admin, balance from public.profiles;
-- =====================================================================
