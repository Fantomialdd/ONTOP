import { useEffect, useState } from "react";
import type { Apparence, Direction } from "@/game/apparence";

/**
 * Personnage en pied dessiné en pixel art (SVG en couches) :
 * ombre, chaussures, bas, haut, bras, tête, cheveux, accessoire.
 * 4 directions, 4 images de marche, pose immobile.
 */
const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};

export function Personnage({ a, dir = "bas", marche = false, taille = 96, pseudo, niveau }: {
  a: Apparence; dir?: Direction; marche?: boolean; taille?: number; pseudo?: string; niveau?: number;
}) {
  const [f, setF] = useState(0);
  useEffect(() => {
    if (!marche) { setF(0); return; }
    const t = setInterval(() => setF((x) => (x + 1) % 4), 150);
    return () => clearInterval(t);
  }, [marche]);

  const side = dir === "gauche" || dir === "droite";
  const back = dir === "haut";
  // Décalages de marche : jambes et bras alternés, petit rebond
  const step = [0, 1, 0, -1][f]!;
  const bob = f % 2 === 1 ? -0.5 : 0;
  const peauO = shade(a.peau, 0.8);
  const hautO = shade(a.hautCouleur, 0.75);
  const basO = shade(a.basCouleur, 0.75);
  const chevO = shade(a.cheveux, 0.7);
  const flip = dir === "gauche" ? "scale(-1,1) translate(-32,0)" : undefined;

  const jambeG = side ? step * 1.5 : step;
  const jambeD = side ? -step * 1.5 : -step;
  const shortLeg = a.bas === "short";
  const jupe = a.bas === "jupe";

  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: taille * (32 / 48) }}>
      {pseudo && (
        <div className="mb-1 whitespace-nowrap bg-background/80 px-1 font-pixel text-[8px] leading-tight text-primary">
          {pseudo}{niveau !== undefined && <span className="text-accent"> Nv{niveau}</span>}
        </div>
      )}
      <svg viewBox="0 0 32 48" width={taille * (32 / 48)} height={taille} shapeRendering="crispEdges" style={{ imageRendering: "pixelated" }}>
        <ellipse cx="16" cy="46" rx="8" ry="2" fill="black" opacity="0.3" />
        <g transform={flip}>
          <g transform={`translate(0,${bob})`}>
            {/* Sac à dos (derrière sauf de dos) */}
            {a.accessoire === "sac" && !back && <rect x={side ? 7 : 9} y="20" width={side ? 4 : 14} height="10" fill="#3a3a52" />}

            {/* Jambes */}
            <g>
              <rect x={side ? 13 + jambeG : 11} y={32 + (side ? 0 : Math.max(0, jambeG))} width="4" height={shortLeg ? 4 : 10} fill={jupe ? a.peau : a.basCouleur} />
              <rect x={side ? 15 + jambeD : 17} y={32 + (side ? 0 : Math.max(0, jambeD))} width="4" height={shortLeg ? 4 : 10} fill={jupe ? a.peau : basO} />
              {(shortLeg || jupe) && <>
                <rect x={side ? 13 + jambeG : 11} y={36} width="4" height="6" fill={a.peau} />
                <rect x={side ? 15 + jambeD : 17} y={36} width="4" height="6" fill={peauO} />
              </>}
              {a.bas === "jogging" && <>
                <rect x={side ? 13 + jambeG : 11} y={40} width="4" height="1" fill={basO} />
                <rect x={side ? 15 + jambeD : 17} y={40} width="4" height="1" fill={basO} />
              </>}
              {jupe && <rect x="10" y="30" width="12" height="6" fill={a.basCouleur} />}
              {/* Chaussures */}
              <rect x={side ? 12 + jambeG : 10} y={42 + (side ? 0 : Math.max(0, jambeG))} width={side ? 6 : 5} height="3" fill={a.chaussures} />
              <rect x={side ? 14 + jambeD : 17} y={42 + (side ? 0 : Math.max(0, jambeD))} width={side ? 6 : 5} height="3" fill={shade(a.chaussures, 0.8)} />
            </g>

            {/* Torse */}
            <rect x="10" y="19" width="12" height="13" fill={a.hautCouleur} />
            <rect x="10" y="29" width="12" height="3" fill={hautO} />
            {a.haut === "chemise" && !back && <>
              <rect x="15" y="19" width="2" height="13" fill={hautO} />
              <rect x="13" y="19" width="6" height="2" fill="#f4f4f4" />
            </>}
            {a.haut === "veste" && !back && <>
              <rect x="14" y="19" width="4" height="13" fill="#f4f4f4" />
              <rect x="10" y="19" width="4" height="13" fill={hautO} />
            </>}
            {a.haut === "sweat" && <rect x="11" y={back ? 18 : 19} width="10" height="2" fill={hautO} />}
            {a.haut === "sweat" && !back && !side && <rect x="13" y="25" width="6" height="3" fill={hautO} />}
            {a.accessoire === "badge" && !back && <>
              <rect x={side ? 17 : 18} y="23" width="3" height="3" fill="#f4f4f4" />
              <rect x={side ? 18 : 19} y="24" width="1" height="1" fill="#2f9e5a" />
            </>}

            {/* Bras */}
            {side ? (
              <g>
                <rect x={14 - step} y="20" width="4" height="9" fill={a.haut === "tshirt" ? a.peau : a.hautCouleur} />
                <rect x={14 - step} y={a.haut === "tshirt" ? 20 : 20} width="4" height={a.haut === "tshirt" ? 3 : 0} fill={a.hautCouleur} />
                <rect x={14 - step} y="29" width="4" height="2" fill={a.peau} />
              </g>
            ) : (
              <g>
                <rect x="7" y={20 + Math.max(0, -step)} width="3" height="9" fill={a.haut === "tshirt" ? a.peau : a.hautCouleur} />
                <rect x="22" y={20 + Math.max(0, step)} width="3" height="9" fill={a.haut === "tshirt" ? peauO : hautO} />
                {a.haut === "tshirt" && <>
                  <rect x="7" y={20 + Math.max(0, -step)} width="3" height="3" fill={a.hautCouleur} />
                  <rect x="22" y={20 + Math.max(0, step)} width="3" height="3" fill={hautO} />
                </>}
                <rect x="7" y={29 + Math.max(0, -step)} width="3" height="2" fill={a.peau} />
                <rect x="22" y={29 + Math.max(0, step)} width="3" height="2" fill={peauO} />
              </g>
            )}

            {/* Sac de dos */}
            {a.accessoire === "sac" && back && <rect x="10" y="20" width="12" height="10" fill="#3a3a52" />}

            {/* Cou + tête */}
            <rect x="14" y="16" width="4" height="3" fill={peauO} />
            <rect x="9" y="4" width="14" height="13" fill={a.peau} />
            <rect x="9" y="15" width="14" height="2" fill={peauO} />

            {/* Visage */}
            {!back && (side ? (
              <>
                <rect x="19" y="10" width="2" height="2" fill={a.yeux} />
                <rect x="23" y="11" width="1" height="2" fill={peauO} />
                <rect x="19" y="14" width="2" height="1" fill={shade(a.peau, 0.6)} />
                <rect x="13" y="10" width="2" height="3" fill={peauO} />
              </>
            ) : (
              <>
                <rect x="12" y="10" width="2" height="2" fill={a.yeux} />
                <rect x="18" y="10" width="2" height="2" fill={a.yeux} />
                <rect x="12" y="10" width="1" height="1" fill="#ffffff" />
                <rect x="18" y="10" width="1" height="1" fill="#ffffff" />
                <rect x="15" y="12" width="2" height="1" fill={peauO} />
                <rect x="14" y="14" width="4" height="1" fill={shade(a.peau, 0.6)} />
              </>
            ))}

            {/* Cheveux */}
            <Cheveux a={a} back={back} side={side} o={chevO} />

            {/* Accessoires de tête */}
            {a.accessoire === "lunettes" && !back && (side
              ? <rect x="18" y="9" width="5" height="4" fill="none" stroke="#1a1a1a" strokeWidth="1" />
              : <>
                <rect x="11" y="9" width="4" height="4" fill="none" stroke="#1a1a1a" strokeWidth="1" />
                <rect x="17" y="9" width="4" height="4" fill="none" stroke="#1a1a1a" strokeWidth="1" />
                <rect x="15" y="10" width="2" height="1" fill="#1a1a1a" />
              </>)}
            {a.accessoire === "casquette" && <>
              <rect x="8" y="2" width="16" height="5" fill="#d9483b" />
              {!back && <rect x={side ? 20 : 8} y="6" width={side ? 7 : 16} height="2" fill="#a8352b" />}
            </>}
            {a.accessoire === "casque" && <>
              <rect x="8" y="1" width="16" height="2" fill="#222" />
              {!side && <><rect x="6" y="8" width="4" height="6" fill="#222" /><rect x="22" y="8" width="4" height="6" fill="#222" /></>}
              {side && <rect x="13" y="8" width="5" height="6" fill="#222" />}
            </>}
          </g>
        </g>
      </svg>
    </div>
  );
}

