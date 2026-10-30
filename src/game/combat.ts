import type { TypeMonstre } from "./carte/types";
import type { QuestionQuiz } from "../../supabase/functions/generer-quiz/handler";
import { melange } from "./quiz";

/**
 * Règles des combats (quiz). Logique pure : aucune interface ici, tout est testable.
 * Une bonne réponse blesse le monstre (plus fort avec les enchaînements et la rapidité), une erreur ou un temps écoulé
 * blesse le joueur. Chaque monstre a sa capacité spéciale.
 */
export type Difficulte = "facile" | "normal" | "difficile" | "cauchemar";
export type Regles = {
  nom: string;
  monstre: TypeMonstre;
  titre: string;
  pvParQuestion: number;
  degats: number;
  temps: number;
  xp: number;
};
export const REGLES: Record<Difficulte, Regles> = {
  facile: {
    nom: "Facile",
    monstre: "bug",
    titre: "Un Bug tout petit",
    pvParQuestion: 11,
    degats: 8,
    temps: 30,
    xp: 15,
  },
  normal: {
    nom: "Normal",
    monstre: "virus",
    titre: "Un Virus qui se réplique",
    pvParQuestion: 14,
    degats: 12,
    temps: 22,
    xp: 25,
  },
  difficile: {
    nom: "Difficile",
    monstre: "malware",
    titre: "Un Malware sournois",
    pvParQuestion: 17,
    degats: 16,
    temps: 15,
    xp: 40,
  },
  cauchemar: {
    nom: "Cauchemar",
    monstre: "ransomware",
    titre: "Le Ransomware (boss)",
    pvParQuestion: 20,
    degats: 20,
    temps: 11,
    xp: 50,
  },
};
export const PV_JOUEUR = 100;
export const XP_MAX = 50; // plafond accepté par la base à chaque gain
const DEGATS_BASE = 20,
  BONUS_COMBO = 3,
  BONUS_COMBO_MAX = 15,
  BONUS_CRITIQUE = 8,
  SEUIL_CRITIQUE = 0.6;
const COUT_RANCON = 8,
  SOIN = 25,
  TEMPS_BONUS = 10;

export type Question = QuestionQuiz;
export type QuestionJeu = Question & { ordre: number[] }; // ordre[i] = index d'origine de la réponse affichée en position i
export type Resultat = {
  correct: boolean;
  delai: boolean;
  affichee: number | null;
  bonneAffichee: number;
  degatsJoueur: number;
  degatsRecus: number;
  critique: boolean;
  enrage: boolean;
  replique: boolean;
};
export type Fin = "victoire" | "defaite" | "epuise";
export type Erreur = { q: string; choisie: string | null; bonne: string; explication: string };

export type Etat = {
  difficulte: Difficulte;
  regles: Regles;
  total: number;
  file: Question[];
  courante: QuestionJeu | null;
  numero: number;
  pvJoueur: number;
  pvMonstre: number;
  pvMonstreMax: number;
  combo: number;
  meilleurCombo: number;
  bonnes: number;
  mauvaises: number;
  critiques: number;
  erreurs: Erreur[];
  tempsMs: number;
  aides: { cinquante: number; temps: number; soin: number };
  retirees: number[]; // réponses éliminées par le 50/50 (index d'origine)
  verrou: number | null; // réponse chiffrée par le Ransomware (index d'origine)
  brouillee: boolean;
  obscurci: boolean;
  bonusTemps: number;
  enrage: boolean;
  repliques: number;
  phase: "question" | "resultat" | "fini";
  resultat: Resultat | null;
  fin: Fin | null;
};

type Rng = () => number;

/** Choisit les questions d'un combat : mélange, puis privilégie le niveau de difficulté voulu. */
export function choisirQuestions(
  pool: readonly Question[],
  n: number,
  d: Difficulte,
  rnd: Rng = Math.random,
): Question[] {
  const cible = d === "facile" ? 1 : d === "normal" ? 2 : 3;
  const uniques = new Map<string, Question>();
  for (const q of pool) if (!uniques.has(q.q.toLowerCase())) uniques.set(q.q.toLowerCase(), q);
  const melangees = melange([...uniques.values()], rnd);
  // tri stable : les questions les plus proches du niveau voulu d'abord (le mélange départage les égalités)
  const choisies = melangees
    .map((q, i) => ({ q, i }))
    .sort(
      (a, b) => Math.abs(a.q.difficulte - cible) - Math.abs(b.q.difficulte - cible) || a.i - b.i,
    )
    .slice(0, n)
    .map((x) => x.q);
  return melange(choisies, rnd);
}

const preparer = (q: Question, rnd: Rng): QuestionJeu => ({
  ...q,
  ordre: melange([0, 1, 2, 3], rnd),
});

