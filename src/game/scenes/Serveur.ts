import { d, type Point, type Scene } from "../monde";

export const Serveur: Scene = {
  id: "serveur", nom: "Salle serveur", l: 16, h: 12, sol: "tile-tile",
  decor: [
    d("mur", 0, 0, 16),
    d("rack", 1, 1, 1, 4), d("rack", 4, 1, 1, 4), d("rack", 11, 1, 1, 4), d("rack", 14, 1, 1, 4),
    d("rack", 1, 7, 1, 3), d("rack", 14, 7, 1, 3),
  ],
  portes: [{ x: 7, y: 11, w: 2, h: 1, vers: "hall", label: "HALL" }],
  entrees: { debut: { x: 8, y: 10.3 }, hall: { x: 8, y: 10.3 } },
};

export const PLACES_MONSTRES: Point[] = [
  { x: 8, y: 6 }, { x: 2.6, y: 3 }, { x: 12.6, y: 3 }, { x: 6.5, y: 3 }, { x: 9.5, y: 3 },
  { x: 5, y: 8.5 }, { x: 11, y: 8.5 }, { x: 2.8, y: 9.5 }, { x: 13, y: 9.5 },
];
export const EMOJIS_MONSTRES = ["👾", "🐛", "🦠", "👹", "🐉", "💀", "🤖", "👻", "🕷️"];
