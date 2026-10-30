ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS apparence jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS titre text NOT NULL DEFAULT 'Recrue';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS niveau integer NOT NULL DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS personnage_cree boolean NOT NULL DEFAULT false;
REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (pseudo, bio, apparence, titre, personnage_cree, updated_at) ON public.profiles TO authenticated;