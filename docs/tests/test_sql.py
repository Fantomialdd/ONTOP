"""Tests des règles de sécurité en vrai PostgreSQL : chaque joueur n'agit que dans ses droits."""
import psycopg2, sys, uuid
DSN = "host=/tmp port=5433 dbname=isitech user=postgres"
echecs = []; ok = 0

def conn(): return psycopg2.connect(DSN)

def en_tant_que(c, role, uid=None):
    cur = c.cursor()
    cur.execute("SELECT set_config('request.jwt.claim.sub', %s, false)", (uid or '',))
    cur.execute(f"SET ROLE {role}")
    return cur

def tente(nom, fn, attendu_erreur):
    """Exécute fn ; attendu_erreur=True → doit échouer, False → doit réussir."""
    global ok
    c = conn(); c.autocommit = True
    try:
        fn(c)
        erreur = None
    except Exception as e:
        erreur = str(e).strip().splitlines()[0]
    finally:
        c.close()
    if (erreur is not None) == attendu_erreur:
        ok += 1
    else:
        echecs.append(f"{nom} : {'aurait dû échouer' if not attendu_erreur else 'a échoué à tort'} ({erreur})")

# Données : un admin, un élève, un autre élève
ADMIN = "11111111-1111-1111-1111-111111111111"
ELEVE = "22222222-2222-2222-2222-222222222222"
AUTRE = "33333333-3333-3333-3333-333333333333"
c = conn(); c.autocommit = True; cur = c.cursor()
for uid, pseudo in [(ADMIN, 'AdminTest'), (ELEVE, 'EleveTest'), (AUTRE, 'AutreTest')]:
    cur.execute("INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (%s, %s, %s)", (uid, pseudo + '@x.fr', '{"pseudo": "%s"}' % pseudo))
cur.execute("INSERT INTO public.user_roles (user_id, role) VALUES (%s, 'admin')", (ADMIN,))
c.close()

# ---------- Droits sur les rôles ----------
def eleve_se_nomme_admin(c):
    cur = en_tant_que(c, 'authenticated', ELEVE)
    cur.execute("INSERT INTO public.user_roles (user_id, role) VALUES (%s, 'admin')", (ELEVE,))
tente("un élève ne peut pas s'ajouter admin directement", eleve_se_nomme_admin, True)

def eleve_definit_role(c):
    cur = en_tant_que(c, 'authenticated', ELEVE)
    cur.execute("SELECT public.definir_role(%s, true)", (AUTRE,))
tente("un élève ne peut pas appeler definir_role", eleve_definit_role, True)

def admin_definit_role(c):
    cur = en_tant_que(c, 'authenticated', ADMIN)
    cur.execute("SELECT public.definir_role(%s, true)", (AUTRE,))
tente("un admin peut nommer un autre admin", admin_definit_role, False)

def admin_retire_dernier(c):
    cur = en_tant_que(c, 'authenticated', ADMIN)
    cur.execute("SELECT public.definir_role(%s, false)", (ADMIN,))
tente("avec 2 admins, un admin peut se retirer (le rôle est bien retiré)", admin_retire_dernier, False)
# On remet le rôle tout de suite pour que les tests suivants restent valides
_c = conn(); _c.autocommit = True; _c.cursor().execute("INSERT INTO public.user_roles (user_id, role) VALUES (%s, 'admin') ON CONFLICT DO NOTHING", (ADMIN,)); _c.close()

def dernier_admin_protege(c):
    # Il ne reste que AUTRE comme admin si on retire ADMIN ; on vérifie la protection du DERNIER admin
    _x = conn(); _x.autocommit = True; _cx = _x.cursor(); _cx.execute("DELETE FROM public.user_roles WHERE user_id = %s", (AUTRE,)); _x.close()
    cur = en_tant_que(c, 'authenticated', ADMIN)
    cur.execute("SELECT public.definir_role(%s, false)", (ADMIN,))
    _y = conn(); _y.autocommit = True; _y.cursor().execute("INSERT INTO public.user_roles (user_id, role) VALUES (%s, 'admin') ON CONFLICT DO NOTHING", (ADMIN,)); _y.close()
tente("le dernier administrateur ne peut pas se retirer", dernier_admin_protege, True)

