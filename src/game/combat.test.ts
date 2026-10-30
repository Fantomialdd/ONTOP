import { describe, expect, it } from "vitest";
import {
  aideCinquante,
  aideSoin,
  aideTemps,
  brouiller,
  calculerXp,
  choisirQuestions,
  creerCombat,
  dureeQuestion,
  graine,
  payerRancon,
  precision,
  PV_JOUEUR,
  repondre,
  REGLES,
  reveler,
  suivante,
  XP_MAX,
  type Difficulte,
  type Etat,
  type Question,
} from "./combat";

const q = (i: number, difficulte: 1 | 2 | 3 = 2): Question => ({
  q: `Question ${i} ?`,
  choix: [`a${i}`, `b${i}`, `c${i}`, `d${i}`],
  bonne: (i % 4) as 0 | 1 | 2 | 3,
  explication: `Parce que ${i}`,
  difficulte,
});
const pool = (n: number) => Array.from({ length: n }, (_, i) => q(i));
const rnd = () => graine(7);
const nouveau = (d: Difficulte = "normal", n = 8) => creerCombat(pool(n), d, rnd());
const bonne = (e: Etat) => e.courante!.ordre.indexOf(e.courante!.bonne);
const faux = (e: Etat) =>
  [0, 1, 2, 3].find(
    (i) =>
      i !== bonne(e) &&
      e.courante!.ordre[i] !== e.verrou &&
      !e.retirees.includes(e.courante!.ordre[i]!),
  )!;
const juste = (e: Etat, reste = 1000) => repondre(e, bonne(e), reste);
const rate = (e: Etat) => repondre(e, faux(e), 0);

describe("préparation du combat", () => {
  it("la vie du monstre dépend de la difficulté et du nombre de questions", () => {
    expect(nouveau("facile", 8).pvMonstre).toBe(8 * REGLES.facile.pvParQuestion);
    expect(nouveau("cauchemar", 8).pvMonstre).toBe(8 * REGLES.cauchemar.pvParQuestion);
    expect(nouveau("normal", 8).pvJoueur).toBe(PV_JOUEUR);
  });
  it("le temps par question diminue avec la difficulté", () => {
    const t = (["facile", "normal", "difficile", "cauchemar"] as const).map((d) =>
      dureeQuestion(nouveau(d)),
    );
    expect(t).toEqual([...t].sort((a, b) => b - a));
    expect(new Set(t).size).toBe(4);
  });
  it("mélange les réponses sans en perdre", () => {
    const e = nouveau();
    expect([...e.courante!.ordre].sort()).toEqual([0, 1, 2, 3]);
  });
  it("choisit les questions les plus proches du niveau voulu, sans doublon", () => {
    const mix = [
      ...Array.from({ length: 6 }, (_, i) => q(i, 1)),
      ...Array.from({ length: 6 }, (_, i) => q(10 + i, 3)),
      q(0, 1),
    ];
    expect(choisirQuestions(mix, 5, "facile", rnd()).every((x) => x.difficulte === 1)).toBe(true);
    expect(choisirQuestions(mix, 5, "cauchemar", rnd()).every((x) => x.difficulte === 3)).toBe(
      true,
    );
    expect(new Set(choisirQuestions(mix, 12, "normal", rnd()).map((x) => x.q)).size).toBe(12);
  });
});

describe("déroulement d'un tour", () => {
  it("une bonne réponse blesse le monstre", () => {
    const e = juste(nouveau());
    expect(e.pvMonstre).toBeLessThan(e.pvMonstreMax);
    expect(e.resultat).toMatchObject({ correct: true });
    expect(e.phase).toBe("resultat");
  });
  it("une mauvaise réponse blesse le joueur et remet le compteur d'enchaînement à zéro", () => {
    let e = juste(nouveau());
    e = suivante(e, rnd());
    expect(e.combo).toBe(1);
    e = rate(e);
    expect(e.pvJoueur).toBe(PV_JOUEUR - REGLES.normal.degats);
    expect(e.combo).toBe(0);
    expect(e.meilleurCombo).toBe(1);
  });
  it("un temps écoulé compte comme une erreur", () => {
    const e = repondre(nouveau(), null, 0);
    expect(e.resultat).toMatchObject({ correct: false, delai: true });
    expect(e.erreurs[0]!.choisie).toBeNull();
  });
  it("répondre vite donne un coup critique, plus fort", () => {
    const lent = juste(nouveau(), 0),
      vite = juste(nouveau(), dureeQuestion(nouveau()) * 1000);
    expect(vite.resultat!.critique).toBe(true);
    expect(lent.resultat!.critique).toBe(false);
    expect(vite.resultat!.degatsJoueur).toBeGreaterThan(lent.resultat!.degatsJoueur);
  });
  it("les bonnes réponses d'affilée augmentent les dégâts, jusqu'à un plafond", () => {
    let e = nouveau("normal", 12);
    const degats: number[] = [];
    for (let i = 0; i < 8; i++) {
      e = juste(e, 0);
      degats.push(e.resultat!.degatsJoueur);
      if (e.fin) break;
      e = suivante(e, rnd());
    }
    expect(degats[1]).toBeGreaterThan(degats[0]!);
    expect(degats[degats.length - 1]).toBe(degats[degats.length - 2]); // plafond atteint
  });
  it("ignore une réponse indisponible ou un second clic", () => {
    const e = juste(nouveau());
    expect(repondre(e, 0, 500)).toBe(e); // déjà répondu
    const f = nouveau("facile");
    const g = aideCinquante(f, rnd());
    const retiree = g.courante!.ordre.findIndex((o) => g.retirees.includes(o));
    expect(repondre(g, retiree, 500)).toBe(g);
  });
});

