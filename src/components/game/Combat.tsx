import { useState } from "react";
import { Personnage } from "./Personnage";
import type { Question } from "@/game/quiz";
import type { Profil } from "@/game/profil";

const Barre = ({ nom, pv, niveau }: { nom: string; pv: number; niveau?: number }) => (
  <div className="pixel-box w-56 p-2">
    <div className="flex justify-between font-pixel text-[9px]"><span>{nom}</span>{niveau !== undefined && <span>Nv{niveau}</span>}</div>
    <div className="mt-1 h-3 border-2 border-border bg-muted">
      <div className={`h-full transition-all duration-500 ${pv > 50 ? "bg-primary" : pv > 20 ? "bg-accent" : "bg-destructive"}`} style={{ width: `${pv}%` }} />
    </div>
    <div className="text-right text-sm">{pv}/100 PV</div>
  </div>
);

/** Combat au tour par tour façon Pokémon : chaque bonne réponse attaque le monstre. */
export function Combat({ monstre, emoji, questions, moi, gainXp, onVictoire, onFermer }: {
  monstre: string; emoji: string; questions: Question[]; moi: Profil; gainXp: number;
  onVictoire: () => Promise<void>; onFermer: () => void;
}) {
  const [pvM, setPvM] = useState(100), [pvJ, setPvJ] = useState(100), [i, setI] = useState(0);
  const [phase, setPhase] = useState<"intro" | "question" | "suite" | "fin">("intro");
  const [msg, setMsg] = useState(`Un ${monstre} sauvage apparaît !`);
  const [choc, setChoc] = useState<"m" | "j" | null>(null);
  const q = questions[i % questions.length]!;

  const repondre = (k: number) => {
    if (k === q.bonne) {
      const dmg = 30 + Math.floor(Math.random() * 10);
      setPvM((v) => Math.max(0, v - dmg)); setChoc("m");
      setMsg(`Bonne réponse ! ${moi.pseudo} lance RÉVISION ! −${dmg} PV`);
    } else {
      setPvJ((v) => Math.max(0, v - 25)); setChoc("j");
      setMsg(`Raté ! C'était « ${q.choix[q.bonne]} ». ${monstre} contre-attaque ! −25 PV`);
    }
    setPhase("suite");
  };

  const suite = async () => {
    setChoc(null);
    if (pvM <= 0) { setPhase("fin"); setMsg(`${monstre} est K.O. ! Tu gagnes ${gainXp} XP !`); await onVictoire(); }
    else if (pvJ <= 0) { setPhase("fin"); setMsg(`${moi.pseudo} est K.O.… Révise ce cours et reviens !`); }
    else { setI((x) => x + 1); setPhase("question"); }
  };

  return (
    <div className="space-y-3">
      <div className="tile-grass relative h-64 overflow-hidden border-4 border-border">
        <div className="absolute left-2 top-2"><Barre nom={monstre.slice(0, 22)} pv={pvM} /></div>
        <div className={`absolute right-10 top-10 text-7xl ${choc === "m" ? "anim-shake" : "anim-bob"} ${pvM <= 0 ? "opacity-20" : ""}`}>{emoji}</div>
        <div className={`absolute bottom-2 left-10 ${choc === "j" ? "anim-shake" : ""}`}><Personnage a={moi.apparence} dir="haut" taille={100} /></div>
        <div className="absolute bottom-2 right-2"><Barre nom={moi.pseudo} pv={pvJ} niveau={moi.niveau} /></div>
      </div>
      <div className="pixel-box min-h-28 space-y-3 p-3">
        {phase === "question" ? <p className="text-xl">{q.enonce}</p> : <p className="text-xl">{msg}</p>}
        {phase === "intro" && <button className="pixel-btn" onClick={() => setPhase("question")}>▶ COMBATTRE</button>}
        {phase === "question" && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {q.choix.map((c, k) => <button key={k} className="pixel-btn text-left !text-[10px]" onClick={() => repondre(k)}>▸ {c}</button>)}
          </div>
        )}
        {phase === "suite" && <button className="pixel-btn" onClick={suite}>▶ Suite</button>}
        {phase === "fin" && <button className="pixel-btn" onClick={onFermer}>Retour à la salle</button>}
        {phase !== "fin" && phase !== "suite" && <button className="ml-2 text-muted-foreground underline" onClick={onFermer}>Fuir</button>}
      </div>
    </div>
  );
}