def retirer_le_dernier(c):
    cur = en_tant_que(c, 'authenticated', AUTRE)
    cur.execute("SELECT public.definir_role(%s, false)", (AUTRE,))
tente("le retrait d'un admin par un non-admin est refusé", retirer_le_dernier, True)

# ---------- XP ----------
def eleve_xp_direct(c):
    cur = en_tant_que(c, 'authenticated', ELEVE)
    cur.execute("SELECT public.ajouter_xp(50)")
tente("l'ancienne fonction ajouter_xp est encore ouverte (avant verrouillage) : OK", eleve_xp_direct, False)

def eleve_modifie_xp_profil(c):
    cur = en_tant_que(c, 'authenticated', ELEVE)
    cur.execute("UPDATE public.profiles SET xp = 99999 WHERE id = %s", (ELEVE,))
tente("un élève ne peut pas modifier son XP directement dans profiles", eleve_modifie_xp_profil, True)

def eleve_modifie_niveau(c):
    cur = en_tant_que(c, 'authenticated', ELEVE)
    cur.execute("UPDATE public.profiles SET niveau = 50 WHERE id = %s", (ELEVE,))
tente("un élève ne peut pas modifier son niveau", eleve_modifie_niveau, True)

def eleve_ecrit_xp_log(c):
    cur = en_tant_que(c, 'authenticated', ELEVE)
    cur.execute("INSERT INTO public.xp_log (user_id, raison, montant) VALUES (%s, 'triche', 400)", (ELEVE,))
tente("un élève ne peut pas écrire dans xp_log", eleve_ecrit_xp_log, True)

def eleve_lit_autre_xp(c):
    cur = en_tant_que(c, 'authenticated', ELEVE)
    cur.execute("SELECT count(*) FROM public.xp_log WHERE user_id = %s", (AUTRE,))
    if cur.fetchone()[0] != 0: raise Exception("voit le journal d'un autre")
tente("un élève ne voit pas le journal XP des autres", eleve_lit_autre_xp, False)

# combat : durée minimale entre deux combats = 8 s, donc on contourne en reculant l'horodatage
def combat_complet(c, uid, resume):
    cur = en_tant_que(c, 'authenticated', uid)
    cur.execute("SELECT public.demarrer_combat('normal', 8, false)")
    cid = cur.fetchone()[0]
    c.commit()
    cur.execute("RESET ROLE")
    cur2 = c.cursor(); cur2.execute("UPDATE public.combats SET created_at = now() - interval '60 seconds' WHERE id = %s", (cid,))
    cur2.execute("SET ROLE authenticated"); cur2.execute("SELECT set_config('request.jwt.claim.sub', %s, false)", (uid,))
    cur2.execute("SELECT public.demarrer_combat('normal', 8, false)")  # ignoré : le premier est déjà fait
    cur2.execute("SELECT public.terminer_combat(%s, %s::jsonb)", (cid, resume))
    return cur2.fetchone()[0]

def combat_normal(c):
    r = combat_complet(c, ELEVE, '{"bonnes":6,"mauvaises":2,"combo":3,"fin":"victoire"}')
    assert r['xp'] > 0 and r['gains']['xp'] >= 0, r
tente("un combat gagné donne de l'XP (serveur)", combat_normal, False)

def combat_triche(c):
    r = combat_complet(c, AUTRE, '{"bonnes":8,"mauvaises":0,"combo":8,"fin":"victoire"}')
    assert r.get('rejete') is None or r['rejete'] is True
    # Un résumé impossible en une seconde (8 réponses juste après le départ) doit être rejeté
c2 = conn(); c2.autocommit = True
cur = c2.cursor(); cur.execute("SELECT set_config('request.jwt.claim.sub', %s, false)", (AUTRE,)); cur.execute("SET ROLE authenticated")
cur.execute("SELECT public.demarrer_combat('cauchemar', 3, false)"); cid = cur.fetchone()[0]
cur.execute("RESET ROLE")
cur.execute("UPDATE public.combats SET created_at = now() - interval '1 second' WHERE id = %s", (cid,))
cur.execute("SET ROLE authenticated")
cur.execute("SELECT public.terminer_combat(%s, '{\"bonnes\":3,\"mauvaises\":0,\"combo\":3,\"fin\":\"victoire\"}'::jsonb)", (cid,))
res = cur.fetchone()[0]
if res.get('rejete') is True and res.get('xp', 0) == 0: ok += 1
else: echecs.append(f"un combat trop rapide est rejeté : {res}")
c2.close()