describe("fin du combat", () => {
  it("victoire quand le monstre n'a plus de vie", () => {
    let e = nouveau("facile", 8);
    for (let i = 0; i < 12 && !e.fin; i++) {
      e = juste(e, 0);
      if (!e.fin) e = suivante(e, rnd());
    }
    expect(e.fin).toBe("victoire");
    expect(calculerXp(e)).toBeGreaterThan(0);
  });
  it("défaite quand le joueur n'a plus de vie", () => {
    let e = nouveau("cauchemar", 12);
    for (let i = 0; i < 12 && !e.fin; i++) {
      e = rate(e);
      if (!e.fin) e = suivante(e, rnd());
    }
    expect(e.fin).toBe("defaite");
    expect(e.pvJoueur).toBe(0);
  });
  it("s'arrête quand il n'y a plus de questions", () => {
    let e = nouveau("facile", 3);
    for (let i = 0; i < 3 && !e.fin; i++) {
      e = repondre(e, null, 0);
      e = e.fin ? e : suivante(e, rnd());
    }
    expect(["epuise", "defaite"]).toContain(e.fin);
  });
  it("suivante() mène à l'écran de fin", () =>
    expect(suivante({ ...juste(nouveau("facile", 1)), phase: "resultat" }, rnd()).phase).toBe(
      "fini",
    ));
  it("l'XP respecte le plafond de la base, et un combat plus dur rapporte plus", () => {
    const gagne = (d: Difficulte) => {
      let e = nouveau(d, 8);
      for (let i = 0; i < 20 && !e.fin; i++) {
        e = juste(e, 100000);
        if (!e.fin) e = suivante(e, rnd());
      }
      return e;
    };
    const xp = (["facile", "normal", "difficile", "cauchemar"] as const).map((d) =>
      calculerXp(gagne(d)),
    );
    expect(xp).toEqual([...xp].sort((a, b) => a - b));
    expect(Math.max(...xp)).toBeLessThanOrEqual(XP_MAX);
    expect(precision(gagne("normal"))).toBe(1);
  });
  it("une défaite rapporte peu d'XP", () => {
    let e = nouveau("normal", 12);
    for (let i = 0; i < 12 && !e.fin; i++) {
      e = i % 3 === 0 ? juste(e) : rate(e);
      if (!e.fin) e = suivante(e, rnd());
    }
    expect(calculerXp(e)).toBeLessThan(REGLES.normal.xp);
  });
  it("garde le détail des erreurs avec l'explication", () => {
    const e = rate(nouveau());
    expect(e.erreurs[0]).toMatchObject({ explication: expect.stringContaining("Parce que") });
    expect(e.erreurs[0]!.bonne).toBe(e.courante!.choix[e.courante!.bonne]);
  });
});

describe("aides", () => {
  it("50/50 retire deux mauvaises réponses, une seule fois", () => {
    const e = aideCinquante(nouveau(), rnd());
    expect(e.retirees).toHaveLength(2);
    expect(e.retirees).not.toContain(e.courante!.bonne);
    expect(aideCinquante(e, rnd())).toBe(e);
  });
  it("le temps supplémentaire ajoute 10 secondes, une seule fois", () => {
    const e = aideTemps(nouveau());
    expect(dureeQuestion(e)).toBe(dureeQuestion(nouveau()) + 10);
    expect(aideTemps(e)).toBe(e);
  });
  it("le soin rend de la vie sans dépasser le maximum, et ne sert pas à pleine santé", () => {
    const blesse = rate(nouveau());
    const e = aideSoin(suivante(blesse, rnd()));
    expect(e.pvJoueur).toBeGreaterThan(blesse.pvJoueur);
    expect(e.pvJoueur).toBeLessThanOrEqual(PV_JOUEUR);
    const plein = nouveau();
    expect(aideSoin(plein)).toBe(plein);
  });
  it("les aides sont rechargées à chaque nouveau combat", () =>
    expect(nouveau().aides).toEqual({ cinquante: 1, temps: 1, soin: 1 }));
});

