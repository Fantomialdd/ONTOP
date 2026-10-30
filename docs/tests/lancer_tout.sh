#!/bin/bash
# Suite complète : base fraîche, puis les tests de la migration 01, puis ceux de la 02 (verrouillage) et de la 03 (retour arrière)
set -e
cd /home/claude/sqltest
# Le serveur de test peut être arrêté entre deux commandes : on le (re)démarre si besoin
for i in 1 2 3 4 5; do
  su postgres -c "psql -h /tmp -p 5433 -d postgres -tAc 'SELECT 1'" >/dev/null 2>&1 && break
  su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgdata -o '-p 5433 -k /tmp' -l /tmp/pg.log start" >/dev/null 2>&1 || true
  sleep 2
done
./reinit.sh
echo "=== Migration 01 (fondations) ==="
python3 test_sql.py
./reinit.sh
echo "=== Migrations 02 et 03 (verrouillage et retour arrière) ==="
python3 test_verrou.py