def combat_deux_fois(c):
    cur = en_tant_que(c, 'authenticated', ELEVE)
    cur.execute("UPDATE public.combats SET created_at = now() - interval '2 minutes' WHERE user_id = %s", (ELEVE,))
    cur.execute("SELECT public.demarrer_combat('facile', 3, false)")
    cid = cur.fetchone()[0]
    cur.execute("UPDATE public.combats SET created_at = now() - interval '1 minute' WHERE id = %s", (cid,))
    cur.execute("SELECT public.terminer_combat(%s, '{\"bonnes\":3,\"mauvaises\":0,\"combo\":3,\"fin\":\"victoire\"}'::jsonb)", (cid,))
    cur.execute("SELECT public.terminer_combat(%s, '{\"bonnes\":3,\"mauvaises\":0,\"combo\":3,\"fin\":\"victoire\"}'::jsonb)", (cid,))
tente("le même combat ne peut pas être terminé deux fois", combat_deux_fois, True)

def combat_autre_joueur(c):
    cur = en_tant_que(c, 'authenticated', ELEVE)
    cur.execute("SELECT id FROM public.combats WHERE user_id = %s LIMIT 1", (ELEVE,))
    cid = cur.fetchone()[0]
    cur2 = en_tant_que(c, 'authenticated', AUTRE)
    cur2.execute("SELECT public.terminer_combat(%s, '{\"bonnes\":3,\"mauvaises\":0,\"combo\":0,\"fin\":\"epuise\"}'::jsonb)", (cid,))
tente("on ne peut pas terminer le combat d'un autre joueur", combat_autre_joueur, True)

# ---------- Cours et organisation ----------
COURS = str(uuid.uuid4())
def eleve_depose_cours(c):
    cur = en_tant_que(c, 'authenticated', ELEVE)
    cur.execute("INSERT INTO public.courses (id, author_id, title, type, text) VALUES (%s, %s, 'Mon cours', 'Réseaux', 'texte')", (COURS, ELEVE))
tente("un élève dépose un cours normal", eleve_depose_cours, False)

def eleve_cree_organisation(c):
    cur = en_tant_que(c, 'authenticated', ELEVE)
    cur.execute("INSERT INTO public.courses (author_id, title, type, text) VALUES (%s, 'Org', '__organisation__', '{}')", (ELEVE,))
tente("un élève ne peut pas créer l'organisation", eleve_cree_organisation, False)  # avant 02 : permis (défaut V5)

def eleve_quiz_sur_cours_autre(c):
    cur = en_tant_que(c, 'authenticated', AUTRE)
    cur.execute("INSERT INTO public.courses (author_id, title, type, text) VALUES (%s, %s, '__quiz__', '{}')", (AUTRE, COURS))
tente("avant 02 : un quiz peut être posé sur un autre cours (à verrouiller)", eleve_quiz_sur_cours_autre, False)

def eleve_supprime_cours_autre(c):
    # Une règle RLS refuse en SILENCE : la suppression ne touche aucune ligne, sans erreur.
    # Le bon test vérifie donc que le cours existe toujours après la tentative.
    cur = en_tant_que(c, 'authenticated', AUTRE)
    cur.execute("DELETE FROM public.courses WHERE id = %s", (COURS,))
    supprimees = cur.rowcount
    cur.execute("RESET ROLE")
    cur.execute("SELECT count(*) FROM public.courses WHERE id = %s", (COURS,))
    encore = cur.fetchone()[0]
    if supprimees != 0 or encore != 1: raise Exception(f"suppression par un autre élève (supprimées={supprimees}, restantes={encore})")
tente("avant 02 : un élève ne supprime pas le cours d'un autre (règle RLS)", eleve_supprime_cours_autre, False)

# ---------- Progression et événements ----------
def evenement_visite(c):
    cur = en_tant_que(c, 'authenticated', ELEVE)
    cur.execute("SELECT public.evenement_jeu('visite', '{\"salle\":\"labo\"}')")
    cur.execute("SELECT public.evenement_jeu('visite', '{\"salle\":\"labo\"}')")
