-- =====================================================================
-- ISITECH WORLD — Migration 2 : VERROUILLAGE
-- =====================================================================
-- À appliquer SEULEMENT après avoir installé la V6 du jeu ET vérifié que tout fonctionne :
--   gain d'XP (combat, quêtes, dépôt), console admin, rôles.
-- Cette migration FERME les anciennes portes :
--   1) plus personne ne peut s'attribuer de l'XP directement (ancienne fonction ajouter_xp) ;
--   2) seuls les administrateurs peuvent créer l'organisation, les annonces et les catégories ;
--   3) un quiz ne peut être déposé que par l'auteur du cours ou par un administrateur ;
--   4) les administrateurs peuvent supprimer n'importe quel cours (modération).
-- Si quelque chose casse, le retour en arrière est dans 03_retour_arriere.sql.
-- =====================================================================

-- 1) Fin de l'XP « libre »
REVOKE EXECUTE ON FUNCTION public.ajouter_xp(integer) FROM authenticated, PUBLIC, anon;

-- 2) et 3) Qui peut écrire quoi dans la table des cours
DROP POLICY IF EXISTS "courses insert own" ON public.courses;
CREATE POLICY "courses insert own" ON public.courses FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = author_id
  AND (
    type NOT IN ('__organisation__', '__annonce__', '__categorie__', '__quiz__')
    OR public.est_admin()
    OR (type = '__quiz__' AND EXISTS (
          SELECT 1 FROM public.courses c WHERE c.id::text = courses.title AND c.author_id = auth.uid()))
  )
);

-- 4) Modération : un administrateur peut supprimer n'importe quelle ligne
DROP POLICY IF EXISTS "courses delete own" ON public.courses;
DROP POLICY IF EXISTS "courses delete own or admin" ON public.courses;
CREATE POLICY "courses delete own or admin" ON public.courses FOR DELETE TO authenticated
USING (auth.uid() = author_id OR public.est_admin());

-- Le jeu sait ainsi que le verrouillage est actif (affiché dans la console admin)
INSERT INTO public.config VALUES ('verrou', 'true') ON CONFLICT (cle) DO UPDATE SET valeur = 'true';
