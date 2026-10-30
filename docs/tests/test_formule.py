"""La formule d'XP côté serveur (SQL) doit donner EXACTEMENT le même résultat que le jeu (TypeScript)."""
import psycopg2, subprocess, json, random, sys
DSN = "host=/tmp port=5433 dbname=isitech user=postgres"
# Calcul côté jeu : on exécute la vraie fonction TypeScript via node, sur les mêmes cas
cas = []
rnd = random.Random(42)
for _ in range(400):
    diff = rnd.choice(["facile", "normal", "difficile", "cauchemar"])
    fin = rnd.choice(["victoire", "defaite", "epuise"])
    total = rnd.randint(3, 15)
    bonnes = rnd.randint(0, total); mauvaises = rnd.randint(0, total - bonnes + 2)
    combo = rnd.randint(0, bonnes)
    cas.append((diff, fin, bonnes, mauvaises, combo))

script = r'''
const cas = JSON.parse(require("fs").readFileSync(0, "utf8"));
const { calculerXp } = require("./combat.js");
const out = cas.map(([diff, fin, bonnes, mauvaises, combo]) => {
  const e = { regles: { xp: {facile:15,normal:25,difficile:40,cauchemar:50}[diff] }, fin, bonnes, mauvaises, meilleurCombo: combo };
  return calculerXp(e);
});
process.stdout.write(JSON.stringify(out));
'''
# Compilation minimale du moteur TypeScript en JavaScript, pour le tester tel quel
subprocess.run(["bash", "-c", "cd /home/claude/immersive-game-world-main && npx --yes esbuild src/game/combat.ts --bundle --format=cjs --outfile=/tmp/combat.js --log-level=error"], check=True)
import os, shutil
shutil.copy("/tmp/combat.js", "/tmp/combat_node.js")
open("/tmp/run_formule.js", "w").write(script.replace('require("./combat.js")', 'require("/tmp/combat_node.js")'))
js = subprocess.run(["node", "/tmp/run_formule.js"], input=json.dumps(cas), capture_output=True, text=True)
if js.returncode: raise SystemExit("Erreur côté jeu : " + js.stderr)
cote_jeu = json.loads(js.stdout)

c = psycopg2.connect(DSN); c.autocommit = True; cur = c.cursor()
cote_serveur = []
for diff, fin, bonnes, mauvaises, combo in cas:
    cur.execute("SELECT public.calcul_xp_combat(%s, %s, %s, %s, %s)", (diff, fin, bonnes, mauvaises, combo))
    cote_serveur.append(cur.fetchone()[0])
ecarts = [(cas[i], cote_jeu[i], cote_serveur[i]) for i in range(len(cas)) if cote_jeu[i] != cote_serveur[i]]
if ecarts:
    print(f"❌ {len(ecarts)} écart(s) sur {len(cas)} cas. Exemples :")
    for e in ecarts[:5]: print("  ", e)
    sys.exit(1)
print(f"✅ La formule d'XP est identique au jeu et au serveur sur {len(cas)} combats tirés au hasard (graine fixe).")