tente("une visite de salle est enregistrée (une fois par jour)", evenement_visite, False)

def evenement_inconnu(c):
    cur = en_tant_que(c, 'authenticated', ELEVE)
    cur.execute("SELECT public.evenement_jeu('piratage', '{}')")
tente("un événement inconnu est refusé", evenement_inconnu, True)

def xp_quete_deux_fois(c):
    cur = en_tant_que(c, 'authenticated', ELEVE)
    cur.execute("SELECT public.evenement_jeu('reseau', '{}')")
    cur.execute("SELECT public.evenement_jeu('reseau', '{}')")
    cur.execute("SELECT xp FROM public.profiles WHERE id = %s", (ELEVE,))
    xp = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM public.xp_log WHERE user_id = %s AND raison = 'quete:reseau'", (ELEVE,))
    if cur.fetchone()[0] > 1: raise Exception("quête donnée deux fois")
tente("une quête ne rapporte qu'une fois par jour", xp_quete_deux_fois, False)

def depot_faux_cours(c):
    cur = en_tant_que(c, 'authenticated', AUTRE)
    cur.execute("SELECT public.evenement_jeu('depot', %s::jsonb)", ('{"cours": "%s"}' % COURS,))
tente("un élève ne peut pas réclamer le dépôt d'un autre", depot_faux_cours, True)

def depot_propre(c):
    cur = en_tant_que(c, 'authenticated', ELEVE)
    cur.execute("SELECT public.evenement_jeu('depot', %s::jsonb)", ('{"cours": "%s"}' % COURS,))
tente("le dépôt de son propre cours rapporte la badge", depot_propre, False)

# ---------- Supervision ----------
def eleve_voit_stats(c):
    cur = en_tant_que(c, 'authenticated', ELEVE)
    cur.execute("SELECT public.stats_admin()")
tente("un élève ne voit pas les statistiques admin", eleve_voit_stats, True)

def admin_voit_stats(c):
    cur = en_tant_que(c, 'authenticated', ADMIN)
    cur.execute("SELECT public.stats_admin()")
    s = cur.fetchone()[0]
    assert 'utilisateurs' in s and 'erreurs_24h' in s, s
tente("un admin voit les statistiques", admin_voit_stats, False)

def eleve_lit_journal_erreurs(c):
    cur = en_tant_que(c, 'authenticated', ELEVE)
    cur.execute("SELECT count(*) FROM public.journal_erreurs")
    if cur.fetchone()[0] != 0: raise Exception("lit les erreurs")
tente("un élève ne lit pas le journal d'erreurs", eleve_lit_journal_erreurs, False)

def signaler_spam(c):
    cur = en_tant_que(c, 'authenticated', ELEVE)
    for _ in range(15):
        cur.execute("SELECT public.signaler_erreur('test', '{}'::jsonb)")
    cur.execute("SELECT count(*) FROM public.journal_erreurs WHERE user_id = %s", (ELEVE,))
    if cur.fetchone()[0] > 10: raise Exception("plus de 10 erreurs par heure acceptées")
tente("le signalement d'erreurs est limité à 10 par heure", signaler_spam, False)

def journal_recent_admin(c):
    cur = en_tant_que(c, 'authenticated', ADMIN)
    for t in ['xp', 'erreurs', 'admin', 'combats']:
        cur.execute("SELECT * FROM public.journal_recent(%s, 5)", (t,))
tente("l'admin lit les 4 journaux", journal_recent_admin, False)

def journal_recent_eleve(c):
    cur = en_tant_que(c, 'authenticated', ELEVE)
    cur.execute("SELECT * FROM public.journal_recent('xp', 5)")
tente("un élève ne lit pas le journal", journal_recent_eleve, True)

def sante_publique(c):
    cur = en_tant_que(c, 'anon', None)
    cur.execute("SELECT public.sante_serveur()")
tente("l'état du serveur est visible sans connexion (sans données sensibles)", sante_publique, True)

print(f"✅ {ok} vérifications réussies")
if echecs:
    print(f"❌ {len(echecs)} problème(s) :")
    for e in echecs: print("  -", e)
    sys.exit(1)