describe("capacités des monstres", () => {
  it("le Virus se réplique : la question revient, 2 fois au plus", () => {
    let e = nouveau("normal", 8);
    const avant = e.file.length;
    e = rate(e);
    expect(e.resultat!.replique).toBe(true);
    expect(e.file.length).toBe(avant + 1);
    for (let i = 0; i < 4 && !e.fin; i++) {
      e = suivante(e, rnd());
      e = rate(e);
    }
    expect(e.repliques).toBeLessThanOrEqual(2);
  });
  it("le Ransomware chiffre une réponse une question sur trois, et on peut payer la rançon", () => {
    let e = nouveau("cauchemar", 12);
    const verrous: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      verrous.push(e.verrou !== null);
      e = juste(e);
      if (e.fin) break;
      e = suivante(e, rnd());
    }
    expect(verrous).toEqual([false, false, true, false, false, true]);
    let p = nouveau("cauchemar", 12);
    p = suivante(juste(p), rnd());
    p = suivante(juste(p), rnd());
    expect(p.verrou).not.toBeNull();
    const paye = payerRancon(p);
    expect(paye.verrou).toBeNull();
    expect(paye.pvJoueur).toBeLessThan(p.pvJoueur);
    expect(paye.pvJoueur).toBeGreaterThanOrEqual(1);
  });
  it("une réponse chiffrée ne peut pas être choisie", () => {
    let p = nouveau("cauchemar", 12);
    p = suivante(juste(p), rnd());
    p = suivante(juste(p), rnd());
    const pos = p.courante!.ordre.indexOf(p.verrou!);
    expect(repondre(p, pos, 500)).toBe(p);
  });
  it("le 50/50 ne retire jamais la bonne réponse ni ne gaspille sur la réponse chiffrée", () => {
    let p = nouveau("cauchemar", 12);
    p = suivante(juste(p), rnd());
    p = suivante(juste(p), rnd());
    const a = aideCinquante(p, rnd());
    expect(a.retirees).not.toContain(a.courante!.bonne);
    expect(a.retirees).not.toContain(a.verrou);
  });
  it("le Bug brouille l'ordre des réponses, une fois par question, sans perdre la bonne", () => {
    const e = nouveau("facile", 8);
    const b = brouiller(e, graine(99));
    expect(b.brouillee).toBe(true);
    expect([...b.courante!.ordre].sort()).toEqual([0, 1, 2, 3]);
    expect(b.courante!.ordre[bonne(b)]).toBe(b.courante!.bonne);
    expect(brouiller(b, graine(5))).toBe(b);
    expect(brouiller(nouveau("normal"), rnd()).brouillee).toBe(false); // les autres monstres ne brouillent pas
  });
  it("le Malware cache l'énoncé jusqu'à ce qu'on le révèle", () => {
    const e = nouveau("difficile", 8);
    expect(e.obscurci).toBe(true);
    expect(reveler(e).obscurci).toBe(false);
    expect(nouveau("normal").obscurci).toBe(false);
  });
  it("à mi-vie le monstre se met en colère : il frappe plus fort et le chrono raccourcit", () => {
    let e = nouveau("difficile", 6);
    for (let i = 0; i < 6 && !e.enrage && !e.fin; i++) {
      e = juste(e, 0);
      if (!e.enrage && !e.fin) e = suivante(e, rnd());
    }
    expect(e.enrage).toBe(true);
    const apres = suivante(e, rnd());
    expect(dureeQuestion(apres)).toBe(REGLES.difficile.temps - 3);
    expect(rate(apres).resultat!.degatsRecus).toBe(Math.round(REGLES.difficile.degats * 1.3));
  });
  it("le niveau facile ne se met jamais en colère", () => {
    let e = nouveau("facile", 8);
    for (let i = 0; i < 8 && !e.fin; i++) {
      e = juste(e, 0);
      if (!e.fin) e = suivante(e, rnd());
    }
    expect(e.enrage).toBe(false);
  });
});

describe("robustesse", () => {
  it("n'importe quelle suite d'actions garde un état cohérent", () => {
    const r = graine(2026);
    for (let essai = 0; essai < 200; essai++) {
      const d = (["facile", "normal", "difficile", "cauchemar"] as const)[Math.floor(r() * 4)]!;
      let e = creerCombat(pool(4 + Math.floor(r() * 10)), d, r);
      for (let i = 0; i < 40 && e.phase !== "fini"; i++) {
        const a = r();
        if (e.phase === "resultat") e = suivante(e, r);
        else if (a < 0.1) e = aideCinquante(e, r);
        else if (a < 0.15) e = aideTemps(e);
        else if (a < 0.2) e = aideSoin(e);
        else if (a < 0.25) e = payerRancon(e);
        else if (a < 0.3) e = brouiller(e, r);
        else e = repondre(e, a < 0.4 ? null : Math.floor(r() * 4), Math.floor(r() * 20000), r);
        expect(e.pvJoueur).toBeGreaterThanOrEqual(0);
        expect(e.pvJoueur).toBeLessThanOrEqual(PV_JOUEUR);
        expect(e.pvMonstre).toBeGreaterThanOrEqual(0);
        expect(e.pvMonstre).toBeLessThanOrEqual(e.pvMonstreMax);
        expect(e.bonnes + e.mauvaises).toBeLessThanOrEqual(e.total + 2);
        expect(calculerXp(e)).toBeLessThanOrEqual(XP_MAX);
      }
    }
  });
});
