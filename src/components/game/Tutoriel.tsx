import { useState } from "react";

const ETAPES = [
  { icone: "🎮", titre: "Bienvenue à Isitech !", texte: "Tu es dans le hall de l'école. Les autres élèves connectés apparaissent en direct à côté de toi." },
  { icone: "⌨️", titre: "Se déplacer", texte: "Utilise les flèches ou Z Q S D. Sur téléphone, glisse le joystick en bas à gauche." },
  { icone: "💬", titre: "Parler", texte: "Approche-toi d'un personnage : un « ! » apparaît. Appuie sur E (ou touche le bouton en bas) pour lui parler." },
  { icone: "🚪", titre: "Changer de salle", texte: "Marche sur une porte jaune : CLASSE pour les cours, SERVEUR pour les combats, CAFÉT pour les profils." },
  { icone: "📚", titre: "Les cours", texte: "En classe, chaque élève assis représente un cours. Le professeur te permet d'en déposer un nouveau." },
  { icone: "⚔️", titre: "Les combats", texte: "En salle serveur, les monstres te posent des questions sur les cours. Chaque victoire te donne de l'XP." },
  { icone: "🧑", titre: "Les profils", texte: "Clique sur n'importe quel joueur pour voir sa fiche. Le bouton Profil en haut te permet de modifier la tienne." },
];

export function Tutoriel({ onFin }: { onFin: () => void }) {
  const [i, setI] = useState(0);
  const e = ETAPES[i]!, dernier = i === ETAPES.length - 1;
  return (
    <div className="fixed inset-0 z-[3500] grid place-items-center bg-background/80 p-3">
      <div className="pixel-box w-full max-w-md space-y-4 p-5 text-center">
        <div className="anim-bob text-5xl">{e.icone}</div>
        <h2 className="font-pixel text-xs text-accent">{e.titre}</h2>
        <p className="text-xl">{e.texte}</p>
        <div className="flex justify-center gap-1">
          {ETAPES.map((_, k) => <span key={k} className={`h-2 w-4 border-2 border-border ${k <= i ? "bg-primary" : "bg-muted"}`} />)}
        </div>
        <div className="flex items-center justify-between gap-2">
          <button className="text-muted-foreground underline" onClick={onFin}>Passer</button>
          <div className="flex gap-2">
            {i > 0 && <button className="pixel-btn" onClick={() => setI(i - 1)}>◀</button>}
            <button className="pixel-btn" onClick={() => (dernier ? onFin() : setI(i + 1))}>{dernier ? "▶ JOUER" : "Suivant ▶"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
