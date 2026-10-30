import { d, type Scene } from "../monde";

export const Hall: Scene = {
  id: "hall", nom: "Hall d'Isitech", l: 20, h: 14, sol: "tile-tile",
  decor: [
    d("mur", 0, 0, 3), d("mur", 5, 0, 10), d("mur", 17, 0, 3),
    d("casier", 6, 1, 3), d("casier", 11, 1, 3),
    d("accueil", 8, 5, 4),
    d("plante", 1, 1), d("plante", 18, 1), d("plante", 1, 12), d("plante", 18, 12),
    d("banc", 3, 10, 3), d("banc", 14, 10, 3),
    d("tapis", 8, 11, 4, 3, false),
  ],
  portes: [
    { x: 3, y: 0, w: 2, h: 1, vers: "classe", label: "CLASSE" },
    { x: 15, y: 0, w: 2, h: 1, vers: "serveur", label: "SERVEUR" },
    { x: 19, y: 6, w: 1, h: 2, vers: "cafeteria", label: "CAFÉT" },
  ],
  entrees: { debut: { x: 10, y: 9 }, classe: { x: 4, y: 1.9 }, serveur: { x: 16, y: 1.9 }, cafeteria: { x: 18.2, y: 7 } },
};
