/** Moteur de salle : données des scènes, collisions et portes. Logique pure, sans affichage. */
export const TUILE = 40;

export type SceneId = "hall" | "classe" | "serveur" | "cafeteria";
export type TypeDecor =
  | "mur" | "tableau" | "bureau" | "plante" | "banc" | "accueil" | "casier"
  | "rack" | "table" | "comptoir" | "tapis";
export type Decor = { x: number; y: number; w: number; h: number; type: TypeDecor; solide: boolean };
export type Porte = { x: number; y: number; w: number; h: number; vers: SceneId; label: string };
export type Point = { x: number; y: number };
export type Scene = {
  id: SceneId; nom: string; l: number; h: number; sol: string;
  decor: Decor[]; portes: Porte[];
  /** Point d'arrivée selon la salle d'où l'on vient ("debut" = première arrivée). */
  entrees: Partial<Record<SceneId | "debut", Point>>;
};

export const d = (type: TypeDecor, x: number, y: number, w = 1, h = 1, solide = true): Decor =>
  ({ type, x, y, w, h, solide });

const R = 0.3; // demi-largeur des pieds du joueur

/** Vrai si les pieds du joueur centrés en (x, y) touchent un obstacle ou sortent de la salle. */
export function bloque(s: Scene, x: number, y: number): boolean {
  const x0 = x - R, x1 = x + R, y0 = y - 0.25, y1 = y;
  if (x0 < 0 || x1 > s.l || y0 < 0 || y1 > s.h) return true;
  return s.decor.some((o) => o.solide && x1 > o.x && x0 < o.x + o.w && y1 > o.y && y0 < o.y + o.h);
}

export function porteSous(s: Scene, x: number, y: number): Porte | undefined {
  return s.portes.find((p) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h);
}

/** Déplace en glissant le long des murs (axe X puis axe Y). */
export function deplacer(s: Scene, p: Point, dx: number, dy: number): Point {
  let { x, y } = p;
  if (!bloque(s, x + dx, y)) x += dx;
  if (!bloque(s, x, y + dy)) y += dy;
  return { x, y };
}
