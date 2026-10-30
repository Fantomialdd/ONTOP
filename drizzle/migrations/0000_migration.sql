CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pseudo text NOT NULL DEFAULT 'Héros',
  avatar text NOT NULL DEFAULT '🧑‍💻',
  bio text NOT NULL DEFAULT '',
  classe text NOT NULL DEFAULT 'SISR',
  xp integer NOT NULL DEFAULT 0,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  badges text[] NOT NULL DEFAULT '{}',
  streak integer NOT NULL DEFAULT 0,
  last text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, pseudo)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'pseudo',''), NULLIF(NEW.raw_user_meta_data->>'full_name',''), split_part(NEW.email,'@',1), 'Héros'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'Cours',
  text text NOT NULL DEFAULT '',
  npc text NOT NULL DEFAULT '🧙',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courses readable" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "courses insert own" ON public.courses FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "courses update own" ON public.courses FOR UPDATE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "courses delete own" ON public.courses FOR DELETE TO authenticated USING (auth.uid() = author_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.courses;