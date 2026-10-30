/** Données de personnalisation des personnages (joueurs et PNJ). Logique pure, sans affichage. */
export type Direction = "haut" | "bas" | "gauche" | "droite";

export type Apparence = {
  peau: string;
  coiffure: "courte" | "longue" | "herisse" | "chignon" | "rase" | "boucles";
  cheveux: string;
  yeux: string;
  haut: "tshirt" | "sweat" | "chemise" | "veste";
  hautCouleur: string;
  bas: "jean" | "jogging" | "short" | "jupe";
  basCouleur: string;
  chaussures: string;
  accessoire: "aucun" | "lunettes" | "casquette" | "casque" | "badge" | "sac";
};

export const OPTIONS = {
  peau: ["#f6d5b8", "#e8b98f", "#c98d5f", "#9a6440", "#6b4128", "#4a2c1a"],
  coiffure: ["courte", "longue", "herisse", "chignon", "rase", "boucles"] as const,
  cheveux: ["#1e1a17", "#4b2e1a", "#8a5a2b", "#d9b16a", "#b5452b", "#6d7a8a", "#2f8f5b", "#7b4fc4"],
  yeux: ["#2b2b2b", "#4a7bd1", "#3d8a4f", "#7a4a26"],
  haut: ["tshirt", "sweat", "chemise", "veste"] as const,
  hautCouleur: ["#2f9e5a", "#1f6f8b", "#d9483b", "#f2c14e", "#f4f4f4", "#2d2d3a", "#8b5fbf"],
  bas: ["jean", "jogging", "short", "jupe"] as const,
  basCouleur: ["#2c4a7a", "#2d2d2d", "#6b5a45", "#3e6b48", "#8a8a8a"],
  chaussures: ["#f2f2f2", "#222222", "#b5452b", "#2f6fd1", "#6b4128"],
  accessoire: ["aucun", "lunettes", "casquette", "casque", "badge", "sac"] as const,
};

export const LIBELLES: Record<string, string> = {
  courte: "Courte", longue: "Longue", herisse: "Hérissée", chignon: "Chignon", rase: "Rasée", boucles: "Bouclée",
  tshirt: "T-shirt", sweat: "Sweat", chemise: "Chemise", veste: "Veste",
  jean: "Jean", jogging: "Jogging", short: "Short", jupe: "Jupe",
  aucun: "Aucun", lunettes: "Lunettes", casquette: "Casquette", casque: "Casque audio", badge: "Badge Isitech", sac: "Sac à dos",
};

export const DEFAUT: Apparence = {
  peau: "#e8b98f", coiffure: "courte", cheveux: "#4b2e1a", yeux: "#2b2b2b",
  haut: "sweat", hautCouleur: "#2f9e5a", bas: "jean", basCouleur: "#2c4a7a",
  chaussures: "#f2f2f2", accessoire: "badge",
};

const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)]!;

export function aleatoire(): Apparence {
  return {
    peau: pick(OPTIONS.peau), coiffure: pick(OPTIONS.coiffure), cheveux: pick(OPTIONS.cheveux),
    yeux: pick(OPTIONS.yeux), haut: pick(OPTIONS.haut), hautCouleur: pick(OPTIONS.hautCouleur),
    bas: pick(OPTIONS.bas), basCouleur: pick(OPTIONS.basCouleur), chaussures: pick(OPTIONS.chaussures),
    accessoire: pick(OPTIONS.accessoire),
  };
}

/** Complète une apparence stockée (éventuellement partielle) avec les valeurs par défaut. */
export function normaliser(v: unknown): Apparence {
  return { ...DEFAUT, ...(v && typeof v === "object" ? (v as Partial<Apparence>) : {}) };
}

/** Apparence stable dérivée d'un texte (pour les PNJ des cours). */
export function apparenceDepuis(graine: string): Apparence {
  let h = 2166136261;
  for (const c of graine) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const r = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; return h / 4294967296; };
  const p = <T,>(a: readonly T[]): T => a[Math.floor(r() * a.length)]!;
  return {
    peau: p(OPTIONS.peau), coiffure: p(OPTIONS.coiffure), cheveux: p(OPTIONS.cheveux), yeux: p(OPTIONS.yeux),
    haut: p(OPTIONS.haut), hautCouleur: p(OPTIONS.hautCouleur), bas: p(OPTIONS.bas), basCouleur: p(OPTIONS.basCouleur),
    chaussures: p(OPTIONS.chaussures), accessoire: p(OPTIONS.accessoire),
  };
}