export function creerCombat(
  questions: readonly Question[],
  d: Difficulte,
  rnd: Rng = Math.random,
): Etat {
  const regles = REGLES[d];
  const total = questions.length;
  const e: Etat = {
    difficulte: d,
    regles,
    total,
    file: [...questions],
    courante: null,
    numero: 0,
    pvJoueur: PV_JOUEUR,
    pvMonstre: total * regles.pvParQuestion,
    pvMonstreMax: total * regles.pvParQuestion,
    combo: 0,
    meilleurCombo: 0,
    bonnes: 0,
    mauvaises: 0,
    critiques: 0,
    erreurs: [],
    tempsMs: 0,
    aides: { cinquante: 1, temps: 1, soin: 1 },
    retirees: [],
    verrou: null,
    brouillee: false,
    obscurci: false,
    bonusTemps: 0,
    enrage: false,
    repliques: 0,
    phase: "question",
    resultat: null,
    fin: null,
  };
  return suivanteInterne(e, rnd);
}

/** Durée (en secondes) de la question en cours. */
export const dureeQuestion = (e: Etat) =>
  Math.max(5, e.regles.temps - (e.enrage ? 3 : 0) + e.bonusTemps);

function suivanteInterne(e: Etat, rnd: Rng): Etat {
  const [q, ...reste] = e.file;
  if (!q) return { ...e, courante: null, phase: "fini", fin: e.fin ?? "epuise" };
  const numero = e.numero + 1,
    courante = preparer(q, rnd);
  let verrou: number | null = null;
  // Le Ransomware chiffre une réponse une question sur trois
  if (e.regles.monstre === "ransomware" && numero % 3 === 0)
    verrou = courante.ordre[Math.floor(rnd() * 4)]!;
  return {
    ...e,
    file: reste,
    courante,
    numero,
    phase: "question",
    resultat: null,
    retirees: [],
    verrou,
    brouillee: false,
    obscurci: e.regles.monstre === "malware",
    bonusTemps: 0,
  };
}

/** Passe à la question suivante (ou à l'écran de fin) une fois le résultat affiché. */
export function suivante(e: Etat, rnd: Rng = Math.random): Etat {
  if (e.fin) return { ...e, phase: "fini" };
  return suivanteInterne(e, rnd);
}

/** Réponse du joueur : `affichee` = position choisie à l'écran, ou null si le temps est écoulé. */
export function repondre(
  e: Etat,
  affichee: number | null,
  resteMs: number,
  rnd: Rng = Math.random,
): Etat {
  const q = e.courante;
  if (!q || e.phase !== "question") return e;
  if (affichee !== null) {
    const orig = q.ordre[affichee];
    if (orig === undefined || e.retirees.includes(orig) || e.verrou === orig) return e; // réponse indisponible : rien ne se passe
  }
  const bonneAffichee = q.ordre.indexOf(q.bonne);
  const correct = affichee === bonneAffichee;
  const duree = dureeQuestion(e) * 1000;
  const mis = Math.max(0, Math.min(duree, duree - resteMs));
  const r: Resultat = {
    correct,
    delai: affichee === null,
    affichee,
    bonneAffichee,
    degatsJoueur: 0,
    degatsRecus: 0,
    critique: false,
    enrage: false,
    replique: false,
  };
  let {
    pvJoueur,
    pvMonstre,
    combo,
    meilleurCombo,
    bonnes,
    mauvaises,
    critiques,
    repliques,
    enrage,
  } = e;
  let file = e.file;
  const erreurs = e.erreurs;

  if (correct) {
    r.critique = resteMs / duree >= SEUIL_CRITIQUE;
    r.degatsJoueur =
      DEGATS_BASE +
      Math.min(BONUS_COMBO_MAX, combo * BONUS_COMBO) +
      (r.critique ? BONUS_CRITIQUE : 0);
    pvMonstre = Math.max(0, pvMonstre - r.degatsJoueur);
    combo += 1;
    meilleurCombo = Math.max(meilleurCombo, combo);
    bonnes += 1;
    if (r.critique) critiques += 1;
    if (!enrage && pvMonstre > 0 && pvMonstre <= e.pvMonstreMax / 2 && e.difficulte !== "facile") {
      enrage = true;
      r.enrage = true;
    }
  } else {
    r.degatsRecus = Math.round(e.regles.degats * (enrage ? 1.3 : 1));
    pvJoueur = Math.max(0, pvJoueur - r.degatsRecus);
    combo = 0;
    mauvaises += 1;
    erreurs.push({
      q: q.q,
      choisie: affichee === null ? null : q.choix[q.ordre[affichee]!]!,
      bonne: q.choix[q.bonne],
      explication: q.explication,
    });
    // Le Virus se réplique : la question revient (2 fois au maximum)
    if (e.regles.monstre === "virus" && repliques < 2) {
      file = [...file, q];
      repliques += 1;
      r.replique = true;
    }
  }
  const fin: Fin | null =
    pvMonstre <= 0 ? "victoire" : pvJoueur <= 0 ? "defaite" : file.length === 0 ? "epuise" : null;
  void rnd;
  return {
    ...e,
    pvJoueur,
    pvMonstre,
    combo,
    meilleurCombo,
    bonnes,
    mauvaises,
    critiques,
    repliques,
    enrage,
    file,
    erreurs: [...erreurs],
    tempsMs: e.tempsMs + mis,
    phase: "resultat",
    resultat: r,
    fin,
    total: e.total,
  };
}

