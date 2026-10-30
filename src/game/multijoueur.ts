import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Apparence, Direction } from "./apparence";
import type { Point, SceneId } from "./monde";
import type { Profil } from "./profil";

export type Pos = Point & { dir: Direction; marche: boolean };
export type Joueur = Pos & { id: string; pseudo: string; niveau: number; apparence: Apparence };

/** Salle temps réel : présence (qui est là) + diffusion des positions. Rien n'est stocké en base. */
export function useSalle(scene: SceneId, moi: Profil | null | undefined, depart: Point) {
  const [autres, setAutres] = useState<Record<string, Joueur>>({});
  const ch = useRef<RealtimeChannel | null>(null);
  const pos = useRef<Pos>({ ...depart, dir: "bas", marche: false });
  const dernier = useRef(0);
  const attente = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleApp = JSON.stringify(moi?.apparence ?? {});

  useEffect(() => {
    if (!moi) return;
    pos.current = { ...depart, dir: "bas", marche: false };
    const c = supabase.channel(`salle:${scene}`, { config: { presence: { key: moi.id }, broadcast: { self: false } } });
    const info = (): Joueur => ({ id: moi.id, pseudo: moi.pseudo, niveau: moi.niveau, apparence: moi.apparence, ...pos.current });
    c.on("presence", { event: "sync" }, () => {
      const st = c.presenceState<Joueur>();
      setAutres((prev) => {
        const n: Record<string, Joueur> = {};
        for (const [k, arr] of Object.entries(st)) {
          const j = arr[0];
          if (k === moi.id || !j) continue;
          const old = prev[k];
          n[k] = { id: j.id, pseudo: j.pseudo, niveau: j.niveau, apparence: j.apparence,
            x: old?.x ?? j.x, y: old?.y ?? j.y, dir: old?.dir ?? j.dir, marche: old?.marche ?? false };
        }
        return n;
      });
    })
      .on("broadcast", { event: "pos" }, ({ payload }) => {
        const p = payload as Pos & { id: string };
        setAutres((prev) => (prev[p.id] ? { ...prev, [p.id]: { ...prev[p.id]!, x: p.x, y: p.y, dir: p.dir, marche: p.marche } } : prev));
      })
      .subscribe((s) => { if (s === "SUBSCRIBED") void c.track(info()); });
    ch.current = c;
    const t = setInterval(() => { void c.track(info()); }, 3000);
    return () => { clearInterval(t); void supabase.removeChannel(c); ch.current = null; setAutres({}); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, moi?.id, moi?.pseudo, moi?.niveau, cleApp]);

  const envoyer = useCallback((p: Pos) => {
    pos.current = p;
    const go = () => {
      dernier.current = Date.now();
      if (moi) void ch.current?.send({ type: "broadcast", event: "pos", payload: { id: moi.id, ...pos.current } });
    };
    if (attente.current) { clearTimeout(attente.current); attente.current = null; }
    const reste = 90 - (Date.now() - dernier.current);
    if (reste <= 0) go(); else attente.current = setTimeout(go, reste);
  }, [moi]);

  return { autres: Object.values(autres), envoyer };
}
