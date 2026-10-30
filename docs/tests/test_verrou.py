"""Tests de la migration 02 (verrouillage) et de son retour arrière."""
import psycopg2, subprocess, sys
DSN = "host=/tmp port=5433 dbname=isitech user=postgres"
ADMIN = "11111111-1111-1111-1111-111111111111"; ELEVE = "22222222-2222-2222-2222-222222222222"
echecs = []; ok = 0
def sql(fichier):
    r = subprocess.run(["su", "postgres", "-c", f"psql -q -h /tmp -p 5433 -d isitech -v ON_ERROR_STOP=1 -f {fichier}"], capture_output=True, text=True)
    if r.returncode: raise RuntimeError(r.stderr)
def essai(nom, requete, uid, attendu_erreur):
    global ok
    c = psycopg2.connect(DSN); c.autocommit = True; cur = c.cursor()
    cur.execute("SELECT set_config('request.jwt.claim.sub', %s, false)", (uid,)); cur.execute("SET ROLE authenticated")
    try: cur.execute(requete); err = None
    except Exception as e: err = str(e).splitlines()[0]
    c.close()
    if (err is not None) == attendu_erreur: ok += 1
    else: echecs.append(f"{nom} : {err or 'aucune erreur'}")

PLAN = [
  ("XP direct impossible après 02", "SELECT public.ajouter_xp(50)", ELEVE, True),
  ("élève : organisation impossible après 02", "INSERT INTO public.courses (author_id,title,type,text) VALUES ('22222222-2222-2222-2222-222222222222','Org','__organisation__','{}')", ELEVE, True),
  ("admin : organisation autorisée", "INSERT INTO public.courses (author_id,title,type,text) VALUES ('11111111-1111-1111-1111-111111111111','Org','__organisation__','{}')", ADMIN, False),
  ("élève : annonce impossible", "INSERT INTO public.courses (author_id,title,type,text) VALUES ('22222222-2222-2222-2222-222222222222','A','__annonce__','x')", ELEVE, True),
  ("élève : cours normal toujours possible", "INSERT INTO public.courses (author_id,title,type,text) VALUES ('22222222-2222-2222-2222-222222222222','Mon cours','Réseaux','x')", ELEVE, False),
  ("élève : quiz sur son propre cours autorisé", "INSERT INTO public.courses (author_id,title,type,text) SELECT '22222222-2222-2222-2222-222222222222', id::text, '__quiz__', '{}' FROM public.courses WHERE author_id = '22222222-2222-2222-2222-222222222222' AND type = 'Réseaux' LIMIT 1", ELEVE, False),
  ("élève : quiz sur le cours d'un autre refusé", "INSERT INTO public.courses (author_id,title,type,text) SELECT '22222222-2222-2222-2222-222222222222', id::text, '__quiz__', '{}' FROM public.courses WHERE author_id = '33333333-3333-3333-3333-333333333333' LIMIT 1", ELEVE, True),
  ("admin : quiz sur n'importe quel cours autorisé", "INSERT INTO public.courses (author_id,title,type,text) SELECT '11111111-1111-1111-1111-111111111111', id::text, '__quiz__', '{}' FROM public.courses LIMIT 1", ADMIN, False),
]
def lancer(titre):
    global ok
    print(f"-- {titre}")
    for nom, req, uid, err in PLAN: essai(nom, req, uid, err)

# Préparation autonome : trois comptes, un admin, et un cours d'un autre élève (pour les tests de quiz)
c = psycopg2.connect(DSN); c.autocommit = True; cur = c.cursor()
for uid, pseudo in [(ADMIN, "AdminTest"), (ELEVE, "EleveTest"), ("33333333-3333-3333-3333-333333333333", "AutreTest")]:
    cur.execute("INSERT INTO auth.users (id,email,raw_user_meta_data) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING", (uid, pseudo + "@x.fr", '{"pseudo": "%s"}' % pseudo))
cur.execute("INSERT INTO public.user_roles (user_id, role) VALUES (%s, 'admin') ON CONFLICT DO NOTHING", (ADMIN,))
cur.execute("INSERT INTO public.courses (author_id,title,type,text) VALUES ('33333333-3333-3333-3333-333333333333','Cours autre','Réseaux','x')")
c.close()

sql("/home/claude/immersive-game-world-main/docs/sql/02_verrouillage.sql")
lancer("APRÈS verrouillage (02)")

sql("/home/claude/immersive-game-world-main/docs/sql/03_retour_arriere.sql")
# Après retour arrière : l'XP direct redevient possible (c'est le but du retour arrière), et les annonces de l'élève aussi
essai("retour arrière : XP direct de nouveau possible", "SELECT public.ajouter_xp(1)", ELEVE, False)
essai("retour arrière : élève peut à nouveau créer une organisation", "INSERT INTO public.courses (author_id,title,type,text) VALUES ('22222222-2222-2222-2222-222222222222','Org2','__organisation__','{}')", ELEVE, False)

print(f"✅ {ok} vérifications réussies")
if echecs:
    print(f"❌ {len(echecs)} problème(s) :")
    for e in echecs: print("  -", e)
    sys.exit(1)
