import type { Scene, SceneId } from "../monde";
import { Hall } from "./Hall";
import { Classe } from "./Classe";
import { Serveur } from "./Serveur";
import { Cafeteria } from "./Cafeteria";

export const SCENES: Record<SceneId, Scene> = { hall: Hall, classe: Classe, serveur: Serveur, cafeteria: Cafeteria };
