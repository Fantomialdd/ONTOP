-- =====================================================================
-- ISITECH WORLD — Migration 1 : fondations (rôles, XP sécurisé, quêtes, supervision)
-- =====================================================================
-- Cette migration AJOUTE des tables et des fonctions. Elle ne supprime et ne modifie rien d'existant :
-- le jeu continue de fonctionner pendant et après son application. Elle peut être rejouée sans risque.
--
-- AVANT de l'exécuter : remplace 'Leo Dupire' (tout en bas) par le pseudo EXACT du premier administrateur.
-- =====================================================================

-- ---------- Utilitaires ----------
CREATE TABLE IF NOT EXISTS public.config (cle text PRIMARY KEY, valeur text NOT NULL);
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "config lisible" ON public.config;
CREATE POLICY "config lisible" ON public.config FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.config TO authenticated;
GRANT ALL ON public.config TO service_role;
INSERT INTO public.config VALUES ('version', '6') ON CONFLICT (cle) DO UPDATE SET valeur = excluded.valeur;

CREATE OR REPLACE FUNCTION public._aujourdhui() RETURNS date LANGUAGE sql STABLE AS $$
  SELECT (now() AT TIME ZONE 'Europe/Paris')::date
$$;
CREATE OR REPLACE FUNCTION public._debut_jour() RETURNS timestamptz LANGUAGE sql STABLE AS $$
  SELECT public._aujourdhui()::timestamp AT TIME ZONE 'Europe/Paris'
$$;

-- ---------- 1) Rôles ----------
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles lisibles" ON public.user_roles;
-- Tout le monde peut savoir QUI est admin (le jeu doit savoir à qui faire confiance) ; personne ne peut écrire directement.
CREATE POLICY "roles lisibles" ON public.user_roles FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

CREATE OR REPLACE FUNCTION public.est_admin(p_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role = 'admin')
$$;

