-- =====================================================================
-- ISITECH WORLD — Retour arrière du verrouillage (02)
-- À utiliser seulement si le verrouillage cause un problème. Rétablit l'état d'avant la migration 02.
-- =====================================================================
GRANT EXECUTE ON FUNCTION public.ajouter_xp(integer) TO authenticated;

DROP POLICY IF EXISTS "courses insert own" ON public.courses;
CREATE POLICY "courses insert own" ON public.courses FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "courses delete own or admin" ON public.courses;
DROP POLICY IF EXISTS "courses delete own" ON public.courses;
CREATE POLICY "courses delete own" ON public.courses FOR DELETE TO authenticated USING (auth.uid() = author_id);

INSERT INTO public.config VALUES ('verrou', 'false') ON CONFLICT (cle) DO UPDATE SET valeur = 'false';