/* ───────────── Aides (une de chaque par combat) ───────────── */
export function aideCinquante(e: Etat, rnd: Rng = Math.random): Etat {
  const q = e.courante;
  if (!q || e.phase !== "question" || e.aides.cinquante < 1 || e.retirees.length) return e;
  const fausses = [0, 1, 2, 3].filter((i) => i !== q.bonne && i !== e.verrou);
  const retirees = melange(fausses, rnd).slice(0, 2);
  return { ...e, retirees, aides: { ...e.aides, cinquante: 0 } };
}
export const aideTemps = (e: Etat): Etat =>
  e.phase !== "question" || e.aides.temps < 1
    ? e
    : { ...e, bonusTemps: e.bonusTemps + TEMPS_BONUS, aides: { ...e.aides, temps: 0 } };
export const aideSoin = (e: Etat): Etat =>
  e.phase !== "question" || e.aides.soin < 1 || e.pvJoueur >= PV_JOUEUR
    ? e
    : { ...e, pvJoueur: Math.min(PV_JOUEUR, e.pvJoueur + SOIN), aides: { ...e.aides, soin: 0 } };

/* ───────────── Capacités des monstres ───────────── */
/** Ransomware : payer la rançon (PV) pour déchiffrer la réponse bloquée. */
export function payerRancon(e: Etat): Etat {
  if (e.verrou === null || e.phase !== "question") return e;
  return { ...e, verrou: null, pvJoueur: Math.max(1, e.pvJoueur - COUT_RANCON) };
}
/** Bug : mélange l'ordre des réponses (une seule fois par question), en gardant les éliminations et le chiffrement. */
export function brouiller(e: Etat, rnd: Rng = Math.random): Etat {
  const q = e.courante;
  if (!q || e.phase !== "question" || e.brouillee || e.regles.monstre !== "bug") return e;
  return { ...e, brouillee: true, courante: { ...q, ordre: melange(q.ordre, rnd) } };
}
/** Malware : révèle l'énoncé une fois le brouillage terminé. */
export const reveler = (e: Etat): Etat => (e.obscurci ? { ...e, obscurci: false } : e);

/* ───────────── Fin de combat ───────────── */
export const precision = (e: Etat) =>
  e.bonnes + e.mauvaises === 0 ? 0 : e.bonnes / (e.bonnes + e.mauvaises);

/** XP gagnés : plus la difficulté est haute, plus c'est payant ; une défaite rapporte un peu. Toujours ≤ 50 (plafond de la base). */
/**
 * XP gagnés. Calcul en ENTIERS (× 10 000) pour que le serveur (PostgreSQL) et le jeu donnent exactement le même résultat :
 * une division décimale tronquée peut faire passer 12,5 à 12,4999… et changer l'arrondi.
 * La formule SQL (calcul_xp_combat) fait exactement la même chose.
 */
export function calculerXp(e: Etat): number {
  const base = e.regles.xp;
  const bonnes = e.bonnes, total = e.bonnes + e.mauvaises;
  const pMille = total === 0 ? 0 : Math.floor((bonnes * 10000) / total);        // précision × 10 000, entier
  if (e.fin === "victoire") {
    // base × (0,6 + 0,4 p) + bonus  →  × 10 000
    const brut = base * (6000 + (4 * pMille) / 10) + Math.min(10, e.meilleurCombo * 2) * 10000;
    return Math.min(XP_MAX, Math.floor((brut + 5000) / 10000));
  }
  const coef = e.fin === "epuise" ? 3000 : 2000;                                   // 0,3 ou 0,2 × 10 000
  const brut = base * coef * pMille;                                               // × 10 000 × 10 000
  return Math.min(XP_MAX, Math.floor((brut + 50000000) / 100000000));
}

/** Un test déterministe : générateur pseudo-aléatoire reproductible. */
export function graine(n: number): Rng {
  let s = n >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
