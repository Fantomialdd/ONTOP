#!/bin/bash
# Repart d'une base propre avec les 3 migrations du projet + la 01 (pas la 02 : elle est testée à part)
set -e
su postgres -c "psql -q -h /tmp -p 5433 -d postgres -c 'DROP DATABASE IF EXISTS isitech' -c 'CREATE DATABASE isitech'" >/dev/null 2>&1
su postgres -c "psql -q -h /tmp -p 5433 -d isitech -f /home/claude/sqltest/setup.sql" >/dev/null 2>&1
for f in 0000_migration 0001_migration 0002_ajouter_xp; do
  su postgres -c "psql -q -h /tmp -p 5433 -d isitech -v ON_ERROR_STOP=1 -f /home/claude/immersive-game-world-main/drizzle/migrations/$f.sql" >/dev/null 2>&1
done
su postgres -c "psql -q -h /tmp -p 5433 -d isitech -v ON_ERROR_STOP=1 -f /home/claude/immersive-game-world-main/docs/sql/01_fondations.sql" >/dev/null 2>&1