function Cheveux({ a, back, side, o }: { a: Apparence; back: boolean; side: boolean; o: string }) {
  const c = a.cheveux;
  switch (a.coiffure) {
    case "rase":
      return <rect x="9" y="3" width="14" height="3" fill={c} opacity="0.85" />;
    case "herisse":
      return <>
        <rect x="9" y="3" width="14" height="4" fill={c} />
        {[9, 12, 15, 18, 21].map((x) => <rect key={x} x={x} y="1" width="2" height="2" fill={c} />)}
        {back && <rect x="9" y="7" width="14" height="6" fill={c} />}
        {side && <rect x="9" y="7" width="5" height="4" fill={o} />}
      </>;
    case "longue":
      return <>
        <rect x="8" y="2" width="16" height="5" fill={c} />
        <rect x="7" y="6" width="3" height={back ? 14 : 13} fill={o} />
        {!side && <rect x="22" y="6" width="3" height="13" fill={o} />}
        {back && <rect x="9" y="6" width="14" height="14" fill={c} />}
      </>;
    case "chignon":
      return <>
        <rect x="9" y="3" width="14" height="4" fill={c} />
        <rect x={side ? 6 : 13} y={side ? 4 : 0} width="6" height="4" fill={o} />
        {back && <rect x="9" y="7" width="14" height="7" fill={c} />}
      </>;
    case "boucles":
      return <>
        {[8, 11, 14, 17, 20].map((x) => <rect key={x} x={x} y={x % 2 ? 2 : 1} width="4" height="4" fill={x % 2 ? c : o} />)}
        <rect x="7" y="5" width="3" height="6" fill={c} />
        {!side && <rect x="22" y="5" width="3" height="6" fill={c} />}
        {back && <rect x="9" y="5" width="14" height="9" fill={c} />}
      </>;
    default:
      return <>
        <rect x="9" y="3" width="14" height="4" fill={c} />
        <rect x="9" y="6" width="2" height="3" fill={o} />
        {!side && <rect x="21" y="6" width="2" height="3" fill={o} />}
        {side && <rect x="9" y="6" width="6" height="4" fill={o} />}
        {back && <rect x="9" y="6" width="14" height="7" fill={c} />}
      </>;
  }
}
