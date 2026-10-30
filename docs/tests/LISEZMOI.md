# Tests de la base de données (PostgreSQL)

Ces tests vérifient les règles de sécurité **dans une vraie base PostgreSQL**, et pas seulement sur le papier :
qui peut lire, écrire, s'attribuer de l'XP, terminer un combat d'un autre, réclamer un dépôt qui n'est pas le sien, etc.

## Lancer les tests
Il faut PostgreSQL 16 et Python 3 avec `psycopg2`.
```
./lancer_tout.sh      # base fraîche, migrations 00 à 01, puis tests 02 et 03
python3 test_formule.py   # la formule d'XP est identique au jeu et au serveur
```
`setup.sql` imite le minimum de Supabase (rôles `anon`, `authenticated`, `service_role`, et `auth.uid()`).

## Ce qui est couvert
- **Rôles** : un élève ne peut pas se nommer admin ; le dernier admin ne peut pas se retirer ; seul un admin nomme un admin.
- **XP** : un élève ne peut pas modifier son XP ni son niveau directement, ni écrire dans le journal XP ; il ne voit pas celui des autres.
- **Combats** : un résumé impossible (trop rapide, trop de bonnes réponses) est rejeté ; un combat ne se termine qu'une fois ; on ne termine pas le combat d'un autre.
- **Cours** : un élève ne supprime pas le cours d'un autre (la base refuse en silence : le test vérifie que le cours existe toujours).
- **Verrouillage (02)** : l'ancienne fonction d'XP libre est fermée ; seul un admin crée l'organisation, les annonces et les catégories ; un quiz ne se pose que sur son propre cours.
- **Retour arrière (03)** : rétablit l'état précédent.
- **Formule d'XP** : identique au jeu sur 400 combats tirés au hasard.

## Ce que les tests ont corrigé (à connaître)
- Un écart d'arrondi entre le jeu et le serveur (12 cas sur 400) : PostgreSQL gardait 20 décimales dans une division, ce qui faisait tomber 12,5 juste en dessous de .5. Le calcul se fait maintenant en entiers × 10 000, des deux côtés.
- Un test qui vérifiait une erreur là où la base refuse en silence (RLS). Le test vérifie désormais l'état réel.
