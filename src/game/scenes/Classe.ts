import { d, type Point, type Scene } from "../monde";

const rangs = [3, 6, 9], cols = [2, 5, 9, 12];

export const Classe: Scene = {
  id: "classe", nom: "Salle de classe", l: 16, h: 12, sol: "tile-floor",
  decor: [
    d("mur", 0, 0, 16), d("tableau", 5, 0, 6),
    d("bureau", 1, 1, 3),
    ...rangs.flatMap((y) => cols.map((x) => d("bureau", x, y, 2))),
    d("plante", 15, 1),
  ],
  portes: [{ x: 7, y: 11, w: 2, h: 1, vers: "hall", label: "HALL" }],
  entrees: { debut: { x: 8, y: 10.3 }, hall: { x: 8, y: 10.3 } },
};

/** Places assises des PNJ de cours (une par cours, dans l'ordre). */
export const PLACES_COURS: Point[] = rangs.flatMap((y) => cols.map((x) => ({ x: x + 1, y: y + 1.6 })));
export const PROF: Point = { x: 8, y: 1.8 };