CREATE TABLE IF NOT EXISTS public.journal_admin (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  action text NOT NULL,
  cible text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.journal_admin ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "journal admin lisible" ON public.journal_admin;
CREATE POLICY "journal admin lisible" ON public.journal_admin FOR SELECT TO authenticated USING (public.est_admin());
GRANT SELECT ON public.journal_admin TO authenticated;
GRANT ALL ON public.journal_admin TO service_role;

CREATE OR REPLACE FUNCTION public.definir_role(p_user uuid, p_admin boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.est_admin() THEN RAISE EXCEPTION 'accès refusé'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user) THEN RAISE EXCEPTION 'utilisateur inconnu'; END IF;
  IF p_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (p_user, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    IF (SELECT count(*) FROM public.user_roles WHERE role = 'admin') <= 1 AND public.est_admin(p_user) THEN
      RAISE EXCEPTION 'impossible de retirer le dernier administrateur';
    END IF;
    DELETE FROM public.user_roles WHERE user_id = p_user AND role = 'admin';
  END IF;
  INSERT INTO public.journal_admin (user_id, action, cible)
  VALUES (auth.uid(), CASE WHEN p_admin THEN 'ajout admin' ELSE 'retrait admin' END, p_user::text);
END $$;

CREATE OR REPLACE FUNCTION public.liste_utilisateurs()
RETURNS TABLE (id uuid, pseudo text, niveau integer, xp integer, admin boolean, maj timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.est_admin() THEN RAISE EXCEPTION 'accès refusé'; END IF;
  RETURN QUERY SELECT p.id, p.pseudo, p.niveau, p.xp, public.est_admin(p.id), p.updated_at
               FROM public.profiles p ORDER BY p.xp DESC, p.pseudo;
END $$;

-- ---------- 2) XP : journal et attribution contrôlée ----------
CREATE TABLE IF NOT EXISTS public.xp_log (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  raison text NOT NULL,
  ref text NOT NULL DEFAULT '',
  montant integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS xp_log_ref_unique ON public.xp_log (user_id, raison, ref) WHERE ref <> '';
CREATE INDEX IF NOT EXISTS xp_log_user_date ON public.xp_log (user_id, created_at);
ALTER TABLE public.xp_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "xp_log lisible" ON public.xp_log;
CREATE POLICY "xp_log lisible" ON public.xp_log FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.est_admin());
GRANT SELECT ON public.xp_log TO authenticated;
GRANT ALL ON public.xp_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.xp_log_id_seq TO service_role;

-- Fonction INTERNE (non appelable par les joueurs) : plafond de 400 XP par jour, une seule fois par référence.
CREATE OR REPLACE FUNCTION public._accorder_xp(p_user uuid, p_raison text, p_ref text, p_montant integer, p_cap_raison integer DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total integer; v_raison integer; v_ok integer;
BEGIN
  IF p_montant IS NULL OR p_montant <= 0 THEN RETURN 0; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_user::text));
  IF p_ref <> '' AND EXISTS (SELECT 1 FROM public.xp_log WHERE user_id = p_user AND raison = p_raison AND ref = p_ref) THEN RETURN 0; END IF;
  SELECT coalesce(sum(montant), 0) INTO v_total FROM public.xp_log WHERE user_id = p_user AND created_at >= public._debut_jour();
  v_ok := least(p_montant, 400 - v_total);
  IF p_cap_raison IS NOT NULL THEN
    SELECT coalesce(sum(montant), 0) INTO v_raison FROM public.xp_log WHERE user_id = p_user AND raison = p_raison AND created_at >= public._debut_jour();
    v_ok := least(v_ok, p_cap_raison - v_raison);
  END IF;
  IF v_ok <= 0 THEN RETURN 0; END IF;
  INSERT INTO public.xp_log (user_id, raison, ref, montant) VALUES (p_user, p_raison, p_ref, v_ok);
  UPDATE public.profiles SET xp = xp + v_ok, niveau = 1 + (xp + v_ok) / 100, updated_at = now() WHERE id = p_user;
  RETURN v_ok;
END $$;
REVOKE ALL ON FUNCTION public._accorder_xp(uuid, text, text, integer, integer) FROM PUBLIC, anon, authenticated;

-- ---------- 3) Progression : quêtes du jour, badges, série ----------
CREATE TABLE IF NOT EXISTS public.progression (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  jour date NOT NULL DEFAULT '1970-01-01',
  faites text[] NOT NULL DEFAULT '{}',
  visites text[] NOT NULL DEFAULT '{}',
  toutes text[] NOT NULL DEFAULT '{}',
  badges text[] NOT NULL DEFAULT '{}',
  serie integer NOT NULL DEFAULT 0,
  defi_jour date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.progression ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "progression lisible" ON public.progression;
CREATE POLICY "progression lisible" ON public.progression FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.est_admin());
GRANT SELECT ON public.progression TO authenticated;
GRANT ALL ON public.progression TO service_role;

