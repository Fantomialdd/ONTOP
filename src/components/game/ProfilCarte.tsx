import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Personnage } from "./Personnage";
import { majProfil, useProfil, type Profil } from "@/game/profil";

/** Fiche joueur : lecture pour les autres, modification pour soi. */
export function ProfilCarte({ id, moi, onMaj }: { id: string; moi: Profil; onMaj: () => Promise<unknown> }) {
  const { data: p, isLoading } = useProfil(id);
  const [edit, setEdit] = useState(false);
  const [pseudo, setPseudo] = useState(""), [bio, setBio] = useState(""), [titre, setTitre] = useState("");
  useEffect(() => { if (p) { setPseudo(p.pseudo); setBio(p.bio); setTitre(p.titre); } }, [p]);
  if (isLoading) return <p>Chargement…</p>;
  if (!p) return <p>Joueur introuvable.</p>;
  const soi = id === moi.id;
  const save = async () => {
    await majProfil(id, { pseudo: pseudo.trim().slice(0, 20) || p.pseudo, bio: bio.slice(0, 200), titre: titre.trim().slice(0, 30) || p.titre } as never);
    await onMaj(); setEdit(false);
  };
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div className="tile-tile grid h-48 w-36 shrink-0 place-items-center border-4 border-border">
        <Personnage a={p.apparence} taille={130} />
      </div>
      <div className="w-full space-y-2">
        {edit ? (
          <>
            <label className="block text-sm">Pseudo<input className="pixel-input" value={pseudo} maxLength={20} onChange={(e) => setPseudo(e.target.value)} /></label>
            <label className="block text-sm">Titre<input className="pixel-input" value={titre} maxLength={30} onChange={(e) => setTitre(e.target.value)} /></label>
            <label className="block text-sm">Bio<textarea className="pixel-input" rows={3} value={bio} maxLength={200} onChange={(e) => setBio(e.target.value)} /></label>
            <button className="pixel-btn" onClick={save}>Enregistrer</button>
          </>
        ) : (
          <>
            <div className="font-pixel text-sm text-accent">{p.pseudo}</div>
            <div>{p.titre} · Niveau {p.niveau} · {p.xp} XP</div>
            <div className="h-3 border-2 border-border bg-muted"><div className="h-full bg-primary" style={{ width: `${p.xp % 100}%` }} /></div>
            <p className="text-muted-foreground">{p.bio || "Pas encore de bio."}</p>
            {soi && (
              <div className="flex flex-wrap gap-2">
                <button className="pixel-btn" onClick={() => setEdit(true)}>✎ Modifier</button>
                <Link to="/personnage" className="pixel-btn">👕 Apparence</Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
