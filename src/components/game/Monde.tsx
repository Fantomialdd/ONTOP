import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Personnage } from "./Personnage";
import { Joystick } from "./Joystick";
import type { Apparence, Direction } from "@/game/apparence";
import { deplacer, porteSous, TUILE as T, type Decor, type Point, type Scene, type SceneId } from "@/game/monde";
import type { Joueur, Pos } from "@/game/multijoueur";
import type { Profil } from "@/game/profil";

export type Pnj = { id: string; x: number; y: number; nom: string; label: string; apparence?: Apparence; emoji?: string; action: () => void };

type Props = {
  scene: Scene; depart: Point; pnjs: Pnj[]; autres: Joueur[]; moi: Profil; pause: boolean;
  onPorte: (v: SceneId) => void; onPos: (p: Pos) => void; onClicJoueur: (id: string) => void;
};

const STYLE_DECOR: Record<Decor["type"], { cls: string; style?: CSSProperties; contenu?: ReactNode }> = {
  mur: { cls: "tile-wall" },
  tableau: { cls: "border-4 border-border bg-secondary font-pixel text-[8px] text-muted-foreground grid place-items-center", contenu: "▤ TABLEAU ▤" },
  bureau: { cls: "border-4 border-border", style: { background: "var(--wood)" } },
  plante: { cls: "grid place-items-center text-3xl", contenu: "🪴" },
  banc: { cls: "border-4 border-border", style: { background: "var(--wood-2)" } },
  accueil: { cls: "border-4 border-border font-pixel text-[8px] grid place-items-center text-accent", style: { background: "var(--wood-2)" }, contenu: "ACCUEIL" },
  casier: { cls: "border-4 border-border bg-muted", style: { backgroundImage: "repeating-linear-gradient(90deg, transparent 0 18px, var(--border) 18px 20px)" } },
  rack: { cls: "border-4 border-border bg-border flex flex-col items-center justify-around", contenu: <><span className="h-1 w-3 bg-primary anim-blink" /><span className="h-1 w-3 bg-accent" /><span className="h-1 w-3 bg-primary anim-blink" /></> },
  table: { cls: "rounded-md border-4 border-border", style: { background: "var(--wood)" } },
  comptoir: { cls: "border-4 border-border grid place-items-center text-xl", style: { background: "var(--wood-2)" }, contenu: "☕ 🥐 🍕" },
  tapis: { cls: "bg-accent/30" },
};

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function Monde({ scene, depart, pnjs, autres, moi, pause, onPorte, onPos, onClicJoueur }: Props) {
  const [pos, setPos] = useState<Pos>({ ...depart, dir: "bas", marche: false });
  const posRef = useRef(pos);
  const touches = useRef(new Set<string>());
  const joy = useRef({ x: 0, y: 0 });
  const sorti = useRef(false);
  const props = useRef({ scene, pause, onPorte, onPos });
  props.current = { scene, pause, onPorte, onPos };
  const vue = useRef<HTMLDivElement>(null);
  const [taille, setTaille] = useState({ w: 800, h: 500 });

  const proche = useMemo(() => {
    let best: Pnj | undefined, bd = 1.7;
    for (const p of pnjs) { const dd = dist(p, pos); if (dd < bd) { bd = dd; best = p; } }
    return best;
  }, [pnjs, pos]);
  const procheRef = useRef(proche);
  procheRef.current = proche;

  useEffect(() => {
    const el = vue.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTaille({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    onPos(posRef.current);
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
      if ((k === "e" || k === "enter" || k === " ") && !props.current.pause) { procheRef.current?.action(); return; }
      touches.current.add(k);
    };
    const up = (e: KeyboardEvent) => touches.current.delete(e.key.toLowerCase());
    const blur = () => touches.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);

    let raf = 0, last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const { scene: s, pause: pz } = props.current;
      const k = touches.current;
      let dx = 0, dy = 0;
      if (!pz && !sorti.current) {
        if (k.has("arrowleft") || k.has("q") || k.has("a")) dx -= 1;
        if (k.has("arrowright") || k.has("d")) dx += 1;
        if (k.has("arrowup") || k.has("z") || k.has("w")) dy -= 1;
        if (k.has("arrowdown") || k.has("s")) dy += 1;
        dx += joy.current.x; dy += joy.current.y;
      }
      const len = Math.hypot(dx, dy), p = posRef.current;
      if (len > 0.2) {
        const v = (4.5 * dt) / Math.max(1, len);
        const n = deplacer(s, p, dx * v, dy * v);
        const dir: Direction = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "gauche" : "droite") : dy < 0 ? "haut" : "bas";
        const np = { ...n, dir, marche: true };
        posRef.current = np; setPos(np); props.current.onPos(np);
        const porte = porteSous(s, np.x, np.y);
        if (porte) { sorti.current = true; props.current.onPorte(porte.vers); }
      } else if (p.marche) {
        const np = { ...p, marche: false };
        posRef.current = np; setPos(np); props.current.onPos(np);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const W = scene.l * T, H = scene.h * T;
  const cam = (c: number, monde: number, vue: number) => (monde <= vue ? (monde - vue) / 2 : Math.max(0, Math.min(monde - vue, c - vue / 2)));
  const cx = cam(pos.x * T, W, taille.w), cy = cam(pos.y * T, H, taille.h);
  const place = (p: Point): CSSProperties => ({ left: p.x * T, top: p.y * T, transform: "translate(-50%, -100%)", zIndex: 10 + Math.round(p.y * 10) });

  return (
    <div ref={vue} className="relative h-[68vh] w-full touch-none select-none overflow-hidden border-4 border-border bg-border">
      <div className={`absolute left-0 top-0 ${scene.sol}`} style={{ width: W, height: H, transform: `translate(${-cx}px, ${-cy}px)` }}>
        {scene.decor.map((o, i) => {
          const st = STYLE_DECOR[o.type];
          return (
            <div key={i} className={`absolute ${st.cls}`} style={{ left: o.x * T, top: o.y * T, width: o.w * T, height: o.h * T, ...st.style }}>
              {st.contenu}
            </div>
          );
        })}
        {scene.portes.map((p) => (
          <div key={p.vers} className="tile-door absolute grid place-items-center border-4 border-border font-pixel text-[7px] text-accent-foreground"
            style={{ left: p.x * T, top: p.y * T, width: p.w * T, height: p.h * T }}>{p.label}</div>
        ))}
        {pnjs.map((p) => (
          <button key={p.id} className="absolute flex flex-col items-center" style={place(p)} onClick={p.action}>
            {proche?.id === p.id && <span className="anim-bob font-pixel text-[10px] text-accent">!</span>}
            {p.emoji ? (
              <>
                <span className="mb-1 whitespace-nowrap bg-background/80 px-1 font-pixel text-[7px] text-destructive">{p.nom}</span>
                <span className="anim-bob text-4xl leading-none">{p.emoji}</span>
              </>
            ) : <Personnage a={p.apparence!} taille={56} pseudo={p.nom} />}
          </button>
        ))}
        {autres.map((j) => (
          <button key={j.id} className="absolute transition-[left,top] duration-100 ease-linear" style={place(j)} onClick={() => onClicJoueur(j.id)}>
            <Personnage a={j.apparence} dir={j.dir} marche={j.marche} taille={56} pseudo={j.pseudo} niveau={j.niveau} />
          </button>
        ))}
        <button className="absolute" style={place(pos)} onClick={() => onClicJoueur(moi.id)}>
          <Personnage a={moi.apparence} dir={pos.dir} marche={pos.marche} taille={56} pseudo={moi.pseudo} niveau={moi.niveau} />
        </button>
      </div>
      {proche && !pause && (
        <button className="pixel-box absolute bottom-3 left-1/2 z-[2000] -translate-x-1/2 px-3 py-2 font-pixel text-[10px] text-accent" onClick={proche.action}>
          [E] {proche.label}
        </button>
      )}
      <Joystick onChange={(v) => { joy.current = v; }} />
    </div>
  );
}
