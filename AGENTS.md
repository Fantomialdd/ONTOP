<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Isitech World — règles d'architecture
- All UI text is French; game runs on keyboard and mobile touch joystick.
- No secret keys in the browser: sensitive calls go through createServerFn, keys live in secrets.
- RLS on every table; profiles.xp/niveau are not client-writable (column grants) — only a SECURITY DEFINER SQL function may change them.
- Game map lives in src/game/carte: zones.ts (data only: 4 outdoor zones + 18 rooms, objects, NPCs, doors, exits), moteur.ts (grid collisions, interaction), sprites.tsx (pixel-art objects), sol.ts (floors). Rendering is in src/components/game (Monde.tsx, Personnage.tsx, Monstre.tsx).
- Movement: 4 directions only, never diagonal, with instant direction changes (avancer() in moteur.ts, tested in mouvement.test.ts). Positions are floats; at least one coordinate is always an integer.
- Realtime protocol is in src/game/salle.ts (transport-agnostic, tested with 20 simulated players); Supabase wiring is in multijoueur.ts. Never send a position per tile: send only when the walking state changes. Free Supabase limits: 100 messages/s, 20 presence messages/s.
- Tableau d'affichage (accueil): announcements stored in `courses` with type __annonce__; who may post is in src/game/admins.ts. Doors open with the interact key (Space/E); zone edges (sorties) trigger automatically.
- Settings (keys, sound, display) are in src/game/reglages.ts; never hardcode keys, use actionDeTouche().
- The Isitech network (courses, files, categories) uses the existing `courses` table with special `type` values (see src/game/reseau.ts).
- Characters are layered pixel SVG sprites (src/components/game/Personnage.tsx) driven by an Apparence JSON; NPCs reuse the same system.
- Decor objects are data (position, type, collision) so rooms are easy to extend.
- Game pages live under src/routes/_authenticated; /connexion is the public auth page.
- Player positions use Realtime broadcast/presence only, never stored in the database.

- Two networks: normal computers (agir `terminal`) open the COURSE network (src/components/game/Reseau.tsx); gaming PCs (agir `combat`, only in serveurs/developpeur/labo) open the COMBAT network (ReseauCombat.tsx -> Arene.tsx). Fight rules are pure and tested in src/game/combat.ts.
- Admin rights: src/game/admins.ts (ADMIN_IDS). Categories/hidden courses/validated quizzes live in ONE document (`__organisation__` row in `courses`) written by an admin; readers only trust admin-authored documents (see reseau.ts `assembler`, organisation.ts).
- Quizzes are `__quiz__` rows. AI generation goes through the edge function supabase/functions/generer-quiz (handler.ts is dependency-free and shared with the app and the tests). The API key (GEMINI_API_KEY) lives only in server secrets, never in the client.
