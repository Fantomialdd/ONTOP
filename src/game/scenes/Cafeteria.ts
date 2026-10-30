import { d, type Point, type Scene } from "../monde";

export const Cafeteria: Scene = {
  id: "cafeteria", nom: "Cafétéria", l: 16, h: 12, sol: "tile-floor",
  decor: [
    d("mur", 0, 0, 16), d("tableau", 12, 0, 3),
    d("comptoir", 1, 2, 6),
    d("table", 4, 5, 2, 2), d("table", 9, 5, 2, 2), d("table", 4, 8.5, 2, 2), d("table", 9, 8.5, 2, 2),
    d("plante", 15, 11), d("plante", 15, 1),
  ],
  portes: [{ x: 0, y: 5, w: 1, h: 2, vers: "hall", label: "HALL" }],
  entrees: { debut: { x: 1.6, y: 6 }, hall: { x: 1.6, y: 6 } },
};

export const BARMAN: Point = { x: 4, y: 1.8 };
export const TABLEAU_HEROS: Point = { x: 13.5, y: 1.7 };
