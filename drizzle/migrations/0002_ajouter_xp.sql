CREATE OR REPLACE FUNCTION public.ajouter_xp(montant integer)
RETURNS TABLE(xp integer, niveau integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m integer := greatest(0, least(coalesce(montant,0), 50));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'non connecté'; END IF;
  RETURN QUERY UPDATE public.profiles p
    SET xp = p.xp + m, niveau = 1 + (p.xp + m) / 100, updated_at = now()
    WHERE p.id = auth.uid() RETURNING p.xp, p.niveau;
END $$;
REVOKE ALL ON FUNCTION public.ajouter_xp(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ajouter_xp(integer) TO authenticated;