CREATE OR REPLACE FUNCTION public._prog(p_user uuid) RETURNS public.progression
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.progression; j date := public._aujourdhui();
BEGIN
  INSERT INTO public.progression (user_id) VALUES (p_user) ON CONFLICT DO NOTHING;
  SELECT * INTO r FROM public.progression WHERE user_id = p_user FOR UPDATE;
  IF r.jour <> j THEN
    UPDATE public.progression
       SET serie = CASE WHEN r.jour = j - 1 THEN r.serie + 1 ELSE 1 END, jour = j, faites = '{}', visites = '{}', updated_at = now()
     WHERE user_id = p_user RETURNING * INTO r;
    IF r.serie >= 3 AND NOT ('fidele' = ANY (r.badges)) THEN
      UPDATE public.progression SET badges = array_append(badges, 'fidele') WHERE user_id = p_user RETURNING * INTO r;
    END IF;
  END IF;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public._prog(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._prog_json(r public.progression) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('jour', r.jour, 'faites', to_jsonb(r.faites), 'visites', to_jsonb(r.visites),
                            'toutes', to_jsonb(r.toutes), 'badges', to_jsonb(r.badges), 'serie', r.serie)
$$;
REVOKE ALL ON FUNCTION public._prog_json(public.progression) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._xp_quete(p_id text) RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_id WHEN 'reseau' THEN 10 WHEN 'quiz' THEN 15 WHEN 'monstre' THEN 15 WHEN 'explorer' THEN 10 ELSE 0 END
$$;
REVOKE ALL ON FUNCTION public._xp_quete(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._donner_quete(p_user uuid, p_id text) RETURNS TABLE (gain integer, fait boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.progression;
BEGIN
  IF public._xp_quete(p_id) = 0 THEN RAISE EXCEPTION 'quête inconnue'; END IF;
  r := public._prog(p_user);
  IF p_id = ANY (r.faites) THEN RETURN QUERY SELECT 0, false; RETURN; END IF;
  UPDATE public.progression SET faites = array_append(faites, p_id), updated_at = now() WHERE user_id = p_user;
  RETURN QUERY SELECT public._accorder_xp(p_user, 'quete:' || p_id, public._aujourdhui()::text, public._xp_quete(p_id)), true;
END $$;
REVOKE ALL ON FUNCTION public._donner_quete(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._donner_badge(p_user uuid, p_id text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.progression;
BEGIN
  r := public._prog(p_user);
  IF p_id = ANY (r.badges) THEN RETURN false; END IF;
  UPDATE public.progression SET badges = array_append(badges, p_id), updated_at = now() WHERE user_id = p_user;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public._donner_badge(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._reponse(p_user uuid, p_xp integer, p_quetes text[], p_badges text[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.progression; v_total integer; v_niveau integer;
BEGIN
  r := public._prog(p_user);
  SELECT pr.xp, pr.niveau INTO v_total, v_niveau FROM public.profiles pr WHERE pr.id = p_user;
  RETURN jsonb_build_object('prog', public._prog_json(r), 'xp_total', v_total, 'niveau', v_niveau,
                            'gains', jsonb_build_object('xp', p_xp, 'quetes', to_jsonb(p_quetes), 'badges', to_jsonb(p_badges)));
END $$;
REVOKE ALL ON FUNCTION public._reponse(uuid, integer, text[], text[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ouvrir_jour() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'non connecté'; END IF;
  RETURN public._reponse(auth.uid(), 0, '{}', '{}');
END $$;

CREATE OR REPLACE FUNCTION public.evenement_jeu(p_ev text, p_data jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  u uuid := auth.uid(); r public.progression; v_xp integer := 0; v_quetes text[] := '{}'; v_badges text[] := '{}';
  q record; c public.courses; v_salle text; v_cours uuid;
  v_salles text[] := ARRAY['direction','commerce','cafe','soleil','wc','serveurs','developpeur','referent','labo',
                           'jupiter','pedagogie','venus','lune','mercure','saturne','terre','uranus','mars'];
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'non connecté'; END IF;
  r := public._prog(u);
  IF p_ev = 'reseau' THEN
    SELECT * INTO q FROM public._donner_quete(u, 'reseau');
    IF q.fait THEN v_xp := v_xp + q.gain; v_quetes := array_append(v_quetes, 'reseau'); END IF;
  ELSIF p_ev = 'depot' THEN
    BEGIN v_cours := (p_data->>'cours')::uuid; EXCEPTION WHEN others THEN RAISE EXCEPTION 'dépôt introuvable'; END;
    SELECT * INTO c FROM public.courses WHERE id = v_cours;
    IF NOT FOUND OR c.author_id <> u OR left(c.type, 2) = '__' OR c.created_at < now() - interval '15 minutes' THEN
      RAISE EXCEPTION 'dépôt introuvable';
    END IF;
    v_xp := v_xp + public._accorder_xp(u, 'depot', c.id::text, 10);
    IF public._donner_badge(u, 'depot') THEN v_badges := array_append(v_badges, 'depot'); END IF;
  ELSIF p_ev = 'visite' THEN
    v_salle := p_data->>'salle';
    IF v_salle IS NULL OR NOT (v_salle = ANY (v_salles)) THEN RAISE EXCEPTION 'salle inconnue'; END IF;
    UPDATE public.progression
       SET visites = CASE WHEN v_salle = ANY (visites) THEN visites ELSE array_append(visites, v_salle) END,
           toutes  = CASE WHEN v_salle = ANY (toutes)  THEN toutes  ELSE array_append(toutes,  v_salle) END,
           updated_at = now()
     WHERE user_id = u RETURNING * INTO r;
    IF cardinality(r.visites) >= 3 THEN
      SELECT * INTO q FROM public._donner_quete(u, 'explorer');
      IF q.fait THEN v_xp := v_xp + q.gain; v_quetes := array_append(v_quetes, 'explorer'); END IF;
    END IF;
    IF cardinality(r.toutes) >= 10 AND public._donner_badge(u, 'explorateur') THEN v_badges := array_append(v_badges, 'explorateur'); END IF;
  ELSE
    RAISE EXCEPTION 'événement inconnu';
  END IF;
  RETURN public._reponse(u, v_xp, v_quetes, v_badges);
END $$;

-- ---------- 4) Combats : session côté serveur + contrôle de vraisemblance ----------
CREATE TABLE IF NOT EXISTS public.combats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  difficulte text NOT NULL CHECK (difficulte IN ('facile', 'normal', 'difficile', 'cauchemar')),
  total integer NOT NULL CHECK (total BETWEEN 3 AND 15),
  defi boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  fini_at timestamptz,
  xp integer,
  resume jsonb
);
CREATE INDEX IF NOT EXISTS combats_user_date ON public.combats (user_id, created_at);
ALTER TABLE public.combats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "combats lisibles" ON public.combats;
CREATE POLICY "combats lisibles" ON public.combats FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.est_admin());
GRANT SELECT ON public.combats TO authenticated;
GRANT ALL ON public.combats TO service_role;

-- Même formule que le jeu (src/game/combat.ts, calculerXp). Un test automatique vérifie qu'elles donnent le même résultat.
CREATE OR REPLACE FUNCTION public.calcul_xp_combat(p_diff text, p_fin text, p_bonnes integer, p_mauvaises integer, p_combo integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  -- Même calcul que src/game/combat.ts (calculerXp) : entiers × 10 000, un seul arrondi à la fin.
  WITH d AS (
    SELECT CASE p_diff WHEN 'facile' THEN 15 WHEN 'normal' THEN 25 WHEN 'difficile' THEN 40 WHEN 'cauchemar' THEN 50 ELSE 0 END::bigint AS base,
           CASE WHEN p_bonnes + p_mauvaises = 0 THEN 0::bigint
                ELSE floor((p_bonnes::bigint * 10000) / (p_bonnes + p_mauvaises)) END AS pmille
  )
  SELECT CASE WHEN p_fin = 'victoire'
              THEN least(50, floor((base * (6000 + (4 * pmille) / 10) + least(10, p_combo * 2)::bigint * 10000 + 5000) / 10000)::integer)
              ELSE least(50, floor((base * (CASE WHEN p_fin = 'epuise' THEN 3000 ELSE 2000 END) * pmille + 50000000) / 100000000)::integer) END
  FROM d
$$;

CREATE OR REPLACE FUNCTION public.demarrer_combat(p_difficulte text, p_total integer, p_defi boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := auth.uid(); v_dernier timestamptz; v_jour integer; v_ouverts integer; r public.progression; v_id uuid;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'non connecté'; END IF;
  IF p_difficulte NOT IN ('facile', 'normal', 'difficile', 'cauchemar') THEN RAISE EXCEPTION 'difficulté invalide'; END IF;
  IF p_total IS NULL OR p_total < 3 OR p_total > 15 THEN RAISE EXCEPTION 'nombre de questions invalide'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(u::text));
  UPDATE public.combats SET fini_at = now(), xp = 0 WHERE user_id = u AND fini_at IS NULL AND created_at < now() - interval '30 minutes';
  SELECT max(created_at), count(*) FILTER (WHERE created_at >= public._debut_jour()) INTO v_dernier, v_jour FROM public.combats WHERE user_id = u;
  IF v_dernier IS NOT NULL AND v_dernier > now() - interval '8 seconds' THEN RAISE EXCEPTION 'trop vite, attends quelques secondes'; END IF;
  IF v_jour >= 40 THEN RAISE EXCEPTION 'limite de combats atteinte pour aujourd''hui'; END IF;
  SELECT count(*) INTO v_ouverts FROM public.combats WHERE user_id = u AND fini_at IS NULL;
  IF v_ouverts >= 8 THEN RAISE EXCEPTION 'trop de combats en cours'; END IF;
  IF p_defi THEN
    r := public._prog(u);
    IF r.defi_jour = public._aujourdhui() THEN RAISE EXCEPTION 'défi du jour déjà fait'; END IF;
  END IF;
  INSERT INTO public.combats (user_id, difficulte, total, defi) VALUES (u, p_difficulte, p_total, coalesce(p_defi, false)) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.terminer_combat(p_id uuid, p_resume jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  u uuid := auth.uid(); s public.combats; v_b integer; v_m integer; v_c integer; v_fin text;
  v_pvq integer; v_calc integer := 0; v_gain integer := 0; v_xp_q integer := 0; v_quetes text[] := '{}'; v_badges text[] := '{}'; q record;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'non connecté'; END IF;
  SELECT * INTO s FROM public.combats WHERE id = p_id AND user_id = u FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'combat introuvable'; END IF;
  IF s.fini_at IS NOT NULL THEN RAISE EXCEPTION 'combat déjà terminé'; END IF;
  IF s.created_at < now() - interval '3 hours' THEN RAISE EXCEPTION 'combat expiré'; END IF;
  BEGIN
    v_b := (p_resume->>'bonnes')::integer; v_m := (p_resume->>'mauvaises')::integer;
    v_c := (p_resume->>'combo')::integer; v_fin := p_resume->>'fin';
  EXCEPTION WHEN others THEN RAISE EXCEPTION 'résumé invalide'; END;
  IF v_b IS NULL OR v_m IS NULL OR v_c IS NULL OR v_b < 0 OR v_m < 0 OR v_c < 0 OR v_fin NOT IN ('victoire', 'defaite', 'epuise') THEN
    RAISE EXCEPTION 'résumé invalide';
  END IF;
  v_pvq := CASE s.difficulte WHEN 'facile' THEN 11 WHEN 'normal' THEN 14 WHEN 'difficile' THEN 17 ELSE 20 END;
  -- Vraisemblance : nombre de réponses, enchaînement, temps écoulé (≥ 1 s par réponse), dégâts nécessaires pour gagner (max 43 par coup)
  IF v_b + v_m < 1 OR v_b + v_m > s.total + 2 OR v_c > v_b
     OR extract(epoch FROM now() - s.created_at) < (v_b + v_m) * 1.0
     OR (v_fin = 'victoire' AND v_b < ceil((s.total * v_pvq) / 43.0)) THEN
    UPDATE public.combats SET fini_at = now(), xp = 0, resume = p_resume || '{"rejete":true}'::jsonb WHERE id = s.id;
    RETURN public._reponse(u, 0, '{}', '{}') || '{"rejete":true}'::jsonb;
  END IF;

  v_calc := public.calcul_xp_combat(s.difficulte, v_fin, v_b, v_m, v_c);
  IF s.defi AND v_fin = 'victoire' THEN v_calc := least(50, round(v_calc * 1.5)::integer); END IF;
  v_gain := public._accorder_xp(u, 'combat', s.id::text, v_calc, 300);

  SELECT * INTO q FROM public._donner_quete(u, 'quiz');
  IF q.fait THEN v_xp_q := v_xp_q + q.gain; v_quetes := array_append(v_quetes, 'quiz'); END IF;
  IF public._donner_badge(u, 'quiz') THEN v_badges := array_append(v_badges, 'quiz'); END IF;
  IF v_fin = 'victoire' THEN
    SELECT * INTO q FROM public._donner_quete(u, 'monstre');
    IF q.fait THEN v_xp_q := v_xp_q + q.gain; v_quetes := array_append(v_quetes, 'monstre'); END IF;
    IF public._donner_badge(u, 'chasseur') THEN v_badges := array_append(v_badges, 'chasseur'); END IF;
    IF v_m = 0 AND public._donner_badge(u, 'parfait') THEN v_badges := array_append(v_badges, 'parfait'); END IF;
  END IF;
  IF s.defi THEN UPDATE public.progression SET defi_jour = public._aujourdhui() WHERE user_id = u; END IF;

  UPDATE public.combats SET fini_at = now(), xp = v_gain, resume = p_resume WHERE id = s.id;
  RETURN public._reponse(u, v_xp_q, v_quetes, v_badges) || jsonb_build_object('xp', v_gain, 'calcule', v_calc);
END $$;

-- ---------- 5) Supervision ----------
CREATE TABLE IF NOT EXISTS public.journal_erreurs (
  id bigserial PRIMARY KEY,
  user_id uuid,
  message text NOT NULL,
  contexte jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.journal_erreurs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "erreurs lisibles" ON public.journal_erreurs;
CREATE POLICY "erreurs lisibles" ON public.journal_erreurs FOR SELECT TO authenticated USING (public.est_admin());
GRANT SELECT ON public.journal_erreurs TO authenticated;
GRANT ALL ON public.journal_erreurs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.journal_erreurs_id_seq TO service_role;

CREATE TABLE IF NOT EXISTS public.ia_usage (
  id bigserial PRIMARY KEY,
  user_id uuid,
  ok boolean NOT NULL,
  code text NOT NULL DEFAULT '',
  ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ia_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ia lisible" ON public.ia_usage;
CREATE POLICY "ia lisible" ON public.ia_usage FOR SELECT TO authenticated USING (public.est_admin());
GRANT SELECT ON public.ia_usage TO authenticated;
GRANT ALL ON public.ia_usage TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.ia_usage_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.signaler_erreur(p_message text, p_contexte jsonb DEFAULT '{}'::jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF (SELECT count(*) FROM public.journal_erreurs WHERE user_id = auth.uid() AND created_at > now() - interval '1 hour') >= 10 THEN RETURN; END IF;
  INSERT INTO public.journal_erreurs (user_id, message, contexte)
  VALUES (auth.uid(), left(coalesce(p_message, ''), 500), CASE WHEN length(coalesce(p_contexte::text, '')) > 2000 THEN '{}'::jsonb ELSE coalesce(p_contexte, '{}'::jsonb) END);
END $$;

CREATE OR REPLACE FUNCTION public.sante_serveur() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'version', (SELECT valeur FROM public.config WHERE cle = 'version'),
    'verrou', coalesce((SELECT valeur FROM public.config WHERE cle = 'verrou'), 'false') = 'true',
    'heure', now(),
    'admin', public.est_admin())
$$;

CREATE OR REPLACE FUNCTION public.stats_admin() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.est_admin() THEN RAISE EXCEPTION 'accès refusé'; END IF;
  RETURN jsonb_build_object(
    'utilisateurs', (SELECT count(*) FROM public.profiles),
    'admins', (SELECT count(*) FROM public.user_roles WHERE role = 'admin'),
    'cours', (SELECT count(*) FROM public.courses WHERE left(type, 2) <> '__'),
    'quiz', (SELECT count(*) FROM public.courses WHERE type = '__quiz__'),
    'xp_aujourdhui', (SELECT coalesce(sum(montant), 0) FROM public.xp_log WHERE created_at >= public._debut_jour()),
    'combats_aujourdhui', (SELECT count(*) FROM public.combats WHERE created_at >= public._debut_jour()),
    'combats_rejetes', (SELECT count(*) FROM public.combats WHERE (resume->>'rejete') = 'true' AND created_at >= now() - interval '7 days'),
    'erreurs_24h', (SELECT count(*) FROM public.journal_erreurs WHERE created_at > now() - interval '24 hours'),
    'ia_ok', (SELECT count(*) FROM public.ia_usage WHERE ok AND created_at >= public._debut_jour()),
    'ia_ko', (SELECT count(*) FROM public.ia_usage WHERE NOT ok AND created_at >= public._debut_jour()),
    'ia_derniere', (SELECT max(created_at) FROM public.ia_usage),
    'heure', now());
END $$;

CREATE OR REPLACE FUNCTION public.journal_recent(p_type text, p_limite integer DEFAULT 50)
RETURNS TABLE (quand timestamptz, qui text, quoi text, detail text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := least(greatest(coalesce(p_limite, 50), 1), 200);
BEGIN
  IF NOT public.est_admin() THEN RAISE EXCEPTION 'accès refusé'; END IF;
  IF p_type = 'xp' THEN
    RETURN QUERY SELECT l.created_at, coalesce(p.pseudo, '?'), l.raison, '+' || l.montant::text
                 FROM public.xp_log l LEFT JOIN public.profiles p ON p.id = l.user_id ORDER BY l.created_at DESC LIMIT n;
  ELSIF p_type = 'erreurs' THEN
    RETURN QUERY SELECT e.created_at, coalesce(p.pseudo, '?'), e.message, e.contexte::text
                 FROM public.journal_erreurs e LEFT JOIN public.profiles p ON p.id = e.user_id ORDER BY e.created_at DESC LIMIT n;
  ELSIF p_type = 'admin' THEN
    RETURN QUERY SELECT a.created_at, coalesce(p.pseudo, '?'), a.action, coalesce(c.pseudo, a.cible)
                 FROM public.journal_admin a LEFT JOIN public.profiles p ON p.id = a.user_id
                 LEFT JOIN public.profiles c ON c.id::text = a.cible ORDER BY a.created_at DESC LIMIT n;
  ELSIF p_type = 'combats' THEN
    RETURN QUERY SELECT c.created_at, coalesce(p.pseudo, '?'), c.difficulte || CASE WHEN c.defi THEN ' (défi)' ELSE '' END,
                        coalesce(c.resume->>'fin', 'en cours') || ' · ' || coalesce(c.xp::text, '-') || ' XP' || CASE WHEN (c.resume->>'rejete') = 'true' THEN ' · REJETÉ' ELSE '' END
                 FROM public.combats c LEFT JOIN public.profiles p ON p.id = c.user_id ORDER BY c.created_at DESC LIMIT n;
  ELSE
    RAISE EXCEPTION 'type de journal inconnu';
  END IF;
END $$;

-- ---------- Droits d'appel (les fonctions internes restent fermées) ----------
REVOKE ALL ON FUNCTION public.est_admin(uuid), public.definir_role(uuid, boolean), public.liste_utilisateurs(), public.ouvrir_jour(),
  public.evenement_jeu(text, jsonb), public.calcul_xp_combat(text, text, integer, integer, integer), public.demarrer_combat(text, integer, boolean),
  public.terminer_combat(uuid, jsonb), public.signaler_erreur(text, jsonb), public.sante_serveur(), public.stats_admin(), public.journal_recent(text, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.est_admin(uuid), public.definir_role(uuid, boolean), public.liste_utilisateurs(), public.ouvrir_jour(),
  public.evenement_jeu(text, jsonb), public.calcul_xp_combat(text, text, integer, integer, integer), public.demarrer_combat(text, integer, boolean),
  public.terminer_combat(uuid, jsonb), public.signaler_erreur(text, jsonb), public.sante_serveur(), public.stats_admin(), public.journal_recent(text, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.est_admin(uuid) TO service_role;

-- ---------- Premier administrateur ----------
DO $$
DECLARE v_pseudo text := 'Leo Dupire';   -- <<< à remplacer par TON pseudo exact avant d'exécuter
BEGIN
  INSERT INTO public.user_roles (user_id, role) SELECT id, 'admin' FROM public.profiles WHERE pseudo = v_pseudo ON CONFLICT DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RAISE NOTICE 'ATTENTION : aucun administrateur créé (pseudo "%" introuvable). Corrige le pseudo et relance la migration.', v_pseudo;
  END IF;
END $$;
